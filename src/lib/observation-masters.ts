/**
 * Site master lists for the Safety Observation and Near Miss forms, as
 * supplied by Page Industries (Dept.list.xlsx, 2026-09-04).
 *
 * DEPARTMENTS is a constant rather than a database master on purpose. The
 * Department table that does exist is plant-scoped and shared with Incidents,
 * Permits, HIRA, EAI and Manhours, and it holds a different, generic set of
 * thirteen names (HSE, Operations, Maintenance, …) seeded per plant — not this
 * site's twenty. Both `Observation.department` and `NearMiss.departmentName`
 * are therefore plain text columns fed from this list. A constant keeps the
 * dropdown authoritative without forking that shared master, and without
 * inventing an admin screen and a seeder for twenty strings that change once a
 * year. If the list ever needs to be editable in-app, that is the point to
 * promote it to a table of its own — not before.
 *
 * The observation CATEGORIES are deliberately NOT here. They live in
 * ObservationTaxonomy and are served per act/condition axis by
 * /api/observation-taxonomy/categories, because the server validates every
 * submitted category against that same table — a second copy in the client
 * would be a copy that can disagree with the thing doing the enforcing.
 * See prisma/seed-page-observation-categories.ts.
 */

export const DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Elastic",
  "Quality",
  "Finishing",
  "HR",
  "Admin",
  "Electrical",
  "Mechanical",
  "Molding",
  "Hook & Eye",
  "Socks",
  "Embroidery",
  "Packing",
  "RM store",
  "Lab",
  "RM QC",
  "Dispatch",
  "Warehouse",
  "EHS"
] as const;

export type Department = (typeof DEPARTMENTS)[number];
