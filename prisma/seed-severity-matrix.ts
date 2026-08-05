// Seeds SeverityMatrixRule — the base severity for every DuPont STOP
// (axis, category, sub-category) triple.
//
//   npx tsx prisma/seed-severity-matrix.ts            # fill gaps only
//   npx tsx prisma/seed-severity-matrix.ts --force    # reset edited rows
//
// Idempotent. Without --force this only INSERTS missing rules and never
// overwrites an existing one. That default is load-bearing, not caution: the
// entire point of SeverityOverrideLog is that observers tell you which rules are
// wrong, and a re-run that silently reverted a calibration correction would
// throw that away. `--force` is how you deliberately reset to the seed baseline.
//
// The pairs are NOT authored here. They are taken from seed-observation-taxonomy
// (the same module that seeds ObservationTaxonomy), so the two can never drift:
// a sub-category added to the taxonomy without a severity rule is reported as a
// gap at the bottom of this run, and a rule for a pair that no longer exists in
// the taxonomy is a hard failure rather than a silently dead row.
//
// Requires apply-observation-severity-ddl.ts to have run first.

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

import { buildRows } from "./seed-observation-taxonomy";

const prisma = new PrismaClient();
const FORCE = process.argv.includes("--force");

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Base severity + observer-facing rationale, keyed by subCategoryCode.
 *
 * A sub-category code is unique across the whole taxonomy (they are prefixed
 * per category: RP_ / PP_ / PPE_ / TE_ / PR_ / HK_), so one flat map covers
 * both axes without ambiguity — and the axis is recovered from the taxonomy
 * rows themselves when the table is built.
 *
 * ── How these were assigned ────────────────────────────────────────────────
 * From the build spec's stated directional guidance, applied by hazard family
 * rather than by individual judgement, so the table is defensible as a whole:
 *
 *   • Energy isolation / LOTO, permit bypass, fall from height, electrical
 *     contact                                            → High / Critical
 *   • Unguarded machinery, caught-in/between, struck-by   → High
 *   • PPE non-compliance, housekeeping, signage           → Low / Medium
 *   • Procedural documentation gaps on a low-risk task    → Medium
 *
 * ⚠ This is the spec's own stated STARTING POINT, not a ratified matrix. It is
 * seeded so the engine has something deterministic to say on day one; the
 * calibration report (/api/observations/severity-calibration) is how it gets
 * corrected, and a consistently one-directional override on a pair means the
 * rule below is wrong rather than the observers.
 */
const RULES: Record<string, { severity: Severity; rationale: string }> = {
  // ── STOP-1 Reactions of People (ACT only) ────────────────────────────────
  // A reaction IS the finding: the person changed what they were doing because
  // they were being watched, which evidences the pre-observation state.
  RP_ADJUSTED_PPE: {
    severity: "MEDIUM",
    rationale:
      "Adjusting PPE on sight of an observer evidences that the required PPE was not being worn while the hazard was live.",
  },
  RP_CHANGED_POSITION: {
    severity: "MEDIUM",
    rationale:
      "A body position corrected only when observed indicates the person was knowingly in an exposed position.",
  },
  RP_REARRANGED_JOB: {
    severity: "MEDIUM",
    rationale:
      "Rearranging the job on approach indicates the method in use was known to be non-compliant.",
  },
  RP_STOPPED_JOB: {
    severity: "HIGH",
    rationale:
      "Stopping the job on sight of an observer means the person judged the task indefensible — treat as a live, recognised exposure.",
  },
  RP_ATTACHED_GROUNDS: {
    severity: "HIGH",
    rationale:
      "Grounds or lockout applied only on approach means energy isolation was absent while work was already in progress.",
  },

  // ── STOP-2 Positions of People (ACT only) — line-of-fire exposures ───────
  PP_STRIKING_AGAINST: {
    severity: "MEDIUM",
    rationale: "Contact with a fixed object — typically bruising or laceration potential.",
  },
  PP_STRUCK_BY: {
    severity: "HIGH",
    rationale:
      "Being in the path of a moving object or load carries serious injury potential with little warning time.",
  },
  PP_CAUGHT_IN_ON_BETWEEN: {
    severity: "HIGH",
    rationale:
      "Entrapment between moving parts or loads is a recognised major-injury and amputation mechanism.",
  },
  PP_FALLING_SAME_LEVEL: {
    severity: "MEDIUM",
    rationale: "Slip or trip at grade — common, and usually a lost-time rather than major injury.",
  },
  PP_FALLING_DIFFERENT_LEVEL: {
    severity: "CRITICAL",
    rationale:
      "Exposure to a fall from height without effective fall protection is a recognised fatality mechanism.",
  },
  PP_CONTACT_TEMPERATURE: {
    severity: "HIGH",
    rationale: "Contact with a temperature extreme carries serious burn and scald potential.",
  },
  PP_CONTACT_ELECTRICAL: {
    severity: "CRITICAL",
    rationale:
      "Contact with live electrical current is a recognised fatality mechanism and implies isolation failed.",
  },
  PP_OVEREXERTION: {
    severity: "MEDIUM",
    rationale:
      "Manual-handling overexertion is a leading cause of lost time, but rarely of major injury.",
  },

  // ── STOP-3 Personal Protective Equipment ─────────────────────────────────
  // PPE is the last line of defence, so a gap here is real — but the spec bands
  // PPE non-compliance at Low/Medium and these follow that.
  PPE_NOT_WORN: {
    severity: "MEDIUM",
    rationale: "Required PPE not worn removes the last line of defence against the task hazard.",
  },
  PPE_WORN_INCORRECTLY: {
    severity: "LOW",
    rationale:
      "PPE present but incorrectly worn — partial protection remains, and the fix is coaching at the point of work.",
  },
  PPE_REMOVED_DURING_TASK: {
    severity: "MEDIUM",
    rationale:
      "PPE removed or bypassed mid-task means protection was absent precisely while the hazard was live.",
  },
  PPE_NOT_AVAILABLE: {
    severity: "MEDIUM",
    rationale:
      "PPE not available at the workstation is a supply failure — nobody at that station can comply.",
  },
  PPE_DAMAGED_OR_EXPIRED: {
    severity: "MEDIUM",
    rationale:
      "Damaged or expired PPE gives the appearance of protection without the substance of it.",
  },
  PPE_WRONG_SPEC: {
    severity: "MEDIUM",
    rationale:
      "PPE not rated for the hazard means the control is believed present but is not — a candidate for uplift once override data exists.",
  },

  // ── STOP-4 Tools & Equipment ─────────────────────────────────────────────
  TE_WRONG_TOOL: {
    severity: "MEDIUM",
    rationale: "The wrong tool for the job introduces failure modes the method statement never assessed.",
  },
  TE_USED_INCORRECTLY: {
    severity: "MEDIUM",
    rationale: "Incorrect use defeats the guarding and interlocks the tool was designed around.",
  },
  TE_IMPROVISED_TOOL: {
    severity: "HIGH",
    rationale:
      "An improvised or homemade tool carries no rating, no guarding and no inspection history.",
  },
  TE_DAMAGED: {
    severity: "MEDIUM",
    rationale: "Damaged equipment fails unpredictably, often under the load it is being used for.",
  },
  TE_UNSAFE_CONDITION: {
    severity: "HIGH",
    rationale:
      "Equipment in a recognised unsafe condition is an active exposure for everyone who uses it next.",
  },
  TE_GUARD_MISSING: {
    severity: "HIGH",
    rationale:
      "A missing or defeated machine guard is unguarded machinery — the entrapment control is simply absent.",
  },
  TE_OVERDUE_MAINTENANCE: {
    severity: "MEDIUM",
    rationale:
      "Overdue calibration or maintenance means the equipment's safe condition is unverified rather than known bad.",
  },

  // ── STOP-5 Procedures ────────────────────────────────────────────────────
  PR_NOT_FOLLOWED: {
    severity: "MEDIUM",
    rationale: "The assessed method was not the method used, so its controls cannot be assumed present.",
  },
  PR_DEVIATED_FROM_SOP: {
    severity: "MEDIUM",
    rationale: "A deviation from the SOP puts the task outside the conditions the risk assessment covered.",
  },
  PR_PERMIT_LOTO_BYPASSED: {
    severity: "CRITICAL",
    rationale:
      "Bypassing a permit or lock-out step removes the primary energy-isolation control — a recognised fatality mechanism.",
  },
  PR_INADEQUATE_OR_OUTDATED: {
    severity: "MEDIUM",
    rationale:
      "An inadequate or outdated procedure is a documentation gap: the task can still be done safely by a competent person.",
  },
  PR_NOT_AVAILABLE: {
    severity: "MEDIUM",
    rationale:
      "A procedure not available at the worksite leaves the method to memory — a documentation gap, not an immediate exposure.",
  },
  PR_NOT_UNDERSTOOD: {
    severity: "MEDIUM",
    rationale:
      "A procedure or sign that cannot be read by the people it governs is not a control for them at all.",
  },

  // ── STOP-6 Housekeeping / Orderliness ────────────────────────────────────
  HK_NOT_CLEAN_AS_YOU_GO: {
    severity: "LOW",
    rationale: "Clean-as-you-go not followed — accumulates into a hazard rather than being one yet.",
  },
  HK_OBSTRUCTING_PATH: {
    severity: "MEDIUM",
    rationale: "Materials left in a walkway create a trip exposure for everyone who passes.",
  },
  HK_IMPROPER_WASTE_DISPOSAL: {
    severity: "LOW",
    rationale: "Improper waste disposal is primarily an environmental and orderliness issue.",
  },
  HK_SPILL_NOT_CLEANED: {
    severity: "MEDIUM",
    rationale: "An uncleaned spill is an active slip exposure and may also be a chemical contact hazard.",
  },
  HK_BLOCKED_EGRESS: {
    severity: "HIGH",
    rationale:
      "A blocked escape route removes the evacuation control for everyone in the area — the exposure is the emergency, not the clutter.",
  },
  HK_POOR_LIGHTING: {
    severity: "LOW",
    rationale: "Poor lighting degrades hazard recognition but is not itself an energy source.",
  },
  HK_CLUTTER_DEBRIS: {
    severity: "LOW",
    rationale: "Clutter and debris in the work area — housekeeping, correctable on the spot.",
  },
  HK_DAMAGED_FLOORING: {
    severity: "MEDIUM",
    rationale:
      "A damaged walking surface is a standing trip exposure that individual care cannot fully mitigate.",
  },
};

type SeedRule = {
  observationType: "ACT" | "CONDITION";
  category: string;
  subCategory: string;
  baseSeverity: Severity;
  rationale: string;
  subCategoryLabel: string;
};

/** One rule per active taxonomy pair, built FROM the taxonomy seed. */
export function buildRules(): { rules: SeedRule[]; missing: string[] } {
  const rules: SeedRule[] = [];
  const missing: string[] = [];

  for (const row of buildRows()) {
    const entry = RULES[row.subCategoryCode];
    if (!entry) {
      missing.push(`${row.observationType}/${row.categoryCode}/${row.subCategoryCode}`);
      continue;
    }
    rules.push({
      observationType: row.observationType,
      category: row.categoryCode,
      subCategory: row.subCategoryCode,
      baseSeverity: entry.severity,
      rationale: entry.rationale,
      subCategoryLabel: row.subCategoryLabel,
    });
  }
  return { rules, missing };
}

async function main() {
  const { rules, missing } = buildRules();

  // A rule authored for a code the taxonomy no longer has is a hard stop: it
  // would sit in the table forever, matching nothing, looking like coverage.
  const taxonomyCodes = new Set(buildRows().map((r) => r.subCategoryCode));
  const orphans = Object.keys(RULES).filter((code) => !taxonomyCodes.has(code));
  if (orphans.length > 0) {
    throw new Error(
      `RULES contains ${orphans.length} sub-category code(s) absent from the taxonomy: ` +
        `${orphans.join(", ")}. Remove them or add them to seed-observation-taxonomy.ts.`
    );
  }

  console.log(
    `Seeding SeverityMatrixRule — ${rules.length} rules across both axes` +
      `${FORCE ? " — FORCE, overwriting edits" : ""}…`
  );

  let created = 0;
  let updated = 0;
  let kept = 0;

  for (const rule of rules) {
    const existing = await prisma.$queryRawUnsafe<{ id: string; baseSeverity: string }[]>(
      `SELECT "id", "baseSeverity" FROM "SeverityMatrixRule"
        WHERE "observationType" = $1 AND "category" = $2 AND "subCategory" = $3
          AND "isActive" = true`,
      rule.observationType,
      rule.category,
      rule.subCategory
    );

    if (existing.length === 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SeverityMatrixRule"
           ("id", "observationType", "category", "subCategory", "baseSeverity",
            "rationale", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        randomUUID().replace(/-/g, ""),
        rule.observationType,
        rule.category,
        rule.subCategory,
        rule.baseSeverity,
        rule.rationale
      );
      created++;
      continue;
    }

    if (existing[0].baseSeverity === rule.baseSeverity) {
      kept++;
      continue;
    }
    if (!FORCE) {
      kept++;
      console.log(
        `  · ${rule.subCategory.padEnd(28)} left at ${existing[0].baseSeverity.padEnd(8)} ` +
          `(seed baseline is ${rule.baseSeverity}; pass --force to reset)`
      );
      continue;
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "SeverityMatrixRule"
          SET "baseSeverity" = $1, "rationale" = $2, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $3`,
      rule.baseSeverity,
      rule.rationale,
      existing[0].id
    );
    updated++;
    console.log(
      `  ~ ${rule.subCategory.padEnd(28)} ${existing[0].baseSeverity} → ${rule.baseSeverity}`
    );
  }

  // Coverage report — the number that matters is "0 uncovered pairs", because
  // an uncovered pair silently degrades to today's fully-manual behaviour.
  const bySeverity: Record<string, number> = {};
  for (const r of rules) bySeverity[r.baseSeverity] = (bySeverity[r.baseSeverity] ?? 0) + 1;

  console.log(`\n✅  ${created} created, ${updated} updated, ${kept} unchanged.`);
  console.log(
    "    Distribution: " +
      ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        .map((s) => `${s} ${bySeverity[s] ?? 0}`)
        .join("  ")
  );

  if (missing.length > 0) {
    console.log(
      `\n⚠   ${missing.length} taxonomy pair(s) have NO severity rule and will fall back to ` +
        "fully manual selection:\n" +
        missing.map((m) => `      ${m}`).join("\n")
    );
  } else {
    console.log("    Coverage: every active taxonomy pair has a rule.");
  }
  console.log("\n    Next: npm run db:seed-area-hazard-tiers");
}

// Only seed when run directly — this backend's .env points at the live
// database, so an import must never be able to trigger a write.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error("❌  Seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
