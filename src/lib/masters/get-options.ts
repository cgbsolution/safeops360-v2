// Central helper for fetching dropdown options from MasterItem.
// Pages and forms call this instead of hardcoding option arrays so that
// admin-side changes in /configuration/dropdowns are immediately
// reflected without code changes.
//
//   const shifts = await getMasterOptions("SHIFT");
//   <Select>
//     {shifts.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
//   </Select>
//
// Falls back to the optional `defaults` array when the type has no rows
// in MasterItem yet — useful for forms migrating off hardcoded enums.

import { cache } from "react";
import { backendFetch } from "@/lib/backend/fetch";

export type MasterOption = {
  code: string;
  label: string;
  sortOrder: number;
  metadata: any;
};

// React.cache'd per (type, includeInactive): a form that renders the same
// dropdown twice in one request makes one call, not two.
const fetchOptions = cache(
  async (type: string, includeInactive: boolean): Promise<MasterOption[]> =>
    backendFetch<MasterOption[]>("/api/masters/items", {
      query: { type, includeInactive },
    })
);

export async function getMasterOptions(
  type: string,
  opts?: { includeInactive?: boolean; defaults?: MasterOption[] }
): Promise<MasterOption[]> {
  let rows: MasterOption[];
  try {
    rows = await fetchOptions(type, opts?.includeInactive ?? false);
  } catch {
    // A dropdown that can't reach the backend falls back to its defaults where
    // the caller supplied them, and to empty otherwise — same as an unseeded
    // type. Throwing here would take down the whole form for a lookup list.
    return opts?.defaults ?? [];
  }
  if (rows.length === 0 && opts?.defaults) return opts.defaults;
  return rows;
}
