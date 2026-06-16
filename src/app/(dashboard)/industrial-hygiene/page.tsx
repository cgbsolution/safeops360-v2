import { Phase2Scaffold } from "@/components/phase2/scaffold";
import { Wind, Volume2, Droplets, FlaskConical, Thermometer, ClipboardList, Bell, LineChart } from "lucide-react";

export const metadata = {
  title: "Industrial Hygiene | SafeOps360"
};

export default function IndustrialHygienePage() {
  return (
    <Phase2Scaffold
      module={{
        href: "/industrial-hygiene",
        name: "Industrial Hygiene",
        icon: Wind,
        description: "Workplace exposure monitoring across noise, dust, chemical, heat and ergonomic hazards — with personal exposure assessments, health risk profiles per role, and direct linkage to Occupational Health surveillance.",
        targetIndustries: "Mining · Foundries · Bulk chemicals · Construction · Pharma · Cement",
        availability: "Available Q3 2026",
        accent: "amber"
      }}
      capabilities={[
        { icon: Volume2, title: "Noise Monitoring", description: "Area + dosimetry monitoring with TWA / Lex,8h calculations against OSHA / EU action limits." },
        { icon: Droplets, title: "Respirable Dust", description: "Total dust + RCS sampling, gravimetric and real-time, with shift-weighted exposures." },
        { icon: FlaskConical, title: "Chemical Exposure", description: "Personal sampling for solvents, acids, metals; CEL / STEL / TLV-TWA evaluation." },
        { icon: Thermometer, title: "Heat & Cold Stress", description: "WBGT-based heat stress index by job role and seasonal exposure." },
        { icon: ClipboardList, title: "Health Risk Assessment", description: "Per-role HRA matrix scoring exposure × frequency × severity." },
        { icon: Bell, title: "Worker Notifications", description: "Auto-notify affected workers when readings exceed action level; trigger PME." },
        { icon: LineChart, title: "Trend & Compliance", description: "Long-term exposure trends per role / per area / per plant against statutory limits." }
      ]}
      mockMetrics={[
        { label: "Monitoring Points", value: "24", hint: "Across 3 plants" },
        { label: "High-Risk Roles", value: "6", hint: "Flagged for surveillance", tone: "warn" },
        { label: "Above Action Limit", value: "3", hint: "Last 30 days", tone: "bad" },
        { label: "PMEs Triggered", value: "18", hint: "From IH findings" }
      ]}
      list={{
        title: "Monitoring stations (sample)",
        description: "Where, what and how often.",
        columns: ["Station", "Hazard", "Method", "Last Reading", "Status"],
        statusKey: "Status",
        rows: [
          { Station: "Crusher Cabin", Hazard: "Respirable dust (RCS)", Method: "Gravimetric, 8h", "Last Reading": "0.058 mg/m³", Status: "Compliant" },
          { Station: "Cement Mill #1", Hazard: "Noise", Method: "Type-2 SLM, 8h Lex", "Last Reading": "92 dB(A)", Status: "Above action" },
          { Station: "Packing Line A", Hazard: "Total dust", Method: "Gravimetric, 8h", "Last Reading": "3.2 mg/m³", Status: "Compliant" },
          { Station: "Coal Mill", Hazard: "Respirable dust + silica", Method: "Cyclone + XRD", "Last Reading": "0.042 mg/m³", Status: "Compliant" },
          { Station: "Welding Bay", Hazard: "Welding fume (Mn)", Method: "Personal sampler", "Last Reading": "0.18 mg/m³", Status: "Watch" },
          { Station: "Acid Storage", Hazard: "HCl vapour", Method: "Detector tube", "Last Reading": "1.2 ppm", Status: "Compliant" },
          { Station: "Loading Bay (summer)", Hazard: "Heat stress", Method: "WBGT", "Last Reading": "31.4 °C", Status: "Above action" },
          { Station: "Lab Fume Hood", Hazard: "Toluene", Method: "Charcoal tube", "Last Reading": "8 ppm", Status: "Compliant" },
          { Station: "Substation Room", Hazard: "EMF / Noise", Method: "Combined survey", "Last Reading": "84 dB(A)", Status: "Compliant" },
          { Station: "Bagging Floor", Hazard: "Respirable dust (RCS)", Method: "Gravimetric, 8h", "Last Reading": "0.071 mg/m³", Status: "Above action" }
        ]
      }}
    />
  );
}
