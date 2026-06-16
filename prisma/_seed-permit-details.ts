// Populate Permit sub-records for every permit: work crew, isolation points,
// the approval AUDIT TRAIL (Issuer → Safety → Plant Head [→ Closure]), and gas-
// test readings (for gas-test permits). Idempotent: clears sub-records first.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, role: true, plantId: true } });
  const byPlantRole = new Map<string, Map<string, string[]>>();
  const allByPlant = new Map<string, string[]>();
  for (const u of users) {
    if (!u.plantId) continue;
    if (!allByPlant.has(u.plantId)) allByPlant.set(u.plantId, []);
    allByPlant.get(u.plantId)!.push(u.id);
    if (!byPlantRole.has(u.plantId)) byPlantRole.set(u.plantId, new Map());
    const m = byPlantRole.get(u.plantId)!;
    if (!m.has(u.role)) m.set(u.role, []);
    m.get(u.role)!.push(u.id);
  }
  const byRole = (pid: string, roles: string[], exclude: Set<string>) => {
    const m = byPlantRole.get(pid);
    for (const r of roles) { const l = (m?.get(r) ?? []).filter((x) => !exclude.has(x)); if (l.length) return l[0]; }
    return (allByPlant.get(pid) ?? []).filter((x) => !exclude.has(x))[0];
  };
  const crewOf = (pid: string, exclude: Set<string>) => {
    const m = byPlantRole.get(pid);
    const out: string[] = [];
    for (const r of ["WORKER", "CONTRACTOR_WORKMAN", "SUPERVISOR", "PERMIT_ISSUER", "MAINTENANCE_HEAD"]) {
      for (const id of m?.get(r) ?? []) if (!exclude.has(id) && !out.includes(id)) out.push(id);
    }
    return out.slice(0, 4);
  };

  const permits = await prisma.permit.findMany({
    select: { id: true, type: true, plantId: true, issuerId: true, receiverId: true, originatorId: true,
      validFrom: true, validTo: true, gasTestRequired: true, status: true, location: true, specificLocation: true },
  });
  console.log(`Permits to populate: ${permits.length}`);

  let n = 0;
  for (const p of permits) {
    const pid = p.plantId;
    const base = new Date(p.validFrom ?? "2026-01-01T08:00:00Z");
    const at = (m: number) => new Date(base.getTime() + m * 60000);
    const used = new Set<string>([p.issuerId].filter(Boolean) as string[]);
    const safety = byRole(pid, ["SAFETY_OFFICER", "HSE_MANAGER"], used); if (safety) used.add(safety);
    const plantHead = byRole(pid, ["PLANT_HEAD", "DEPARTMENT_HEAD"], used); if (plantHead) used.add(plantHead);
    const crew = crewOf(pid, used);

    await prisma.$transaction([
      prisma.permitCrewMember.deleteMany({ where: { permitId: p.id } }),
      prisma.permitIsolation.deleteMany({ where: { permitId: p.id } }),
      prisma.permitApproval.deleteMany({ where: { permitId: p.id } }),
      prisma.permitGasTestReading.deleteMany({ where: { permitId: p.id } }),
    ]);

    // Work crew
    if (crew.length) {
      await prisma.permitCrewMember.createMany({
        data: crew.map((uid, i) => ({ permitId: p.id, userId: uid, role: i === 0 ? "SUPERVISOR" : "WORKER",
          trainingValidAtIssuance: true, medicalValidAtIssuance: true, contractorActiveAtIssuance: true, ppeValidAtIssuance: true, addedAt: at(-30) })),
        skipDuplicates: true,
      });
    }

    // Isolation points
    await prisma.permitIsolation.createMany({ data: [
      { permitId: p.id, isolationType: "Electrical", description: "Main drive isolated and locked out at the MCC.", isolationPointTag: "MCC-ISO-01", lotoTagNumber: `LOTO-${p.id.slice(-5).toUpperCase()}`, isolationVerifiedAt: at(-20), isolationVerifiedById: p.issuerId },
      { permitId: p.id, isolationType: "Mechanical", description: "Stored energy released; guards/coupling secured.", isolationPointTag: "MECH-ISO-02", isolationVerifiedAt: at(-18), isolationVerifiedById: p.issuerId },
    ] });

    // Approval audit trail
    const approvals: any[] = [{ permitId: p.id, step: "ISSUER", approverId: p.issuerId, decision: "APPROVED", comments: "Scope, isolations and controls verified at issuance.", decidedAt: at(-15) }];
    if (safety) approvals.push({ permitId: p.id, step: "SAFETY_OFFICER", approverId: safety, decision: "APPROVED", comments: "HSE review complete; PPE and gas-test plan adequate.", conditions: "Maintain continuous gas monitoring; fire watch to remain on site.", decidedAt: at(-10) });
    if (plantHead) approvals.push({ permitId: p.id, step: "PLANT_HEAD", approverId: plantHead, decision: "APPROVED", comments: "Approved for execution within validity window.", decidedAt: at(-5) });
    if (p.status === "CLOSED" && safety) approvals.push({ permitId: p.id, step: "CLOSURE", approverId: safety, decision: "APPROVED", comments: "Worksite restored, isolations removed, area handed back. Permit closed.", decidedAt: at(180) });
    await prisma.permitApproval.createMany({ data: approvals });

    // Gas-test readings (for gas-test permits)
    if (p.gasTestRequired) {
      const recBy = safety ?? p.issuerId;
      const mk = (co: number) => [
        { parameter: "O2", value: 20.9, unit: "%", isWithinLimit: true },
        { parameter: "LEL", value: 0, unit: "%", isWithinLimit: true },
        { parameter: "H2S", value: 0, unit: "ppm", isWithinLimit: true },
        { parameter: "CO", value: co, unit: "ppm", isWithinLimit: true },
      ];
      await prisma.permitGasTestReading.createMany({ data: [
        { permitId: p.id, recordedById: recBy, recordedAt: at(-12), readings: mk(2), isExceedance: false, isPreEntry: true, instrumentSerial: "GASMON-4G-2207", refreshDueBy: at(108) },
        { permitId: p.id, recordedById: recBy, recordedAt: at(108), readings: mk(3), isExceedance: false, isPreEntry: false, instrumentSerial: "GASMON-4G-2207", refreshDueBy: at(228) },
      ] });
    }
    n++;
    if (n % 75 === 0) console.log(`  ...${n} done`);
  }
  console.log(`✅  Permit detail populated for ${n} permits.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
