import { Phase2Scaffold } from "@/components/phase2/scaffold";
import { Siren, Flame, Users, BookOpen, Network, Truck, MessageCircle, ListChecks } from "lucide-react";

export const metadata = {
  title: "Emergency Response | SafeOps360"
};

export default function EmergencyResponsePage() {
  return (
    <Phase2Scaffold
      module={{
        href: "/emergency-response",
        name: "Emergency Response & Crisis Management",
        icon: Siren,
        description: "Site-wide emergency preparedness: ERP repository, mock drill scheduling and evaluation, ERT roster, mutual aid agreements, emergency equipment inventory, and post-event lessons-learned tracker.",
        targetIndustries: "All medium and large industrial operations — mandatory under Factories Act / OISD / DGMS",
        availability: "Available Q3 2026",
        accent: "blue"
      }}
      capabilities={[
        { icon: BookOpen, title: "ERP Repository", description: "On-site Emergency Plan, Off-site Emergency Plan, scenario-specific response procedures." },
        { icon: Flame, title: "Mock Drill Tracking", description: "Schedule, execute, and evaluate fire / chemical / medical / weather scenario drills." },
        { icon: ListChecks, title: "Drill Evaluation Scoring", description: "Performance against benchmarks: notification time, assembly time, head-count accuracy." },
        { icon: Users, title: "ERT Roster & Training", description: "Emergency Response Team members, competency tracking, periodic refresher schedule." },
        { icon: Network, title: "Mutual Aid Agreements", description: "Inter-facility / industrial cluster mutual aid registers and capability matrix." },
        { icon: Truck, title: "Emergency Equipment", description: "Fire trucks, ambulances, rescue gear, BA sets — inspection schedule and readiness status." },
        { icon: MessageCircle, title: "Crisis Communication", description: "Pre-approved internal / external / regulator templates with stakeholder distribution lists." }
      ]}
      mockMetrics={[
        { label: "Drills This Year", value: "12" },
        { label: "Drill Effectiveness", value: "92%", hint: "Avg participation rate", tone: "good" },
        { label: "Last Drill Score", value: "78%", hint: "Fire — Cement Mill", tone: "warn" },
        { label: "ERT Members", value: "84", hint: "All trained, 12 due refresher" }
      ]}
      list={{
        title: "Drill schedule (sample)",
        description: "Next 90 days plus the most recent completed drill.",
        columns: ["Date", "Scenario", "Plant", "Lead", "Status"],
        statusKey: "Status",
        rows: [
          { Date: "2026-05-12", Scenario: "Chemical spill — acid storage", Plant: "Lumshnong", Lead: "ERC", Status: "Scheduled" },
          { Date: "2026-05-19", Scenario: "Medical emergency — kiln area", Plant: "Sonadih", Lead: "OHC", Status: "Scheduled" },
          { Date: "2026-06-02", Scenario: "Fire — coal mill bag house", Plant: "Lumshnong", Lead: "Fire Officer", Status: "Planned" },
          { Date: "2026-06-15", Scenario: "Confined space rescue", Plant: "Sonadih", Lead: "Rescue Team", Status: "Planned" },
          { Date: "2026-07-08", Scenario: "Cyclone evacuation drill", Plant: "Siliguri", Lead: "Plant Head", Status: "Planned" },
          { Date: "2026-04-20", Scenario: "Fire — cement mill #1", Plant: "Lumshnong", Lead: "Fire Officer", Status: "Complete" },
          { Date: "2026-03-15", Scenario: "Mock LOTO failure", Plant: "Lumshnong", Lead: "E&I", Status: "Complete" },
          { Date: "2026-02-28", Scenario: "Bomb threat drill", Plant: "Sonadih", Lead: "Security", Status: "Complete" }
        ]
      }}
    />
  );
}
