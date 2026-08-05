// Person-risk demo flags — makes /training-intelligence visibly populated the
// moment it opens, WITHOUT fabricating data: it picks workers who are genuinely
// repeat-involved in real events, builds each WorkerTrainingFlag from their
// actual incident / near-miss / observation records, infers the training their
// events point to (via the seeded HazardToSkillMappings), and creates the
// matching TrainingAssignments. Idempotent — skips a worker who already has a
// flag, reuses open assignments. Run AFTER db:seed-training-engine.
//   npm run db:seed-person-risk-demo
//
// (This is the same logic the person_risk_scan job runs; seeding a few concrete
// flags just avoids waiting for the 6h job / a manual scan for a demo.)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WINDOW_DAYS = 365;
const MAX_WORKERS = 3;
const EXCLUDED_ROLES = new Set(["WITNESS", "RESPONDER"]);
const WEIGHT: Record<string, Record<string, number>> = {
  INCIDENT: { LOW: 1, MEDIUM: 2, HIGH: 4, CRITICAL: 8 },
  NEAR_MISS: { LOW: 0.5, MEDIUM: 1, HIGH: 2, CRITICAL: 4 },
  OBSERVATION: { LOW: 0.5, MEDIUM: 1, HIGH: 2, CRITICAL: 3 },
};

type Ev = {
  module: string; id: string; ref: string; date: string | null;
  role: string | null; severity: string | null; sif: boolean; plantId: string; category?: string | null;
};

const weight = (m: string, s: string | null) => WEIGHT[m]?.[String(s || "").toUpperCase()] ?? 1;
const bandFor = (score: number) => (score >= 10 ? "critical" : score >= 6 ? "high" : "elevated");

async function main() {
  console.log("→ Seeding person-risk demo flags from REAL event involvement…\n");
  const since = new Date(Date.now() - WINDOW_DAYS * 864e5);
  const perUser = new Map<string, Ev[]>();
  const add = (uid: string | null, ev: Ev) => {
    if (!uid) return;
    const a = perUser.get(uid) || [];
    a.push(ev);
    perUser.set(uid, a);
  };

  // ── Incidents (involved party, not witness/responder) ──
  const ips = await prisma.incidentPerson.findMany({
    where: { userId: { not: null } },
    select: {
      userId: true, role: true, injurySeverity: true,
      incident: { select: { id: true, number: true, severity: true, type: true, plantId: true, createdAt: true } },
    },
    take: 4000,
  });
  for (const p of ips) {
    const i = p.incident;
    if (!i || !i.createdAt || i.createdAt < since) continue;
    if (EXCLUDED_ROLES.has(String(p.role || "").toUpperCase())) continue;
    const sif =
      ["FATALITY", "HIPO_NEAR_MISS"].includes(String(i.type || "").toUpperCase()) ||
      String(i.severity || "").toUpperCase() === "CRITICAL" ||
      String(p.injurySeverity || "").toUpperCase() === "FATAL";
    add(p.userId, { module: "INCIDENT", id: i.id, ref: i.number, date: i.createdAt.toISOString(), role: p.role, severity: i.severity, sif, plantId: i.plantId });
  }

  // ── Near misses (involved + affected) ──
  const nmInv = await prisma.nearMissPersonInvolved.findMany({
    select: { userId: true, nearMiss: { select: { id: true, number: true, potentialSeverity: true, plantId: true, createdAt: true } } },
    take: 4000,
  });
  const nmAff = await prisma.nearMissPersonAffected.findMany({
    select: { userId: true, nearMiss: { select: { id: true, number: true, potentialSeverity: true, plantId: true, createdAt: true } } },
    take: 4000,
  });
  const nmSeen = new Set<string>();
  for (const p of [...nmInv, ...nmAff]) {
    const n = p.nearMiss;
    if (!n || !n.createdAt || n.createdAt < since) continue;
    const key = `${p.userId}:${n.id}`;
    if (nmSeen.has(key)) continue;
    nmSeen.add(key);
    const sif = String(n.potentialSeverity || "").toUpperCase() === "CRITICAL";
    add(p.userId, { module: "NEAR_MISS", id: n.id, ref: n.number, date: n.createdAt.toISOString(), role: "involved", severity: n.potentialSeverity, sif, plantId: n.plantId });
  }

  // ── Observations (attributed via responsiblePersonId) ──
  const obs = await prisma.observation.findMany({
    where: { responsiblePersonId: { not: null } },
    select: { id: true, number: true, severity: true, category: true, plantId: true, date: true, responsiblePersonId: true },
    take: 4000,
  });
  for (const o of obs) {
    if (!o.date || o.date < since) continue;
    const sif = String(o.severity || "").toUpperCase() === "CRITICAL";
    add(o.responsiblePersonId, { module: "OBSERVATION", id: o.id, ref: o.number, date: o.date.toISOString(), role: "responsible", severity: String(o.severity), sif, plantId: o.plantId, category: String(o.category) });
  }

  // ── Pick repeat-involved workers (≥2 distinct events), highest risk first ──
  const candidates = [...perUser.entries()]
    .map(([uid, evs]) => {
      const seen = new Set<string>();
      const dedup = evs.filter((e) => {
        const k = `${e.module}:${e.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const score = dedup.reduce((s, e) => s + weight(e.module, e.severity) * (e.sif ? 2 : 1), 0);
      return { uid, evs: dedup, score };
    })
    .filter((c) => c.evs.length >= 2)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    console.log("  ⚠ No worker has ≥2 events in the window — nothing to seed.");
    console.log("     Run POST /api/training-engine/person-risk/scan once events accumulate.");
    return;
  }

  // Mappings + content for competency inference / assignment content.
  const catMappings = await prisma.hazardToSkillMapping.findMany({
    where: { classificationField: "category", isActive: true, isDeleted: false },
    select: { classificationValue: true, competencyId: true },
  });
  const catToComp = new Map<string, string>();
  for (const m of catMappings) if (!catToComp.has(m.classificationValue)) catToComp.set(m.classificationValue, m.competencyId);
  const contentComps = await prisma.trainingContent.findMany({
    where: { isActive: true, isDeleted: false, vendorId: null },
    select: { competencyId: true },
    distinct: ["competencyId"],
    take: 8,
  });
  const fallbackCompIds = contentComps.map((c) => c.competencyId);

  let created = 0;
  for (const c of candidates.slice(0, MAX_WORKERS)) {
    try {
      if (await prisma.workerTrainingFlag.findUnique({ where: { personUserId: c.uid } })) {
        console.log(`  • flag already exists for ${c.uid} — skip`);
        continue;
      }
      const plantCount = new Map<string, number>();
      for (const e of c.evs) plantCount.set(e.plantId, (plantCount.get(e.plantId) || 0) + 1);
      const plantId = [...plantCount.entries()].sort((a, b) => b[1] - a[1])[0][0];

      const counts: Record<string, number> = { INCIDENT: 0, NEAR_MISS: 0, OBSERVATION: 0 };
      let sif = 0;
      for (const e of c.evs) {
        counts[e.module]++;
        if (e.sif) sif++;
      }
      const score = Math.round(c.score * 10) / 10;
      const rb = bandFor(score);

      // recommended competencies: from the person's observation categories, topped up
      const recIds = new Set<string>();
      for (const e of c.evs) if (e.module === "OBSERVATION" && e.category) { const cid = catToComp.get(e.category); if (cid) recIds.add(cid); }
      for (const fid of fallbackCompIds) { if (recIds.size >= 2) break; recIds.add(fid); }
      const compIds = [...recIds].slice(0, 3);
      const comps = compIds.length
        ? await prisma.competency.findMany({ where: { id: { in: compIds } }, select: { id: true, name: true } })
        : [];
      const compName = new Map(comps.map((x) => [x.id, x.name]));
      const recommended = compIds.map((id) => ({
        competencyId: id,
        name: compName.get(id) || id,
        fromEvents: c.evs.filter((e) => e.module === "OBSERVATION" && e.category && catToComp.get(e.category) === id).length || 1,
      }));

      // assignments (reuse open ones; attach primary content)
      const mandatory = rb === "high" || rb === "critical";
      const assignmentIds: string[] = [];
      for (const cid of compIds) {
        const open = await prisma.trainingAssignment.findFirst({
          where: { personUserId: c.uid, competencyId: cid, status: { in: ["assigned", "in_progress", "overdue", "escalated"] }, isDeleted: false },
          select: { id: true },
        });
        if (open) { assignmentIds.push(open.id); continue; }
        const content =
          (await prisma.trainingContent.findFirst({ where: { competencyId: cid, isActive: true, isDeleted: false, isPrimary: true }, select: { id: true } })) ||
          (await prisma.trainingContent.findFirst({ where: { competencyId: cid, isActive: true, isDeleted: false }, select: { id: true } }));
        const a = await prisma.trainingAssignment.create({
          data: {
            plantId, personUserId: c.uid, competencyId: cid, source: "person_risk", ruleType: "person_risk",
            provenance: { ruleType: "person_risk", riskBand: rb, riskScore: score, totalEvents: c.evs.length, contributingRefs: c.evs.map((e) => e.ref).slice(0, 5) },
            contentId: content?.id ?? null, dueDate: new Date(Date.now() + 30 * 864e5),
            status: "assigned", isMandatory: mandatory, dismissible: !mandatory, escalationFlag: rb === "critical", createdBy: "seed",
          },
          select: { id: true },
        });
        assignmentIds.push(a.id);
      }

      const now = new Date();
      await prisma.workerTrainingFlag.create({
        data: {
          plantId, personUserId: c.uid, riskScore: score, riskBand: rb, windowDays: WINDOW_DAYS,
          incidentCount: counts.INCIDENT, nearMissCount: counts.NEAR_MISS, observationCount: counts.OBSERVATION,
          sifCount: sif, totalEvents: c.evs.length,
          contributingRecords: c.evs.map((e) => ({ module: e.module, id: e.id, ref: e.ref, date: e.date, role: e.role, severity: e.severity, sif: e.sif })),
          recommendedCompetencies: recommended, mappedCompetencyIds: compIds, assignmentIds,
          status: assignmentIds.length ? "training_assigned" : "flagged",
          flaggedAt: now, lastEvaluatedAt: now,
        },
      });
      created++;
      console.log(`  ✓ ${c.uid}: band=${rb} score=${score} events=${c.evs.length} (I${counts.INCIDENT}/N${counts.NEAR_MISS}/O${counts.OBSERVATION}, SIF ${sif}) → ${assignmentIds.length} assignment(s)`);
    } catch (e) {
      console.error(`  ✗ ${c.uid}:`, e);
    }
  }
  console.log(`\n✅ person-risk demo flags created: ${created} (of ${candidates.length} repeat-involved workers found)`);
}

main()
  .catch((e) => {
    console.error("❌ seed-person-risk-demo failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
