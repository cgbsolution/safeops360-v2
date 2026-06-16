import { Phase2Scaffold } from "@/components/phase2/scaffold";
import { Stethoscope, UserCheck, CalendarClock, ShieldCheck, Pill, Activity, ClipboardList, Heart } from "lucide-react";

export const metadata = {
  title: "Occupational Health Centre | SafeOps360"
};

export default function OccupationalHealthPage() {
  return (
    <Phase2Scaffold
      module={{
        href: "/occupational-health",
        name: "Occupational Health Centre",
        icon: Stethoscope,
        description: "Industrial OHC operations: pre-employment medicals, periodic medical examinations, fitness-for-duty for specific high-risk jobs, and longitudinal health surveillance tied to industrial hygiene exposures.",
        targetIndustries: "Universal — required by Factories Act, Mines Act and equivalent regulations globally",
        availability: "Available Q3 2026",
        accent: "rose"
      }}
      capabilities={[
        { icon: UserCheck, title: "Pre-Employment Medical", description: "Job-specific PEMEs with auto-generated fitness certificate for HR onboarding." },
        { icon: CalendarClock, title: "Periodic Medical Exam (PME)", description: "Annual / biennial PME schedule with auto-generated due lists and reminder loops." },
        { icon: ShieldCheck, title: "Fitness for Duty", description: "Specific job-fitness for height, confined space, hot work, driving — drives PTW eligibility." },
        { icon: Activity, title: "Health Surveillance", description: "Longitudinal monitoring driven by industrial hygiene exposure findings." },
        { icon: ClipboardList, title: "OHC Visit Log", description: "First-aid, sickness, injury and minor treatment register with daily / weekly summaries." },
        { icon: Pill, title: "Pharmacy & Inventory", description: "Medicine inventory, expiry tracking, controlled substance log." },
        { icon: Heart, title: "Medical Leave Tracking", description: "Doctor-certified leave, work restrictions and return-to-work clearance." }
      ]}
      mockMetrics={[
        { label: "Employees with PME", value: "1,240" },
        { label: "PMEs Due (30d)", value: "18", hint: "Ramp up scheduling", tone: "warn" },
        { label: "Active Restrictions", value: "3", hint: "Light duty / no-driving" },
        { label: "OHC Visits MTD", value: "94", hint: "Mostly first-aid" }
      ]}
      list={{
        title: "Upcoming examinations (sample)",
        description: "Next 14 days.",
        columns: ["Employee", "Designation", "Plant", "Type", "Status"],
        statusKey: "Status",
        rows: [
          { Employee: "Rajesh Sharma", Designation: "Sr. Engineer", Plant: "Lumshnong", Type: "Annual PME", Status: "Scheduled" },
          { Employee: "Priya Mehta", Designation: "Operator", Plant: "Sonadih", Type: "Annual PME", Status: "Pending" },
          { Employee: "Amit Kumar", Designation: "Driver", Plant: "Lumshnong", Type: "Driving fitness", Status: "Scheduled" },
          { Employee: "Suresh Reddy", Designation: "Plant Head", Plant: "Lumshnong", Type: "Executive PME", Status: "Complete" },
          { Employee: "Bishnu Tamang", Designation: "Mill Operator", Plant: "Lumshnong", Type: "Confined space fit", Status: "Scheduled" },
          { Employee: "Karma Lepcha", Designation: "Welder", Plant: "Lumshnong", Type: "Hot work fit", Status: "Pending" },
          { Employee: "Anjali Singh", Designation: "Lab Tech", Plant: "Siliguri", Type: "Annual PME", Status: "Scheduled" },
          { Employee: "Vikram Singh", Designation: "Crane Operator", Plant: "Sonadih", Type: "Height fitness", Status: "Pending" }
        ]
      }}
    />
  );
}
