import { Phase2Scaffold } from "@/components/phase2/scaffold";
import {
  Shield, FileSearch, GitBranch, ClipboardCheck, Wrench, BookOpen, Database, Award
} from "lucide-react";

export const metadata = {
  title: "Process Safety Management | SafeOps360"
};

export default function ProcessSafetyPage() {
  return (
    <Phase2Scaffold
      module={{
        href: "/process-safety",
        name: "Process Safety Management",
        icon: Shield,
        description: "End-to-end OSHA PSM and Seveso-aligned process safety: PHA/HAZOP, MOC, PSSR, mechanical integrity, and safety-critical equipment registers — built for refineries, petrochemicals and large pharma operations.",
        targetIndustries: "Refineries · Petrochemicals · Bulk chemicals · Pharma manufacturing · LNG terminals",
        availability: "Available Q3 2026",
        accent: "indigo"
      }}
      capabilities={[
        { icon: FileSearch, title: "PHA / HAZOP Studies", description: "Hazard & Operability studies with team rosters, deviations, scenarios and recommendation tracking." },
        { icon: GitBranch, title: "Management of Change", description: "MOC workflow covering technical, organisational and procedural changes with risk re-assessment." },
        { icon: ClipboardCheck, title: "Pre-Startup Safety Review", description: "PSSR checklists tied to commissioning and post-MOC restart, with sign-off matrix." },
        { icon: Wrench, title: "Mechanical Integrity", description: "Inspection / testing / preventive maintenance for safety-critical equipment (vessels, relief valves, piping)." },
        { icon: BookOpen, title: "Operating Procedures", description: "Versioned SOPs, SOIs, emergency operating procedures with annual review cycle." },
        { icon: Database, title: "Process Safety Information", description: "Repository: PFDs, P&IDs, MSDS, design basis, materials of construction, electrical classification." },
        { icon: Award, title: "Compliance Audits", description: "PSM element audits with finding-tracking and corrective-action close-out." }
      ]}
      mockMetrics={[
        { label: "Active PHA Studies", value: "5", hint: "2 in revalidation cycle" },
        { label: "MOCs in Progress", value: "8", hint: "3 awaiting PSSR", tone: "warn" },
        { label: "PSSRs Scheduled", value: "3", hint: "Next: Reformer #2" },
        { label: "MI Findings Open", value: "12", hint: "4 overdue", tone: "bad" }
      ]}
      list={{
        title: "Recent records (sample)",
        description: "Indicative dataset showing the entities this module will manage.",
        columns: ["Reference", "Type", "Title", "Owner", "Status"],
        statusKey: "Status",
        rows: [
          { Reference: "PHA-2026-001", Type: "HAZOP", Title: "Crude Distillation Unit revalidation", Owner: "M. Iyer", Status: "In progress" },
          { Reference: "PHA-2026-002", Type: "What-If", Title: "Hydrogen sulphide treater", Owner: "R. Sharma", Status: "Scheduled" },
          { Reference: "MOC-2026-014", Type: "Technical", Title: "Add bypass on caustic injection line", Owner: "S. Pawar", Status: "Pending PSSR" },
          { Reference: "MOC-2026-017", Type: "Procedural", Title: "Update LOTO sequence — Reformer #1", Owner: "A. Kumar", Status: "Approved" },
          { Reference: "MOC-2026-018", Type: "Organisational", Title: "Shift handover protocol revision", Owner: "P. Mehta", Status: "Under review" },
          { Reference: "PSSR-2026-005", Type: "Pre-startup", Title: "Reformer #2 turnaround restart", Owner: "V. Singh", Status: "Scheduled" },
          { Reference: "MI-2026-088", Type: "Vessel Inspection", Title: "V-204 Quench Tower internal inspection", Owner: "Maintenance", Status: "Overdue" },
          { Reference: "PSI-2026-031", Type: "P&ID Update", Title: "Distillation column P&ID Rev 4.2", Owner: "Engineering", Status: "Active" }
        ]
      }}
    />
  );
}
