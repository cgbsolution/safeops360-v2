import { Phase2Scaffold } from "@/components/phase2/scaffold";
import { EyeOff, ClipboardCheck, Users, Award, BarChart3, GraduationCap, MessageSquare, RefreshCcw } from "lucide-react";

export const metadata = {
  title: "Behaviour-Based Safety | SafeOps360"
};

export default function BBSPage() {
  return (
    <Phase2Scaffold
      module={{
        href: "/bbs",
        name: "Behaviour-Based Safety",
        icon: EyeOff,
        description: "Peer-to-peer behavioural observation campaigns that complement Safety Observations. Track safe vs at-risk behaviour ratios, observer engagement, and recognition workflows that drive a maturing safety culture.",
        targetIndustries: "Mature safety programs across all industries — strongest fit in cement, oil & gas, chemicals",
        availability: "Available Q3 2026",
        accent: "violet"
      }}
      capabilities={[
        { icon: ClipboardCheck, title: "Behavioural Observation Cards", description: "Mobile-first BBS card different from incident-style observations — focuses on behaviours, not conditions." },
        { icon: Users, title: "Peer-to-Peer Observers", description: "Train and certify peers as observers; track their submission cadence and observation quality." },
        { icon: GraduationCap, title: "Observer Certification", description: "Onboarding training, competency assessment, periodic re-certification." },
        { icon: BarChart3, title: "Campaign Analytics", description: "Safe vs at-risk %, behaviour categories, plant heatmap, role-level trends." },
        { icon: Award, title: "Recognition Workflow", description: "Auto-recognise consistently safe behaviour; reinforce positive reinforcement loops." },
        { icon: MessageSquare, title: "Conversation Logs", description: "Capture the on-the-spot conversation between observer and worker — the highest-value BBS artefact." },
        { icon: RefreshCcw, title: "Action Effectiveness Review", description: "After each campaign, review whether at-risk behaviours actually reduced." }
      ]}
      mockMetrics={[
        { label: "Active Campaigns", value: "3", hint: "Across 3 plants" },
        { label: "Cards This Month", value: "1,240", hint: "Up 18% MoM" },
        { label: "Safe Behaviour Rate", value: "87%", hint: "Target 90%", tone: "good" },
        { label: "Certified Observers", value: "62", hint: "12 due for re-cert", tone: "warn" }
      ]}
      list={{
        title: "Recent observation cards (sample)",
        description: "BBS card stream from the last few days.",
        columns: ["Date", "Observer", "Subject Role", "Category", "Outcome"],
        statusKey: "Outcome",
        rows: [
          { Date: "2026-04-29", Observer: "R. Sharma", "Subject Role": "Mill Operator", Category: "PPE compliance", Outcome: "Safe" },
          { Date: "2026-04-29", Observer: "P. Mehta", "Subject Role": "Forklift Driver", Category: "Driving discipline", Outcome: "At-risk" },
          { Date: "2026-04-28", Observer: "S. Kumar", "Subject Role": "Welder", Category: "Tool tethering", Outcome: "Safe" },
          { Date: "2026-04-28", Observer: "B. Tamang", "Subject Role": "Packer", Category: "Manual lifting", Outcome: "At-risk" },
          { Date: "2026-04-27", Observer: "K. Lepcha", "Subject Role": "Electrician", Category: "LOTO compliance", Outcome: "Safe" },
          { Date: "2026-04-27", Observer: "M. Iyer", "Subject Role": "Crane Operator", Category: "Pre-use inspection", Outcome: "Safe" },
          { Date: "2026-04-26", Observer: "A. Patel", "Subject Role": "Helper", Category: "Housekeeping", Outcome: "At-risk" }
        ]
      }}
    />
  );
}
