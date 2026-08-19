// Fire & Life Safety checklists — shared palette, types and client helpers.
//
// PALETTE
// -------
// Midnight Executive (navy / gold / ice). This module is new, so it ships in the
// new design language from day one rather than inheriting the app's legacy
// violet — the same call already made for Safety Culture and the Daily Brief,
// and the same shape of implementation: a local `MX` token object rather than
// global Tailwind theme keys, because Midnight Executive is scoped per surface
// on this platform and widening it into the theme would restyle screens that
// deliberately kept the legacy palette.
//
// Every colour used by these screens is named here. A hex literal appearing in a
// component file is a bug: it is the thing that drifts when the palette moves.

export const MX = {
  navy: "#0B1F4D",
  navySoft: "#1B3266",
  gold: "#C9A961",
  goldSoft: "#E8D9B0",
  ice: "#E8EEF7",
  iceLine: "#D3DEEE",
  paper: "#FFFFFF",
  ink: "#1A202C",
  muted: "#5A6273",
  // Status ramp — deliberately the same three inks the PDF renderer uses, so an
  // export and the screen that produced it never disagree about what red means.
  red: "#C0392B",
  redSoft: "#FBEAE8",
  amber: "#C88214",
  amberSoft: "#FCF3E2",
  green: "#2E7D5B",
  greenSoft: "#E7F3EC",
} as const;

// Georgia for display, Calibri for body — the Midnight Executive type pairing.
// Applied inline via `style` rather than a Tailwind font key for the same reason
// the colours are local: the global font stack belongs to the legacy skin.
export const DISPLAY_FONT = 'Georgia, "Times New Roman", serif';
export const BODY_FONT = 'Calibri, "Segoe UI", system-ui, sans-serif';

// ── Domain types (mirror the backend serialisers) ───────────────────────────
export type Stage = "DRAFT" | "SUBMITTED" | "REVIEWED" | "APPROVED";

export type DocumentMeta = {
  documentNo?: string;
  supersedesNo?: string;
  revision?: string;
  effectiveDate?: string;
  reviewDate?: string;
  department?: string;
  pageLabel?: string;
  frequency?: "DAILY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  assetType?: string;
  layout?: "DAY_GRID" | "MONTH_GRID" | "QUARTER_GRID" | "FORM";
  siteVariant?: string | null;
  sourceSheet?: string;
  signOffRoles?: string[];
  footnotes?: string[];
  sectionNotes?: Record<string, string>;
};

export type TemplateSummary = {
  id: string;
  templateCode: string;
  name: string;
  status: string;
  version: number;
  document: DocumentMeta;
};

export type ChecklistAsset = {
  id: string;
  equipmentCode: string;
  type: string;
  assetSubtype: string | null;
  location: string;
  plantId: string;
  capacitySpec: string | null;
  allottedSerialNo: string | null;
  status: string;
};

export type SignOff = {
  preparedBy: string | null;
  preparedByName?: string | null;
  preparedAt: string | null;
  reviewedBy: string | null;
  reviewedByName?: string | null;
  reviewedAt: string | null;
  approvedBy: string | null;
  approvedByName?: string | null;
  approvedAt: string | null;
  roles?: string[];
};

export type RunItem = {
  questionId: string;
  itemKey: string | null;
  text: string;
  type: "YES_NO_NA" | "NUMERIC" | "TEXT";
  guidance: string | null;
  mandatory: boolean;
  value: string | null;
  conformance: string | null;
  note: string;
  findingId: string | null;
};

export type RunSection = { id: string; title: string; note: string | null; items: RunItem[] };

export type ChecklistRun = {
  runId: string;
  engagementCode: string;
  templateCode: string;
  templateName: string;
  document: DocumentMeta;
  assetId: string;
  assetCode: string;
  assetLocation: string | null;
  plantId: string;
  periodLabel: string;
  stage: Stage;
  camsStatus: string;
  locked: boolean;
  scorePercent: number | null;
  overallResult: string | null;
  signOff: SignOff;
  sections: RunSection[];
};

export type GridColumn = {
  periodLabel: string;
  header: string;
  runId: string | null;
  stage: Stage | null;
  locked: boolean;
  nonWorkingDay: string | null;
};

export type GridRow = {
  questionId: string;
  itemKey: string | null;
  sectionTitle: string;
  text: string;
  type: RunItem["type"];
  guidance: string | null;
  cells: Record<string, { value: string | null; conformance: string | null; note: string }>;
};

export type ChecklistGrid = {
  templateCode: string;
  templateName: string;
  document: DocumentMeta;
  layout: NonNullable<DocumentMeta["layout"]>;
  window: string;
  prevWindow: string;
  nextWindow: string;
  assetId: string;
  assetCode: string;
  assetLocation: string | null;
  assetType: string;
  assetSubtype: string | null;
  allottedSerialNo: string | null;
  plantId: string;
  columns: GridColumn[];
  rows: GridRow[];
};

export type BadgeStatus = "OVERDUE" | "DUE_SOON" | "OK" | "NOT_RECORDED";
export type Badge = { status: BadgeStatus; daysRemaining: number | null; dueDate: string | null };

export type RegisterRow = {
  id: string;
  slNo: number;
  equipmentCode: string;
  serialNo: string | null;
  type: string;
  capacity: string | null;
  yearOfManufacture: number | null;
  expiryDate: string | null;
  make: string | null;
  allottedSerialNo: string | null;
  location: string;
  hpTestedOn: string | null;
  hpTestDueDate: string | null;
  dateOfDischarge: string | null;
  refilledOn: string | null;
  dueForRefilling: string | null;
  weightKg: number | null;
  remarks: string | null;
  plantId: string;
  status: string;
  nextInspectionDueDate: string | null;
  badges: { cylinderLife: Badge; hpTest: Badge; refill: Badge };
  worstBadge: BadgeStatus;
};

export type RegisterPayload = {
  document: DocumentMeta & { title?: string; columns?: [string, string][] };
  summary: { total: number; overdue: number; dueSoon: number; notRecorded: number };
  rows: RegisterRow[];
};

// ── Answer vocabulary ───────────────────────────────────────────────────────
// The source sheets say Yes / No / NA, so that is what the cells say. The
// backend translates to the engine's CONFORM / NC / NA — the operator never sees
// audit vocabulary on a checklist that says "Write Yes if satisfactory".
export const ANSWERS = ["YES", "NO", "NA"] as const;
export type Answer = (typeof ANSWERS)[number];

// Click cycles blank -> YES -> NO -> NA -> blank. YES first because on a working
// system it is the overwhelmingly common answer, so the common case is one tap.
export function cycleAnswer(current: string | null | undefined): Answer | null {
  switch ((current ?? "").toUpperCase()) {
    case "":
      return "YES";
    case "YES":
      return "NO";
    case "NO":
      return "NA";
    default:
      return null;
  }
}

export const ANSWER_STYLE: Record<Answer, { bg: string; fg: string; border: string }> = {
  YES: { bg: MX.greenSoft, fg: MX.green, border: "#BFE0CD" },
  NO: { bg: MX.redSoft, fg: MX.red, border: "#F0C4BE" },
  NA: { bg: MX.ice, fg: MX.muted, border: MX.iceLine },
};

export const BADGE_STYLE: Record<BadgeStatus, { bg: string; fg: string; label: string }> = {
  OVERDUE: { bg: MX.redSoft, fg: MX.red, label: "Overdue" },
  DUE_SOON: { bg: MX.amberSoft, fg: MX.amber, label: "Due soon" },
  OK: { bg: MX.greenSoft, fg: MX.green, label: "In date" },
  // Not green. A cylinder with no refill date on file is a gap in the register,
  // and colouring it green would report the gap as compliance.
  NOT_RECORDED: { bg: MX.ice, fg: MX.muted, label: "Not recorded" },
};

export const STAGE_STYLE: Record<Stage, { bg: string; fg: string }> = {
  DRAFT: { bg: MX.ice, fg: MX.muted },
  SUBMITTED: { bg: MX.amberSoft, fg: MX.amber },
  REVIEWED: { bg: "#E9F0FA", fg: MX.navySoft },
  APPROVED: { bg: MX.greenSoft, fg: MX.green },
};

export const STAGE_ORDER: Stage[] = ["DRAFT", "SUBMITTED", "REVIEWED", "APPROVED"];

// ── Formatting ──────────────────────────────────────────────────────────────
// en-IN throughout — every deployment so far is India-based and the source
// documents are dd.mm.yyyy. A register showing 04/09/2024 as "September 4" to
// one user and "April 9" to another is a register that cannot be audited.
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtWindow(layout: DocumentMeta["layout"], window: string): string {
  if (layout === "DAY_GRID" && /^\d{4}-\d{2}$/.test(window)) {
    const [y, m] = window.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  }
  return window;
}

export function todayPeriod(frequency: DocumentMeta["frequency"]): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  switch (frequency) {
    case "DAILY":
      return `${y}-${m}-${`${d.getDate()}`.padStart(2, "0")}`;
    case "MONTHLY":
      return `${y}-${m}`;
    case "QUARTERLY":
      return `${y}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    default:
      return `${y}`;
  }
}

// ── Client fetch helper ─────────────────────────────────────────────────────
// Goes through the /api/* catch-all proxy, never at the Python backend directly,
// so the browser never sees BACKEND_URL and the caller's own session is what
// authorises the write.
export async function fireFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { detail: text };
  }
  if (!res.ok) {
    // FastAPI's { detail } is the message a domain error carries — surfacing it
    // verbatim is what makes "Cannot move to APPROVED: this checklist is DRAFT"
    // reach the operator instead of a generic failure toast.
    throw new Error(body?.detail ?? body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

// The permission codes the backend router checks. Mirrored here so a screen can
// hide a control the caller cannot use, rather than offering a guaranteed 403.
// The FIRE module borrows the HSE codes until dedicated FIRE.* grants are seeded.
export const READ_PERMISSION = "INCIDENT.READ";
export const WRITE_PERMISSION = "INCIDENT.UPDATE";
