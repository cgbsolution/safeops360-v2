// PTW activation gate — full pre-flight before transitioning out of the
// receiver step (ASSIGNEE_TASK) into ACTIVE. Mirrors the authoritative
// Python service at app/services/ptw_activation_gate.py — keep both in sync.
//
// Used by the SSR detail page to render a single blockers panel; the workflow
// engine (Python side) is the actual enforcement point on transition.

import { prisma } from "@/lib/prisma";

export type GateBlocker = {
  code:
    | "PERMIT_NOT_FOUND"
    | "PERMIT_CLOSED"
    | "PERMIT_REJECTED"
    | "PERMIT_SUSPENDED"
    | "PERMIT_EXPIRED"
    | "FLRA_MISSING"
    | "FLRA_UNSIGNED"
    | "FLRA_REFUSED"
    | "CREW_VALIDITY"
    | "CREW_PPE"
    | "CREW_PPE_WARN"
    | "ISOLATIONS_PENDING";
  message: string;
  severity: "ERROR" | "WARN";
};

export type PtwActivationGateStatus = {
  ok: boolean;
  /** Closed-loop rebuild: FLRA blocks activation only when the permit was
   *  created with flraRequired (instance policy / wizard override). */
  flraRequired: boolean;
  blockers: GateBlocker[];
  flra: {
    id: string;
    number: string;
    status: "IN_PROGRESS" | "COMPLETED";
    signedCount: number;
    totalCrew: number;
  } | null;
  crewValidityIssues: string[];
  crewPpeIssues: string[];
  crewPpeWarnings: string[];
  isolations: { pending: number; total: number };
};

// ─── PPE compliance mirror (app/services/ppe_gate.py) ───
// Role-profile mandatory PPE + permit-type PPE (PpeType.enablesPermitTypes)
// must be issued, ACKNOWLEDGED, and serviceable for every active crew member.

const ALL_ROLES = "*ALL*";
const INSPECTION_DUE_SOON_DAYS = 30;
const SERVICE_LIFE_WARN_DAYS = 90;
const BLOCKED_ITEM_STATUSES = new Set([
  "retired",
  "lost",
  "stolen",
  "recalled",
  "quarantined",
  "under_repair"
]);

type PpeRequirement = {
  ppe_type_code: string;
  ppe_type_name?: string;
  requirement_level?: string;
};

type PpeItemLite = {
  status: string;
  condition: string;
  batchUnderRecall: boolean;
  serviceLifeEndDate: Date;
  nextInspectionDueDate: Date | null;
};

function itemValidity(item: PpeItemLite): {
  level: "pass" | "warn" | "block";
  reasons: string[];
} {
  const now = Date.now();
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (BLOCKED_ITEM_STATUSES.has(item.status)) blockers.push(`item is ${item.status}`);
  if (item.batchUnderRecall) blockers.push("under batch recall");
  const lifeRemainingDays = Math.floor(
    (new Date(item.serviceLifeEndDate).getTime() - now) / 86_400_000
  );
  if (lifeRemainingDays < 0) blockers.push("service life exceeded");
  if (item.nextInspectionDueDate) {
    const dueMs = new Date(item.nextInspectionDueDate).getTime();
    if (now > dueMs) {
      blockers.push(`inspection overdue ${Math.floor((now - dueMs) / 86_400_000)}d`);
    } else if ((dueMs - now) / 86_400_000 <= INSPECTION_DUE_SOON_DAYS) {
      warnings.push("inspection due soon");
    }
  }
  if (item.condition === "unserviceable") blockers.push("condition unserviceable");
  if (lifeRemainingDays >= 0 && lifeRemainingDays <= SERVICE_LIFE_WARN_DAYS) {
    warnings.push(`service life ends in ${lifeRemainingDays}d`);
  }
  if (blockers.length > 0) return { level: "block", reasons: blockers };
  if (warnings.length > 0) return { level: "warn", reasons: warnings };
  return { level: "pass", reasons: [] };
}

function dedupRequirements(reqs: PpeRequirement[]): PpeRequirement[] {
  const byCode = new Map<string, PpeRequirement>();
  for (const r of reqs) {
    if (!r?.ppe_type_code) continue;
    const existing = byCode.get(r.ppe_type_code);
    if (!existing) {
      byCode.set(r.ppe_type_code, { ...r });
    } else if (r.requirement_level === "mandatory") {
      existing.requirement_level = "mandatory";
    }
  }
  return [...byCode.values()];
}

export async function getPtwActivationGate(
  permitId: string
): Promise<PtwActivationGateStatus> {
  const status: PtwActivationGateStatus = {
    ok: true,
    flraRequired: false,
    blockers: [],
    flra: null,
    crewValidityIssues: [],
    crewPpeIssues: [],
    crewPpeWarnings: [],
    isolations: { pending: 0, total: 0 }
  };

  const permit = await prisma.permit.findUnique({
    where: { id: permitId },
    include: {
      workCrew: {
        include: { user: { select: { id: true, name: true, role: true } } }
      },
      isolations: true
    }
  });

  if (!permit) {
    status.ok = false;
    status.blockers.push({
      code: "PERMIT_NOT_FOUND",
      message: "Permit not found.",
      severity: "ERROR"
    });
    return status;
  }

  // ─── 1. Permit-state pre-check ───
  if (permit.status === "CLOSED") {
    status.ok = false;
    status.blockers.push({
      code: "PERMIT_CLOSED",
      message: "Permit is already closed.",
      severity: "ERROR"
    });
  }
  if (permit.status === "REJECTED") {
    status.ok = false;
    status.blockers.push({
      code: "PERMIT_REJECTED",
      message: "Permit was rejected and cannot activate.",
      severity: "ERROR"
    });
  }
  if (permit.status === "SUSPENDED") {
    status.ok = false;
    status.blockers.push({
      code: "PERMIT_SUSPENDED",
      message: `Permit is suspended: ${permit.suspendedReason ?? "no reason recorded"}.`,
      severity: "ERROR"
    });
  }
  if (permit.validTo && new Date(permit.validTo).getTime() < Date.now()) {
    status.ok = false;
    status.blockers.push({
      code: "PERMIT_EXPIRED",
      message: `Validity ended on ${new Date(permit.validTo).toUTCString()}. Extend before activation.`,
      severity: "ERROR"
    });
  }

  // ─── 2. FLRA gate — CONDITIONAL (closed-loop rebuild) ───
  // Blocks only when the permit was created with flraRequired. An FLRA that
  // exists anyway on a non-required permit is surfaced (status.flra) but
  // never blocks — its issues downgrade to WARN.
  const flraRequired = Boolean((permit as any).flraRequired);
  status.flraRequired = flraRequired;
  const flra = await prisma.fLRA.findFirst({
    where: {
      permitId,
      status: { in: ["IN_PROGRESS", "COMPLETED"] }
    },
    orderBy: { createdAt: "desc" },
    include: {
      crewSignatures: { include: { user: { select: { id: true, name: true } } } }
    }
  });

  if (!flra) {
    if (flraRequired) {
      status.ok = false;
      status.blockers.push({
        code: "FLRA_MISSING",
        message:
          "A completed FLRA is required before activation. Crew must sign at the worksite.",
        severity: "ERROR"
      });
    }
  } else {
    status.flra = {
      id: flra.id,
      number: flra.number,
      status: flra.status as "IN_PROGRESS" | "COMPLETED",
      signedCount: flra.crewSignatures.filter((s) => s.signed).length,
      totalCrew: flra.crewSignatures.length
    };

    if (flra.status !== "COMPLETED") {
      const unsigned = flra.crewSignatures.filter((s) => !s.signed && !s.refusedToSign);
      const refused = flra.crewSignatures.filter((s) => s.refusedToSign);
      if (unsigned.length > 0) {
        if (flraRequired) status.ok = false;
        status.blockers.push({
          code: "FLRA_UNSIGNED",
          message: `FLRA awaiting sign-off from: ${unsigned.map((s) => s.user.name).join(", ")}.`,
          severity: flraRequired ? "ERROR" : "WARN"
        });
      }
      if (refused.length > 0) {
        if (flraRequired) status.ok = false;
        status.blockers.push({
          code: "FLRA_REFUSED",
          message: `Crew refused to sign: ${refused.map((s) => s.user.name).join(", ")}. Supervisor must replace them and re-do the FLRA.`,
          severity: flraRequired ? "ERROR" : "WARN"
        });
      }
    }
  }

  // ─── 3. Crew validity at issuance ───
  const activeCrew = permit.workCrew.filter((c) => c.removedAt === null);
  for (const c of activeCrew) {
    const issues: string[] = [];
    if (c.trainingValidAtIssuance === false) issues.push("training expired");
    if (c.medicalValidAtIssuance === false) issues.push("medical expired");
    if (c.contractorActiveAtIssuance === false) issues.push("contractor inactive");
    if (issues.length > 0) {
      status.crewValidityIssues.push(`${c.user.name} (${issues.join(", ")})`);
    }
  }
  if (status.crewValidityIssues.length > 0) {
    status.ok = false;
    status.blockers.push({
      code: "CREW_VALIDITY",
      message: `Crew has invalid credentials: ${status.crewValidityIssues.join("; ")}. Replace crew or update records before activation.`,
      severity: "ERROR"
    });
  }

  // ─── 4. PPE compliance (live, per crew member) ───
  if (activeCrew.length > 0) {
    const [profiles, ppeTypes, issuances] = await Promise.all([
      prisma.ppeRequirementProfile.findMany({
        where: { plantId: permit.plantId, isActive: true, scopeType: "role" }
      }),
      prisma.ppeType.findMany({ where: { isActive: true } }),
      prisma.ppeIssuance.findMany({
        where: {
          plantId: permit.plantId,
          status: "active",
          issuedToUserId: { in: activeCrew.map((c) => c.userId) }
        }
      })
    ]);

    const roleReqs = new Map<string, PpeRequirement[]>();
    for (const p of profiles) {
      const reqs = (p.requiredPpe as PpeRequirement[] | null) ?? [];
      roleReqs.set(p.scopeId, [...(roleReqs.get(p.scopeId) ?? []), ...reqs]);
    }
    const baseReqs = roleReqs.get(ALL_ROLES) ?? [];
    // Catalog tokens are lowercase and split electrical LV/HT; the PermitType
    // enum is UPPERCASE with LOTO work being the LV case.
    const permitToken =
      permit.type === "ELECTRICAL_LOTO" ? "electrical" : permit.type.toLowerCase();
    // Permit-type requirements as variant groups: types sharing a
    // (category, subcategory) are interchangeable — ANY one member satisfies.
    const permitGroupMap = new Map<string, { codes: string[]; names: string[] }>();
    for (const t of ppeTypes) {
      const enables = ((t.enablesPermitTypes as string[] | null) ?? []).map((x) =>
        String(x).toLowerCase()
      );
      if (!enables.includes(permitToken)) continue;
      const key = `${t.category}::${t.subcategory}`;
      const grp = permitGroupMap.get(key) ?? { codes: [], names: [] };
      grp.codes.push(t.code);
      grp.names.push(t.name);
      permitGroupMap.set(key, grp);
    }
    const permitGroups = [...permitGroupMap.values()];

    const items = await prisma.ppeItem.findMany({
      where: { id: { in: issuances.map((i) => i.ppeItemId) } },
      select: {
        id: true,
        status: true,
        condition: true,
        batchUnderRecall: true,
        serviceLifeEndDate: true,
        nextInspectionDueDate: true
      }
    });
    const itemsById = new Map(items.map((it) => [it.id, it]));

    for (const c of activeCrew) {
      const held = issuances.filter((i) => i.issuedToUserId === c.userId);
      const reqs = dedupRequirements([
        ...baseReqs,
        ...(roleReqs.get(c.user.role ?? "") ?? [])
      ]);
      const blockers: string[] = [];
      const warnings: string[] = [];

      // Does this crew member hold a valid, acknowledged item of this type?
      // Several items of one type can be held at once (e.g. an expired pair
      // not yet returned plus its replacement) — the BEST holding wins.
      type EvalState = "missing" | "unacknowledged" | "invalid" | "warn" | "pass";
      const RANK: Record<EvalState, number> = {
        pass: 0,
        warn: 1,
        invalid: 2,
        unacknowledged: 3,
        missing: 4
      };
      const evaluate = (typeCode: string): { state: EvalState; detail: string } => {
        let best: { state: EvalState; detail: string } = {
          state: "missing",
          detail: "not issued"
        };
        for (const iss of held) {
          if (iss.ppeTypeCode !== typeCode) continue;
          let outcome: { state: EvalState; detail: string };
          if (!iss.recipientAcknowledged) {
            // Paper issuance — doesn't count until acknowledged (§6.2).
            outcome = { state: "unacknowledged", detail: "issued but receipt not acknowledged" };
          } else {
            const item = itemsById.get(iss.ppeItemId);
            if (!item) {
              outcome = { state: "invalid", detail: "item record missing" };
            } else {
              const v = itemValidity(item);
              if (v.level === "block") outcome = { state: "invalid", detail: v.reasons.join("; ") };
              else if (v.level === "warn") outcome = { state: "warn", detail: v.reasons.join("; ") };
              else return { state: "pass", detail: "" };
            }
          }
          if (RANK[outcome.state] < RANK[best.state]) best = outcome;
        }
        return best;
      };

      // 1. Role-profile requirements — one explicit type code each.
      for (const req of reqs) {
        const name = req.ppe_type_name ?? req.ppe_type_code;
        const isMandatory = (req.requirement_level ?? "mandatory") === "mandatory";
        const { state, detail } = evaluate(req.ppe_type_code);
        if (state === "missing") {
          if (isMandatory) blockers.push(`${name} not issued`);
          else warnings.push(`${name} (recommended) not issued`);
        } else if (state === "unacknowledged") {
          if (isMandatory) blockers.push(`${name} ${detail}`);
        } else if (state === "invalid") {
          if (isMandatory) blockers.push(`${name} unserviceable (${detail})`);
        } else if (state === "warn") {
          warnings.push(`${name}: ${detail}`);
        }
      }

      // 2. Permit-type variant groups — ANY one member satisfies.
      const profileCodes = new Set(reqs.map((r) => r.ppe_type_code));
      for (const grp of permitGroups) {
        if (grp.codes.some((code) => profileCodes.has(code))) continue;
        const outcomes = grp.codes.map((code) => evaluate(code));
        const best =
          outcomes.find((o) => o.state === "pass") ??
          outcomes.find((o) => o.state === "warn");
        const label = grp.names.join(" / ");
        if (best) {
          if (best.state === "warn") warnings.push(`${label}: ${best.detail}`);
          continue;
        }
        const heldOutcome = outcomes.find((o) => o.state !== "missing");
        if (heldOutcome) blockers.push(`${label}: ${heldOutcome.detail}`);
        else blockers.push(`${label} not issued`);
      }

      if (blockers.length > 0) {
        status.crewPpeIssues.push(`${c.user.name}: ${blockers.join("; ")}`);
      } else if (warnings.length > 0) {
        status.crewPpeWarnings.push(`${c.user.name}: ${warnings.join("; ")}`);
      }
    }

    if (status.crewPpeIssues.length > 0) {
      status.ok = false;
      status.blockers.push({
        code: "CREW_PPE",
        message: `Crew PPE non-compliance: ${status.crewPpeIssues.join(" | ")}. Issue or replace PPE before activation.`,
        severity: "ERROR"
      });
    }
    if (status.crewPpeWarnings.length > 0) {
      status.blockers.push({
        code: "CREW_PPE_WARN",
        message: `PPE attention needed: ${status.crewPpeWarnings.join(" | ")}`,
        severity: "WARN"
      });
    }
  }

  // ─── 5. Isolations verified ───
  status.isolations.total = permit.isolations.length;
  const pending = permit.isolations.filter((i) => i.isolationVerifiedAt === null);
  status.isolations.pending = pending.length;
  if (pending.length > 0) {
    status.ok = false;
    const msg =
      status.isolations.total === 1
        ? "Isolation has not been verified at the worksite. Lock-out and confirm before activation."
        : `${pending.length} of ${status.isolations.total} isolations not yet verified. Receiver must lock-out and confirm each one.`;
    status.blockers.push({
      code: "ISOLATIONS_PENDING",
      message: msg,
      severity: "ERROR"
    });
  }

  return status;
}
