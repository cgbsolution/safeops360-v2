// Assurance integrity — shared types + presentation helpers.
//
// Backend: app/routers/assurance.py, app/services/{independence,assurance}.py
// Design:  docs/cams/09-module-completion.md Part 2.
//
// The premise worth keeping in mind while reading these types: auditor and
// auditee are ENGAGEMENT-SCOPED roles, not user types. There is no global
// AUDITOR role. So a verdict is always about one person on one engagement, and
// the same person legitimately carries different verdicts elsewhere.

export type ConflictSeverity = "BLOCK" | "WARN";

export type IndependenceConflict = {
  rule: "OWN_WORK" | "SAME_ENGAGEMENT_DUAL_ROLE";
  severity: ConflictSeverity;
  source:
    | "DECLARED_AUDITEE"
    | "CHECKPOINT_OWNER"
    | "AREA_OWNER"
    | "DISCIPLINE_OWNER"
    | "ROLE_SCOPE"
    | "PROFILE_AFFINITY"
    | "SAME_ENGAGEMENT_ROSTER";
  reason: string;
  detail?: Record<string, unknown>;
};

export type IndependenceVerdict = {
  userId: string;
  userName?: string | null;
  allowed: boolean;
  waived: boolean;
  waiverId: string | null;
  conflicts: IndependenceConflict[];
  blockingCount: number;
  warningCount: number;
  summary: string;
};

export type PreflightResponse = { results: IndependenceVerdict[]; blockedCount: number };

/**
 * The four sources the own-work guard reads. The register labels every row with
 * the one that produced it, because "why is this person conflicted?" is the
 * question the screen exists to answer.
 *
 * `CHECKPOINT_OWNER` is the one that was invisible: the register used to derive
 * its auditee set from `ComplianceAudit.auditees` alone, so people who owned
 * audit checkpoints rendered as clear while the scheduler blocked them.
 */
export type OwnershipSource =
  | "DECLARED_AUDITEE" | "CHECKPOINT_OWNER" | "AREA_OWNER" | "DISCIPLINE_OWNER";

export const SOURCE_LABEL: Record<string, string> = {
  DECLARED_AUDITEE: "Declared auditee",
  CHECKPOINT_OWNER: "Checkpoint owner",
  AREA_OWNER: "Area owner",
  DISCIPLINE_OWNER: "Discipline owner",
  ROLE_SCOPE: "Site/department role",
  PROFILE_AFFINITY: "Profile match",
  // Not an ownership source: rule 2 reads this engagement's own roster, which
  // is built from declared auditees, the plant manager AND checkpoint
  // allocation. Labelling it "declared auditee" claimed a provenance it did
  // not have.
  SAME_ENGAGEMENT_ROSTER: "Same engagement",
};

export type TwoHatRow = {
  engagementKind: "AUDIT" | "INSPECTION" | null;
  engagementId: string | null;
  code?: string;
  engagementCode?: string | null;
  title?: string;
  label?: string;
  siteId: string | null;
  status?: string;
  scheduledDate?: string | null;
  source?: OwnershipSource;
  disciplineCodes?: string[];
  detail?: Record<string, unknown>;
  hat: "LEAD_AUDITOR" | "CO_AUDITOR" | "TEAM_AUDITOR" | "AUDITEE_OWNER"
    | "CHECKPOINT_OWNER" | "AREA_OWNER" | "DISCIPLINE_OWNER";
};

export type OwnedThingRow = {
  source: OwnershipSource;
  label: string;
  siteId: string | null;
  disciplineCodes: string[];
  engagementKind: string | null;
  engagementId: string | null;
  engagementCode: string | null;
  detail: Record<string, unknown>;
};

export type TwoHatSummary = {
  userId: string;
  userName?: string | null;
  designation?: string | null;
  asAuditor: TwoHatRow[];
  asAuditee: TwoHatRow[];
  /** Standing ownership not attached to any engagement — real, and not "two hats". */
  ownershipOfRecord: OwnedThingRow[];
  auditorCount: number;
  auditeeCount: number;
  ownershipCount: number;
  sources: OwnershipSource[];
  wearsBothHats: boolean;
  hasOwnershipOfRecord: boolean;
};

/** A register row: a two-hat summary plus its rank and status chip. */
export type RegisterRow = TwoHatSummary & {
  rank: 0 | 1 | 2;
  status: "DUAL_ROLE_OPEN" | "DUAL_ROLE" | "OWNER_OF_RECORD" | "WAIVED";
  openAuditorCount: number;
  openAuditeeCount: number;
  homePlantId?: string | null;
};

export type RegisterResponse = {
  items: RegisterRow[];
  total: number;
  dualRoleOpenCount: number;
  dualRoleCount: number;
  ownerOfRecordCount: number;
};

export const REGISTER_STATUS: Record<string, { label: string; chip: string }> = {
  // "Permitted" is the point: rule 3 says cross-engagement dual roles are legal
  // and must be VISIBLE. A register that styled them as violations would be
  // teaching the client the wrong thing about their own standard.
  DUAL_ROLE_OPEN: {
    label: "Dual role — permitted",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
  },
  DUAL_ROLE: {
    label: "Dual role — closed engagements",
    chip: "bg-slate-100 text-slate-700 border-slate-300",
  },
  OWNER_OF_RECORD: {
    label: "Owner of record",
    chip: "bg-sky-50 text-sky-800 border-sky-200",
  },
  WAIVED: { label: "Waived", chip: "bg-violet-50 text-violet-700 border-violet-200" },
};

export type IndependenceEventRow = {
  id: string;
  occurredAt: string | null;
  outcome: "BLOCKED" | "WARNED" | "WAIVED" | "CLEARED";
  origin: string;
  rule: string | null;
  source: string | null;
  reason: string;
  siteId: string | null;
  engagementKind: string;
  engagementId: string | null;
  engagementCode: string | null;
  subjectUserId: string;
  subjectUserName: string | null;
  attemptedByUserId: string | null;
  attemptedByUserName: string | null;
  conflictDetail: Record<string, unknown> | null;
  waiver: {
    id: string;
    justification: string;
    approvedByUserId: string;
    approvedByUserName: string | null;
    approvedAt: string | null;
    revokedAt: string | null;
  } | null;
};

export type IndependenceEventsResponse = {
  items: IndependenceEventRow[];
  total: number;
  counts: Record<string, number>;
  blockedStanding: number;
  waivedCount: number;
};

export const OUTCOME_META: Record<string, { label: string; chip: string; dot: string }> = {
  // A block that was never overridden is the strongest evidence in the register,
  // so it reads as enforcement (emerald), not as an error (rose). The product
  // did the right thing; styling it red would say the opposite.
  BLOCKED: {
    label: "Blocked",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  WARNED: {
    label: "Warned",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  WAIVED: {
    label: "Waived",
    chip: "bg-violet-50 text-violet-800 border-violet-200",
    dot: "bg-violet-500",
  },
  CLEARED: {
    label: "Cleared",
    chip: "bg-slate-100 text-slate-600 border-slate-300",
    dot: "bg-slate-400",
  },
};

/** Deep link for an engagement of either kind. Both routes exist. */
export function engagementHref(kind: string | null | undefined, id: string | null): string | null {
  if (!id) return null;
  return kind === "INSPECTION" ? `/cams/engagements/${id}` : `/cams/audits/${id}`;
}

export type WaiverRow = {
  id: string;
  subject: string;
  ruleViolated: string;
  conflict?: string | null;
  justification: string;
  approvedBy: string;
  approvedAt: string | null;
  scope: string;
};

export type WaiverBlock = { count: number; statement: string; waivers: WaiverRow[] };

export type CompetenceGap = { competencyId: string; code: string; name: string; reason?: string; validUntil?: string };

export type CompetenceCheck = {
  ok: boolean;
  required: number;
  missing: CompetenceGap[];
  expiring: CompetenceGap[];
  held: CompetenceGap[];
  summary: string;
};

export type CompetenceSnapshotRow = {
  userId: string;
  userName?: string | null;
  competencyCode: string;
  competencyName: string;
  state: string | null;
  held: boolean;
  waivedGap: boolean;
  validUntil: string | null;
  externalCertificateReference: string | null;
  capturedAt: string | null;
};

export type MeetingAttendee = {
  userId?: string;
  name: string;
  organisation?: string;
  role?: string | null;
  external?: boolean;
};

export type MeetingRecord = {
  recorded: boolean;
  meetingType: "OPENING" | "CLOSING";
  heldAt?: string | null;
  attendees?: MeetingAttendee[];
  attendeeCount?: number;
  scopeConfirmed?: boolean;
  findingsSummaryPresented?: string | null;
  auditeeAcknowledged?: boolean;
  auditeeAcknowledgedBy?: string | null;
  auditeeAcknowledgedAt?: string | null;
  notes?: string | null;
};

export type MeetingsResponse = { opening: MeetingRecord; closing: MeetingRecord };

export type IntegrityVerdict = {
  reportId: string;
  reportCode: string;
  status: "VALID" | "LEGACY_TRUNCATED" | "MISMATCH" | "NO_HASH_STORED";
  valid: boolean;
  algorithm: string;
  storedHashFull: string | null;
  storedHashShort: string | null;
  computedHashFull: string;
  generatedAt: string | null;
  note: string;
};

export type Erratum = {
  id: string;
  sequence: number;
  text: string;
  raisedBy: string;
  approvedBy: string;
  createdAt: string | null;
};

export type DisciplineOwnerRow = {
  id: string;
  plantId: string | null;
  /** Resolved server-side; null when the record is estate-wide. */
  plantName?: string | null;
  disciplineCode: string;
  disciplineLabel: string;
  ownerUserId: string;
  ownerName?: string | null;
  ownershipType: "ACCOUNTABLE" | "RESPONSIBLE";
  estateWide: boolean;
};

// ── Presentation ─────────────────────────────────────────────────────

export const HAT_LABEL: Record<string, string> = {
  LEAD_AUDITOR: "Lead auditor",
  CO_AUDITOR: "Co-auditor",
  TEAM_AUDITOR: "Team auditor",
  AUDITEE_OWNER: "Auditee owner",
};

export const HAT_CHIP: Record<string, string> = {
  LEAD_AUDITOR: "bg-violet-50 text-violet-700 border-violet-200",
  CO_AUDITOR: "bg-violet-50 text-violet-700 border-violet-200",
  TEAM_AUDITOR: "bg-violet-50 text-violet-700 border-violet-200",
  AUDITEE_OWNER: "bg-amber-50 text-amber-800 border-amber-200",
};

// Where a conflict came from, in plain words. The source matters to the reader:
// "they are the declared auditee" is a fact someone recorded, while "their
// profile says this department" is a string match. Rendering them identically
// would overstate the weaker one.
export const CONFLICT_SOURCE_LABEL: Record<string, string> = {
  DECLARED_AUDITEE: "Declared auditee",
  CHECKPOINT_OWNER: "Checkpoint owner",
  AREA_OWNER: "Area owner",
  DISCIPLINE_OWNER: "Discipline owner",
  VENDOR_RELATIONSHIP_OWNER: "Supplier relationship owner",
  SAME_ENGAGEMENT_ROSTER: "Same engagement",
  ROLE_SCOPE: "Role scope",
  PROFILE_AFFINITY: "Profile match",
};

export const INTEGRITY_CHIP: Record<string, string> = {
  VALID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LEGACY_TRUNCATED: "bg-slate-100 text-slate-700 border-slate-300",
  MISMATCH: "bg-rose-50 text-rose-700 border-rose-200",
  NO_HASH_STORED: "bg-amber-50 text-amber-800 border-amber-200",
};

export const INTEGRITY_LABEL: Record<string, string> = {
  VALID: "Verified unchanged",
  LEGACY_TRUNCATED: "Verified (legacy short hash)",
  MISMATCH: "Content has changed",
  NO_HASH_STORED: "No hash recorded",
};

export function fmtDateTime(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { dateStyle: "medium" });
}
