// Shared types + fetch helper for the Checklist Library.

import { DocumentMeta, fireFetch } from "../lib";

export type ChecklistSummary = {
  id: string;
  templateCode: string;
  name: string;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "RETIRED";
  version: number;
  document: DocumentMeta;
  itemCount: number;
  sectionCount: number;
  seeded: boolean;
  parentTemplateId: string | null;
  approvedAt: string | null;
  runCount?: number;
  /** True once inspections exist against it — items become uneditable. */
  frozen?: boolean;
};

export type ChecklistItemDef = {
  key: string;
  text: string;
  type: "YES_NO_NA" | "NUMERIC" | "TEXT";
  guidance: string | null;
  mandatory: boolean;
  triggersFinding: boolean;
};

export type ChecklistSectionDef = {
  title: string;
  note: string | null;
  items: ChecklistItemDef[];
};

export type ChecklistDefinition = {
  name: string | null;
  documentNo: string;
  supersedesNo: string | null;
  revision: string;
  effectiveDate: string | null;
  reviewDate: string | null;
  department: string;
  assetType: string;
  frequency: string;
  layout: string;
  siteVariant: string | null;
  sourceSheet: string | null;
  signOffRoles: string[];
  footnotes: string[];
  sections: ChecklistSectionDef[];
};

export type ChecklistDetail = ChecklistSummary & { definition: ChecklistDefinition };

/** What this principal may do — from /api/fire/checklists/capabilities. */
export type Caps = {
  read?: boolean;
  create?: boolean;
  update?: boolean;
  delete?: boolean;
  execute?: boolean;
  verify?: boolean;
  approve?: boolean;
  close?: boolean;
  export?: boolean;
  templateAuthor?: boolean;
  templateApprove?: boolean;
  calendar?: boolean;
  rbacSeeded?: boolean;
};

export const fireApi = fireFetch;

// Closed vocabularies the backend also validates. Mirrored here because a
// dropdown that round-trips to learn its own options is a slower dropdown, not a
// more correct one — and these are validated server-side regardless.
export const ASSET_TYPES = [
  { value: "FIRE_ALARM_PANEL", label: "Fire alarm panel" },
  { value: "BEAM_DETECTOR", label: "Beam detector" },
  { value: "FIRE_HYDRANT_SYSTEM", label: "Hydrant & sprinkler system" },
  { value: "FIRE_EXTINGUISHER", label: "Fire extinguisher" },
];

export const FREQUENCIES = [
  { value: "DAILY", label: "Daily" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "ANNUAL", label: "Annually" },
];

// Which layouts each cadence can legally use. Enforced server-side too: a DAILY
// sheet paged as a 12-month grid produces columns whose period labels the run
// resolver then rejects, so the pairing is a real constraint and not a preference.
export const LAYOUTS_FOR_FREQUENCY: Record<string, { value: string; label: string }[]> = {
  DAILY: [
    { value: "DAY_GRID", label: "Day grid — items × 1..31, one month per page" },
    { value: "FORM", label: "Form — one day at a time" },
  ],
  MONTHLY: [
    { value: "MONTH_GRID", label: "Month grid — items × Jan..Dec, one year per page" },
    { value: "FORM", label: "Form — one month, sectioned" },
  ],
  QUARTERLY: [
    { value: "QUARTER_GRID", label: "Quarter grid — items × Q1..Q4, one year per page" },
    { value: "FORM", label: "Form — one quarter, sectioned" },
  ],
  ANNUAL: [{ value: "FORM", label: "Form — one year, sectioned" }],
};

export const ITEM_TYPES = [
  { value: "YES_NO_NA", label: "Yes / No / NA" },
  { value: "NUMERIC", label: "Numeric reading" },
  { value: "TEXT", label: "Free text" },
];

export const DEFAULT_SIGN_OFF_ROLES = [
  "Prepared by: Person In-charge",
  "Reviewed by: Intermediatory Head",
  "Approved by: HOD",
];

/** A lowercase slug derived from wording, as a starting point for the item key. */
export function slugify(text: string, fallback: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return s.length >= 2 ? s : fallback;
}
