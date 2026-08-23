// The States and Union Territories of India.
//
// Stored and submitted as the full name, because that is what every existing
// row already holds (`Plant.state` = "Karnataka", "Tamil Nadu", …) and what the
// India map component matches on. A code column would have to be reconciled
// with all of that for no gain.
//
// Both lists are alphabetical, and the UTs are kept separate so the picker can
// group them — "Delhi" sitting between "Chhattisgarh" and "Goa" reads as an
// oversight to anyone who knows it is a UT.
//
// Current as of the 2019–20 reorganisations: Jammu & Kashmir and Ladakh are
// UTs, and Dadra & Nagar Haveli and Daman & Diu are one merged UT.

export const INDIA_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const INDIA_UNION_TERRITORIES = [
  "Andaman & Nicobar Islands",
  "Chandigarh",
  "Dadra & Nagar Haveli and Daman & Diu",
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export const INDIA_STATES_AND_UTS: readonly string[] = [
  ...INDIA_STATES,
  ...INDIA_UNION_TERRITORIES,
];

/** Options for `SelectField`, with the UTs marked so the two are told apart. */
export const INDIA_STATE_OPTIONS = [
  ...INDIA_STATES.map((s) => ({ value: s, label: s })),
  ...INDIA_UNION_TERRITORIES.map((s) => ({ value: s, label: s, hint: "Union Territory" })),
];

/** Resolve free-text state data already in the database to a canonical name.
 *
 *  Existing rows were typed by hand, so they carry "delhi", "TAMILNADU",
 *  "Jammu and Kashmir" and similar. Without this, editing an old profile would
 *  show an empty State picker and silently blank a value that was actually
 *  fine. Returns "" when nothing matches, which the required-field check then
 *  reports honestly rather than guessing. */
export function canonicalIndiaState(raw: string | null | undefined): string {
  if (!raw) return "";
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z]/g, "");
  const target = norm(raw).replace(/^and/, "");
  for (const s of INDIA_STATES_AND_UTS) {
    const candidate = norm(s);
    if (candidate === norm(raw) || candidate === target) return s;
    // "Jammu and Kashmir" ↔ "Jammu & Kashmir", "Orissa" ↔ "Odisha" style
    // near-misses: compare with the connective words stripped from both sides.
    if (candidate.replace(/and/g, "") === norm(raw).replace(/and/g, "")) return s;
  }
  return "";
}
