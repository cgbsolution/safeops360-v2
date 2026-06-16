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

import { prisma } from "@/lib/prisma";

export type MasterOption = {
  code: string;
  label: string;
  sortOrder: number;
  metadata: any;
};

export async function getMasterOptions(
  type: string,
  opts?: { includeInactive?: boolean; defaults?: MasterOption[] }
): Promise<MasterOption[]> {
  const rows = await prisma.masterItem.findMany({
    where: {
      type,
      ...(opts?.includeInactive ? {} : { active: true })
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { code: true, label: true, sortOrder: true, metadata: true }
  });
  if (rows.length === 0 && opts?.defaults) return opts.defaults;
  return rows;
}
