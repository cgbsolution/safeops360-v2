// Populate incident-investigation sub-records (Persons Involved, Timeline,
// Witness Statements, Evidence, Documents Reviewed, Equipment, Investigation
// Team) for every investigated incident (status != REPORTED). Apparel-themed,
// derived per-incident from the incident's own plant/date/injury fields.
// Idempotent: clears each incident's sub-records before re-creating.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const pick = <T,>(arr: T[], i: number): T | undefined => (arr.length ? arr[i % arr.length] : undefined);

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true, plantId: true, designation: true } });
  const equipment = await prisma.equipment.findMany({ select: { id: true, plantId: true } });

  const byPlantRole = new Map<string, Map<string, typeof users>>();
  const allByPlant = new Map<string, typeof users>();
  for (const u of users) {
    if (!u.plantId) continue;
    if (!allByPlant.has(u.plantId)) allByPlant.set(u.plantId, []);
    allByPlant.get(u.plantId)!.push(u);
    if (!byPlantRole.has(u.plantId)) byPlantRole.set(u.plantId, new Map());
    const m = byPlantRole.get(u.plantId)!;
    if (!m.has(u.role)) m.set(u.role, []);
    m.get(u.role)!.push(u);
  }
  const eqByPlant = new Map<string, typeof equipment>();
  for (const e of equipment) {
    if (!e.plantId) continue;
    if (!eqByPlant.has(e.plantId)) eqByPlant.set(e.plantId, []);
    eqByPlant.get(e.plantId)!.push(e);
  }
  const userByRole = (plantId: string, roles: string[], exclude: Set<string>) => {
    const m = byPlantRole.get(plantId);
    for (const r of roles) {
      const list = (m?.get(r) ?? []).filter((u) => !exclude.has(u.id));
      if (list.length) return list[0];
    }
    const any = (allByPlant.get(plantId) ?? []).filter((u) => !exclude.has(u.id));
    return any[0];
  };

  const incidents = await prisma.incident.findMany({
    where: { status: { not: "REPORTED" } },
    select: { id: true, number: true, type: true, plantId: true, location: true, specificLocation: true,
      injuredPersonName: true, injuredPersonDesignation: true, bodyPart: true, natureOfInjury: true,
      lostDays: true, occurredAt: true, date: true, severity: true },
  });
  console.log(`Investigated incidents to populate: ${incidents.length}`);

  let n = 0;
  for (const inc of incidents) {
    const pid = inc.plantId;
    const base = new Date(inc.occurredAt ?? inc.date ?? "2026-01-01T09:00:00Z");
    const at = (mins: number) => new Date(base.getTime() + mins * 60000);
    const used = new Set<string>();
    const lead = userByRole(pid, ["HSE_MANAGER", "SAFETY_OFFICER"], used); if (lead) used.add(lead.id);
    const m2 = userByRole(pid, ["SAFETY_OFFICER", "HSE_MANAGER"], used); if (m2) used.add(m2.id);
    const m3 = userByRole(pid, ["MAINTENANCE_HEAD", "SUPERVISOR", "DEPARTMENT_HEAD"], used); if (m3) used.add(m3.id);
    const supervisor = userByRole(pid, ["SUPERVISOR", "DEPARTMENT_HEAD"], used); if (supervisor) used.add(supervisor.id);
    const operator = userByRole(pid, ["WORKER", "CONTRACTOR_WORKMAN", "PERMIT_ISSUER"], used); if (operator) used.add(operator.id);
    const witnessU = userByRole(pid, ["WORKER", "CONTRACTOR_WORKMAN", "SUPERVISOR"], used); if (witnessU) used.add(witnessU.id);
    const collector = m2 ?? lead;
    const loc = inc.specificLocation || inc.location || "the production line";

    // clear (idempotent)
    await prisma.$transaction([
      prisma.incidentInvestigationMember.deleteMany({ where: { incidentId: inc.id } }),
      prisma.incidentPerson.deleteMany({ where: { incidentId: inc.id } }),
      prisma.incidentTimelineEvent.deleteMany({ where: { incidentId: inc.id } }),
      prisma.incidentWitnessStatement.deleteMany({ where: { incidentId: inc.id } }),
      prisma.incidentEvidence.deleteMany({ where: { incidentId: inc.id } }),
      prisma.incidentDocumentReview.deleteMany({ where: { incidentId: inc.id } }),
      prisma.incidentEquipment.deleteMany({ where: { incidentId: inc.id } }),
    ]);

    // Investigation team
    const team = [
      lead && { incidentId: inc.id, userId: lead.id, role: "LEAD" },
      m2 && { incidentId: inc.id, userId: m2.id, role: "MEMBER" },
      m3 && { incidentId: inc.id, userId: m3.id, role: "MEMBER" },
    ].filter(Boolean) as any[];
    if (team.length) await prisma.incidentInvestigationMember.createMany({ data: team, skipDuplicates: true });

    // Persons involved
    const injured = inc.lostDays && inc.lostDays > 0;
    const persons: any[] = [{
      incidentId: inc.id,
      externalName: inc.injuredPersonName ?? operator?.name ?? "Line Operator",
      role: "VICTIM",
      isContractor: false,
      isInjured: true,
      bodyPartAffected: inc.bodyPart ?? "Right hand",
      natureOfInjury: inc.natureOfInjury ?? "Minor laceration",
      injurySeverity: injured ? "MAJOR" : "MINOR",
      treatment: injured ? "First aid on site, referred to OHC; sutures and dressing." : "First aid at OHC; returned to work same shift.",
      daysOff: inc.lostDays ?? 0,
    }];
    if (operator) persons.push({ incidentId: inc.id, userId: operator.id, role: "OPERATOR", isInjured: false });
    if (supervisor) persons.push({ incidentId: inc.id, userId: supervisor.id, role: "SUPERVISOR", isInjured: false });
    await prisma.incidentPerson.createMany({ data: persons });

    // Timeline
    const timeline = [
      { incidentId: inc.id, sequence: 1, timestamp: at(-45), source: "INTERVIEW", description: `Normal production in progress at ${loc}; operators running the shift schedule.` },
      { incidentId: inc.id, sequence: 2, timestamp: at(-15), source: "WITNESS", description: `Precursor condition noted — machine guard/interlock not fully engaged and housekeeping (loose fabric/lint) around the workstation.` },
      { incidentId: inc.id, sequence: 3, timestamp: at(0), source: "CCTV", description: `Event occurred: ${inc.type ?? "incident"} at ${loc}. ${inc.injuredPersonName ?? "Operator"} affected.`, sourceReference: "Floor CCTV Cam-07" },
      { incidentId: inc.id, sequence: 4, timestamp: at(6), source: "WITNESS", description: `Emergency stop pressed; first aid initiated and area isolated by the line supervisor.` },
      { incidentId: inc.id, sequence: 5, timestamp: at(35), source: "DOCUMENT", description: `Shift supervisor notified HSE; investigation team constituted and evidence preserved.`, sourceReference: inc.number },
    ];
    await prisma.incidentTimelineEvent.createMany({ data: timeline });

    // Witness statements
    if (witnessU) {
      await prisma.incidentWitnessStatement.create({ data: {
        incidentId: inc.id, witnessUserId: witnessU.id, witnessName: witnessU.name, witnessRole: witnessU.designation ?? "Operator",
        statementText: `I was working on the adjacent station. I heard the machine and saw ${inc.injuredPersonName ?? "the operator"} pull back. We pressed the e-stop immediately and called the supervisor for first aid.`,
        takenById: (lead ?? m2)!.id, takenAt: at(90), language: "English",
      } });
    }
    if (supervisor) {
      await prisma.incidentWitnessStatement.create({ data: {
        incidentId: inc.id, witnessUserId: supervisor.id, witnessName: supervisor.name, witnessRole: "Line Supervisor",
        statementText: `Workstation was running the standard style. After the event I isolated the machine, accounted for all operators on the line, and secured the area for investigation.`,
        takenById: (lead ?? m2)!.id, takenAt: at(110), language: "English",
      } });
    }

    // Evidence
    await prisma.incidentEvidence.createMany({ data: [
      { incidentId: inc.id, category: "PHOTO", title: "Site photographs of the workstation", description: `Photographs of ${loc} showing machine/guard condition and the position at time of event.`, collectedById: collector?.id, collectedAt: at(60), preservedFor: "internal" },
      { incidentId: inc.id, category: "CCTV", title: "Production-floor CCTV footage", description: "Footage covering 30 minutes before and after the event (Cam-07).", collectedById: collector?.id, collectedAt: at(75), preservedFor: "regulatory" },
      { incidentId: inc.id, category: "EQUIPMENT_DATA", title: "Machine maintenance & PM log", description: "Preventive-maintenance history and last guard/interlock inspection record for the machine.", collectedById: collector?.id, collectedAt: at(120), preservedFor: "internal" },
    ] });

    // Documents reviewed
    await prisma.incidentDocumentReview.createMany({ data: [
      { incidentId: inc.id, documentType: "SOP", documentReference: `SOP for the ${inc.type ?? "operation"} at ${loc}`, complianceFinding: "NON_COMPLIANT", reviewNotes: "SOP exists but step on guard verification before start-up was not consistently followed." },
      { incidentId: inc.id, documentType: "TRAINING_RECORD", documentReference: `Operator training & competency record — ${inc.injuredPersonName ?? "operator"}`, complianceFinding: "COMPLIANT", reviewNotes: "Operator trained on machine and PPE; refresher due within validity." },
      { incidentId: inc.id, documentType: "INSPECTION_RECORD", documentReference: "Last machine guarding / safety inspection checklist", complianceFinding: "NON_COMPLIANT", reviewNotes: "Guard interlock noted as 'monitor' in prior inspection; corrective action not closed in time." },
    ] });

    // Equipment involved (only if the plant has equipment rows)
    const eq = pick(eqByPlant.get(pid) ?? [], n);
    if (eq) {
      await prisma.incidentEquipment.create({ data: {
        incidentId: inc.id, equipmentId: eq.id, involvement: "INADEQUATE_GUARDING", repairStatus: "REPAIRED",
      } });
    }
    n++;
    if (n % 25 === 0) console.log(`  ...${n} done`);
  }
  console.log(`✅  Investigation detail populated for ${n} incidents.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
