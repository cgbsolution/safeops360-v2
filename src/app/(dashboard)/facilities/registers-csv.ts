// Group-register CSV builders (Section 4). Shared by the W-01 register view and
// the Facilities Reports tile so the column sets + group totals rows can never
// drift between the on-screen register and the downloadable file.

import { toCsv, type Cell } from "./csv";
import {
  fmtDate,
  SOCIAL_FLAG_LABEL,
  titleCase,
  type BuildingRegisterResponse,
  type CertificationRegisterResponse,
  type ComplianceFlag,
  type SocialComplianceRegisterRow,
  type SocialComplianceRollup,
} from "./lib";

const FLAG = (f: ComplianceFlag) => SOCIAL_FLAG_LABEL[f];
const r1 = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

// ── 4.1 Workforce & SA8000 register ──────────────────────────────────────────
// One column definition drives the header, every data row, and the group totals
// row. `total` cells are filled from the rollup; the rest stay blank.
type WfCol = {
  h: string;
  get: (r: SocialComplianceRegisterRow) => Cell;
  total?: (g: SocialComplianceRollup) => Cell;
};

export const WORKFORCE_CSV_COLUMNS: WfCol[] = [
  { h: "Factory Code", get: (r) => r.factoryCode, total: () => "TOTAL / GROUP" },
  { h: "Factory Name", get: (r) => r.factoryName },
  { h: "State", get: (r) => r.state },
  { h: "City", get: (r) => r.city },
  { h: "As-Of Date", get: (r) => fmtDate(r.asOfDate) },
  { h: "Total Workforce", get: (r) => r.totalWorkforce, total: (g) => g.totalWorkforce },
  { h: "Permanent", get: (r) => r.permanentCount, total: (g) => g.permanentCount },
  { h: "Permanent %", get: (r) => r.permanentPct, total: (g) => r1(g.permanentCount, g.totalWorkforce) },
  { h: "Contract", get: (r) => r.contractCount, total: (g) => g.contractCount },
  { h: "Contract %", get: (r) => r.contractPct, total: (g) => g.contractPct },
  { h: "Apprentice/Trainee", get: (r) => r.apprenticeTraineeCount, total: (g) => g.apprenticeTraineeCount },
  { h: "Male", get: (r) => r.maleCount, total: (g) => g.maleCount },
  { h: "Female", get: (r) => r.femaleCount, total: (g) => g.femaleCount },
  { h: "Female %", get: (r) => r.femalePct, total: (g) => g.femalePct },
  { h: "Other", get: (r) => r.otherGenderCount, total: (g) => g.otherGenderCount },
  { h: "Migrant Workers", get: (r) => r.migrantWorkerCount ?? "", total: (g) => g.migrantWorkerCount },
  { h: "Migrant %", get: (r) => r.migrantPct ?? "", total: (g) => g.migrantPct },
  { h: "Differently-Abled", get: (r) => r.differentlyAbledCount ?? "", total: (g) => g.differentlyAbledCount },
  { h: "Youngest Worker Age", get: (r) => r.youngestWorkerAge ?? "" },
  { h: "Workers Under 18", get: (r) => r.workersUnder18Count },
  { h: "Min Hiring Age Policy", get: (r) => r.minHiringAgePolicy ?? "" },
  { h: "Minimum Wage Compliant", get: (r) => FLAG(r.minimumWageCompliant) },
  { h: "Lowest Monthly Wage (INR)", get: (r) => r.lowestMonthlyWageInr ?? "" },
  { h: "Statutory Min Wage (INR)", get: (r) => r.statutoryMinimumWageInr ?? "" },
  { h: "Wages On Time", get: (r) => FLAG(r.wagesPaidOnTime) },
  { h: "Standard Weekly Hours", get: (r) => r.standardWeeklyHours ?? "" },
  { h: "Max Weekly Overtime", get: (r) => r.maxWeeklyOvertimeHours ?? "" },
  { h: "Overtime Voluntary", get: (r) => FLAG(r.overtimeVoluntary) },
  { h: "Weekly Rest Day", get: (r) => FLAG(r.weeklyRestDayProvided) },
  { h: "Union/Worker Committee", get: (r) => FLAG(r.unionOrWorkerCommitteePresent) },
  { h: "Collective Bargaining", get: (r) => (r.collectiveBargainingAgreement ? "Yes" : "No") },
  { h: "No Deposit/Doc Retention", get: (r) => FLAG(r.noDepositOrDocumentRetention) },
  { h: "Grievance Mechanism", get: (r) => FLAG(r.grievanceMechanismPresent) },
  { h: "Anti-Discrimination Policy", get: (r) => FLAG(r.antiDiscriminationPolicy) },
  { h: "SA8000 Awareness Training %", get: (r) => r.sa8000AwarenessTrainingPct ?? "" },
  { h: "Last Social Audit", get: (r) => fmtDate(r.lastSocialAuditDate) },
  { h: "Overall Social-Compliance Flag", get: (r) => FLAG(r.effectiveFlag) },
];

export function workforceRegisterCsv(rows: SocialComplianceRegisterRow[], rollup: SocialComplianceRollup): string {
  const header = WORKFORCE_CSV_COLUMNS.map((c) => c.h);
  const body = rows.map((r) => WORKFORCE_CSV_COLUMNS.map((c) => c.get(r)));
  const totals = WORKFORCE_CSV_COLUMNS.map((c) => (c.total ? c.total(rollup) : ""));
  return toCsv([header, ...body, totals]);
}

// ── 4.2 Building register ────────────────────────────────────────────────────
export function buildingRegisterCsv(res: BuildingRegisterResponse): string {
  const header = [
    "Factory Code", "Factory Name", "State", "Building Name", "Type", "Floors", "Area (sqm)",
    "Max Occupancy", "Current Occupancy", "Assembly Point", "Emergency Exits", "Year Built", "Occupancy Certificate No",
  ];
  const body = res.items.map((b) => [
    b.factoryCode, b.factoryName, b.state, b.buildingName, titleCase(b.buildingType), b.floors, b.areaSqm ?? "",
    b.maxOccupancy ?? "", b.currentOccupancy ?? "", b.assemblyPoint ?? "", b.emergencyExits ?? "",
    b.yearBuilt ?? "", b.occupancyCertificateNo ?? "",
  ]);
  const totals: Cell[] = [
    "TOTAL / GROUP", `${res.buildingCount} buildings`, "", "", "", "", res.totalAreaSqm,
    "", "", "", "", "", "",
  ];
  return toCsv([header, ...body, totals]);
}

// ── 4.3 Certification register (sorted by expiry asc on the server) ──────────
export function certificationRegisterCsv(res: CertificationRegisterResponse): string {
  const header = [
    "Factory Code", "Factory Name", "State", "Certification Type", "Certificate No", "Issuing Body",
    "Issue Date", "Expiry Date", "Status", "Days To Expiry", "Scope Notes",
  ];
  const body = res.items.map((c) => [
    c.factoryCode, c.factoryName, c.state, c.certificationType, c.certificateNo ?? "", c.issuingBody ?? "",
    fmtDate(c.issueDate), fmtDate(c.expiryDate), titleCase(c.status), c.daysToExpiry ?? "", c.scopeNotes ?? "",
  ]);
  const totals: Cell[] = [
    "TOTAL / GROUP", `${res.certCount} certs`, "", "", "", "", "", "",
    `${res.expiringWithin90Days} expiring ≤90d`, `${res.expiredCount} expired`, "",
  ];
  return toCsv([header, ...body, totals]);
}
