// Populate FLRA sub-records for every FLRA: job steps + step hazards (with the
// 5x5 risk ratings), team members, crew sign-offs, and fitness declarations.
// Hazard text/controls are taken from each FLRA's legacy `hazards` JSON so the
// content matches the actual FLRA. Idempotent: clears sub-records first.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const PHASES = [
  "Pre-job preparation, isolation & access",
  "Equipment setup, positioning & connection",
  "Execution of the task under controls",
  "Completion, housekeeping & area handover",
];
const lvl = (s: number) => (s <= 4 ? "LOW" : s <= 9 ? "MEDIUM" : s <= 15 ? "HIGH" : "CRITICAL");
const IL = [3, 4, 3, 2], ISv = [4, 3, 3, 4], RL = [1, 2, 1, 1], RSv = [2, 2, 2, 3];

async function main() {
  const cats = await prisma.masterItem.findMany({ where: { type: "HAZARD_CATEGORY" }, select: { id: true } });
  const catIds = cats.map((c) => c.id);

  const users = await prisma.user.findMany({ select: { id: true, role: true, plantId: true } });
  const crewByPlant = new Map<string, string[]>();
  const CREW_ROLES = new Set(["WORKER", "CONTRACTOR_WORKMAN", "PERMIT_ISSUER", "SUPERVISOR", "MAINTENANCE_HEAD"]);
  for (const u of users) {
    if (!u.plantId || !CREW_ROLES.has(u.role)) continue;
    if (!crewByPlant.has(u.plantId)) crewByPlant.set(u.plantId, []);
    crewByPlant.get(u.plantId)!.push(u.id);
  }

  const flras = await prisma.fLRA.findMany({
    select: { id: true, plantId: true, leaderId: true, date: true, hazards: true },
  });
  console.log(`FLRAs to populate: ${flras.length}`);

  let n = 0;
  for (const f of flras) {
    let haz: { hazard?: string; controlMeasure?: string }[] = [];
    try { const p = JSON.parse(f.hazards || "[]"); if (Array.isArray(p)) haz = p; } catch {}
    if (haz.length === 0) haz = [{ hazard: "General task hazards", controlMeasure: "Standard controls, PPE and toolbox talk applied." }];

    // crew = up to 4 plant users excluding the leader
    const pool = (crewByPlant.get(f.plantId) ?? []).filter((id) => id !== f.leaderId);
    const crew = pool.slice(0, 4);

    await prisma.$transaction([
      prisma.fLRATeamMember.deleteMany({ where: { flraId: f.id } }),
      prisma.fLRACrewSignature.deleteMany({ where: { flraId: f.id } }),
      prisma.fLRAFitnessDeclaration.deleteMany({ where: { flraId: f.id } }),
      prisma.fLRAJobStep.deleteMany({ where: { flraId: f.id } }), // cascades step hazards
    ]);

    if (crew.length) {
      await prisma.fLRATeamMember.createMany({ data: crew.map((uid) => ({ flraId: f.id, userId: uid })), skipDuplicates: true });
      await prisma.fLRACrewSignature.createMany({
        data: crew.map((uid) => ({ flraId: f.id, userId: uid, signed: true, signedAt: f.date, trainingValidAtSignature: true })),
        skipDuplicates: true,
      });
      await prisma.fLRAFitnessDeclaration.createMany({
        data: crew.map((uid) => ({ flraId: f.id, userId: uid, isFit: true, hadAdequateRest: true, underInfluenceCheck: true, hasMedicalCondition: false, declaredAt: f.date })),
        skipDuplicates: true,
      });
    }

    const numSteps = Math.min(4, Math.max(1, haz.length));
    // group hazards by target step
    const buckets: { hazard?: string; controlMeasure?: string }[][] = Array.from({ length: numSteps }, () => []);
    haz.forEach((h, j) => buckets[j % numSteps].push(h));

    for (let s = 0; s < numSteps; s++) {
      const stepHaz = buckets[s];
      if (stepHaz.length === 0) continue;
      await prisma.fLRAJobStep.create({
        data: {
          flraId: f.id,
          sequence: s + 1,
          stepDescription: PHASES[s],
          hazards: {
            create: stepHaz.map((h, k) => {
              const iL = IL[k % 4], iS = ISv[k % 4], rL = RL[k % 4], rS = RSv[k % 4];
              const iScore = iL * iS, rScore = rL * rS;
              return {
                hazardDescription: h.hazard || "Task hazard",
                hazardCategory: catIds.length ? catIds[(s + k) % catIds.length] : "MECHANICAL",
                initialLikelihood: iL, initialSeverity: iS, initialRiskScore: iScore, initialRiskLevel: lvl(iScore),
                controlMeasures: h.controlMeasure || "Engineering controls, PPE, permit and toolbox talk.",
                residualLikelihood: rL, residualSeverity: rS, residualRiskScore: rScore, residualRiskLevel: lvl(rScore),
              };
            }),
          },
        },
      });
    }
    n++;
    if (n % 50 === 0) console.log(`  ...${n} done`);
  }
  console.log(`✅  FLRA detail populated for ${n} FLRAs.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
