"use client";

import { Download } from "lucide-react";
import { toCsv, downloadCsv, stamp } from "../csv";
import { buildingRegisterCsv, certificationRegisterCsv, workforceRegisterCsv } from "../registers-csv";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  fmtDate,
  titleCase,
  type BuildingRegisterResponse,
  type CertificationRegisterResponse,
  type FactoryProfile,
  type SocialComplianceRegisterResponse,
} from "../lib";

export function ReportsView({
  factories,
  social,
  buildings,
  certs,
}: {
  factories: FactoryProfile[];
  social: SocialComplianceRegisterResponse;
  buildings: BuildingRegisterResponse;
  certs: CertificationRegisterResponse;
}) {
  const factoryMaster = () => {
    const header = ["Code", "Factory", "Status", "City", "State", "Industry", "Buildings", "Employees", "Profile Status", "Certs", "Certs Expiring"];
    const rows = factories.map((f) => [
      f.factoryCode, f.factoryName, titleCase(f.status), f.city, f.state, f.primaryIndustry,
      f.buildingCount, f.totalEmployees, titleCase(f.profileStatus), f.certCount, f.certsExpiringCount,
    ]);
    downloadCsv(`factory-master_${stamp()}.csv`, toCsv([header, ...rows]));
  };

  const complianceSummary = () => {
    const header = ["Code", "Factory", "State", "Compliance %", "Open Findings", "Critical", "Open CAPAs", "Overdue CAPAs", "Open Obligations", "Incidents 12m", "Last Audit"];
    const rows = factories.map((f) => [
      f.factoryCode, f.factoryName, f.state,
      f.metrics?.auditComplianceScorePct ?? "", f.metrics?.openFindings ?? 0, f.metrics?.criticalFindings ?? 0,
      f.metrics?.openCapas ?? 0, f.metrics?.overdueCapas ?? 0, f.metrics?.openObligations ?? 0,
      f.metrics?.incidentCount12m ?? 0, fmtDate(f.metrics?.lastAuditDate),
    ]);
    downloadCsv(`group-compliance-summary_${stamp()}.csv`, toCsv([header, ...rows]));
  };

  const workforceSa8000 = () =>
    downloadCsv(`workforce-sa8000-register_${stamp()}.csv`, workforceRegisterCsv(social.items, social.rollup));

  const buildingRegister = () =>
    downloadCsv(`building-register_${stamp()}.csv`, buildingRegisterCsv(buildings));

  const certificationRegister = () =>
    downloadCsv(`certification-register_${stamp()}.csv`, certificationRegisterCsv(certs));

  const flagged =
    (social.rollup?.flagCounts?.["ATTENTION"] ?? 0) +
    (social.rollup?.flagCounts?.["NON_COMPLIANT"] ?? 0) +
    (social.rollup?.childLabourFlagCount ?? 0);

  const reports: { title: string; desc: string; count: string; run: () => void }[] = [
    {
      title: "Factory Master",
      desc: "All factory profiles — identity, location, buildings, employees, cert counts.",
      count: `${factories.length} factories`,
      run: factoryMaster,
    },
    {
      title: "Group Compliance Summary",
      desc: "Live compliance score, findings, CAPA load, obligations & incidents per factory.",
      count: `${factories.length} factories`,
      run: complianceSummary,
    },
    {
      title: "Workforce & SA8000 Register",
      desc: "Per-factory workforce split, gender, migrant, child-labour evidence, wages, hours, freedom of association, grievance & SA8000 training — with the social-compliance flag.",
      count: `${social.items.length} factories · ${flagged} flagged`,
      run: workforceSa8000,
    },
    {
      title: "Building Register",
      desc: "Every building across the estate — type, floors, area, occupancy, assembly point & emergency exits.",
      count: `${buildings.buildingCount} buildings`,
      run: buildingRegister,
    },
    {
      title: "Certification Register",
      desc: "All certifications sorted by expiry — SA8000, WRAP, BSCI, SMETA, ISO — with days-to-expiry.",
      count: `${certs.certCount} certs · ${certs.expiringWithin90Days} expiring ≤90d · ${certs.expiredCount} expired`,
      run: certificationRegister,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {reports.map((r) => (
        <Card key={r.title} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-none">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{r.title}</h3>
            <p className="mt-1 text-xs text-slate-500">{r.desc}</p>
            <p className="mt-2 text-[11px] font-medium text-slate-400">{r.count}</p>
          </div>
          <Button variant="outline"
            onClick={r.run} className="mt-3 gap-1.5 rounded-lg px-3 py-2 text-sm">
            <Download size={15} /> Download CSV
          </Button>
        </Card>
      ))}
    </div>
  );
}
