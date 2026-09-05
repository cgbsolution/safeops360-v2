import type { SelectOption } from "@/components/ui/select-field";

// The CAPA action type, as the pickers offer it.
//
// The same two-option dropdown was written out by hand in the Near Miss CAPA
// plan, the Incident intelligence panel and the cause-analysis canvas. Three
// copies is three chances for the labels to drift apart while the stored codes
// stay the same, which is exactly the kind of divergence that made the RCA
// method dropdown look broken. One list, imported everywhere.
export const CAPA_TYPE_OPTIONS: SelectOption[] = [
  { value: "CORRECTIVE", label: "Corrective" },
  { value: "PREVENTIVE", label: "Preventive" }
];
