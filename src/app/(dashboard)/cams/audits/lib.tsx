// Shared types + UI helpers for the Audit & Compliance module.
// Types mirror the FastAPI serialization in
// safeops_360_bakend/app/services/audit_compliance.py.

import { Gauge, Layers, ScrollText, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AuditValue = "pass" | "partial" | "fail" | "na" | "yes" | "no" | null;

/**
 * One piece of evidence stored inline on a checkpoint response — a photograph
 * OR a document (licence, certificate, test report, register extract).
 *
 * An annotated capture is a SINGLE entry pointing at the marked render, with
 * `originalStoragePath` holding the untouched original — stored, not shown, so
 * the evidence survives the markup without the checkpoint sprouting a second
 * near-identical thumbnail. Mirrors AuditAttachment in upload-attachment.ts.
 *
 * The persisted key is still `photos`, and the type keeps its name to match:
 * renaming a JSON key inside `auditorResponse` would need a data migration
 * across every audit ever conducted, to buy nothing a comment cannot. Use the
 * `StoredAttachment` alias in new code where "photo" would mislead.
 */
export type StoredPhoto = {
  url: string;
  storagePath?: string;
  caption?: string;
  originalStoragePath?: string;
  originalUrl?: string;
  /** Set on upload. ABSENT on everything attached before documents were
   *  supported — `isImageAttachment` infers it rather than assuming. */
  mimeType?: string;
  /** The file's own name, so a document can be identified without opening it.
   *  A photograph does not need one; `IMG_4821.jpg` tells a reviewer nothing. */
  fileName?: string;
};

/** Reads better than `StoredPhoto` wherever documents are in play. */
export type StoredAttachment = StoredPhoto;

/**
 * Is this attachment renderable as an image?
 *
 * Load-bearing, because the answer decides between an `<img>` thumbnail and a
 * named file chip — and an `<img>` pointed at a PDF is a broken-image icon
 * where a reviewer expects evidence.
 *
 * Three signals, in descending reliability: the recorded `mimeType`, then the
 * extension of the file name, then the extension in the storage path. Every
 * attachment stored before this shipped has only the third, which is why the
 * inference exists at all rather than trusting `mimeType` and calling anything
 * else a document.
 *
 * Unknown falls to TRUE — image — because that is what every historical
 * attachment actually is: uploads were restricted to `image/*` at the picker,
 * so a record with no type information is a photograph. Guessing "document"
 * would turn every existing thumbnail in the product into a grey chip.
 */
export function isImageAttachment(a: Pick<StoredPhoto, "mimeType" | "fileName" | "storagePath" | "url">): boolean {
  if (a.mimeType) return a.mimeType.startsWith("image/");
  const source = a.fileName || a.storagePath || a.url || "";
  const ext = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(source)?.[1]?.toLowerCase();
  if (!ext) return true;
  if (["jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "bmp", "avif"].includes(ext)) return true;
  if (["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "msg", "ppt", "pptx"].includes(ext)) return false;
  return true;
}

/** Short label for a document chip — its own name, else the stored file name,
 *  else something honest rather than a blank tile. */
export function attachmentLabel(a: Pick<StoredPhoto, "caption" | "fileName" | "storagePath">): string {
  if (a.fileName) return a.fileName;
  // Storage paths are `audit-compliance/<audit>/<cp>/<8 hex>-<original name>`.
  // Stripping the collision prefix recovers the name the auditor uploaded.
  const tail = (a.storagePath || "").split("/").pop() ?? "";
  const stripped = tail.replace(/^[0-9a-f]{8}-/i, "");
  return stripped || a.caption || "Document";
}

/** Extension badge for a document chip ("PDF", "XLSX"). */
export function attachmentExt(a: Pick<StoredPhoto, "mimeType" | "fileName" | "storagePath">): string {
  const source = a.fileName || a.storagePath || "";
  const ext = /\.([a-z0-9]+)$/i.exec(source)?.[1];
  if (ext) return ext.toUpperCase().slice(0, 4);
  if (a.mimeType?.includes("pdf")) return "PDF";
  if (a.mimeType?.includes("wordprocessing") || a.mimeType === "application/msword") return "DOC";
  if (a.mimeType?.includes("spreadsheet") || a.mimeType === "application/vnd.ms-excel") return "XLS";
  if (a.mimeType === "text/csv") return "CSV";
  return "FILE";
}

export type CheckpointResponse = {
  id: string;
  checkpointCode: string;
  checkpointQuestion: string;
  guidance: string;
  requirementReference: string;
  standard: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  criticality: string;
  responseType: string;
  sequence: number;
  orderIndex: number;
  // Page Industries grading (checklist columns C–F, H, I). `requirementType` is
  // master data snapshotted from the library; the rest is what the auditor
  // captures. `scoreAllotted` is null on an N/A checkpoint — that is what takes
  // it out of the score denominator.
  requirementType: RequirementType | null;
  gradeAwarded: GradeAwarded | null;
  scoreAllotted: number | null;
  scoreObtained: number | null;
  complianceStatus: ComplianceStatus | null;
  riskGrade: RiskGrade | null;
  // ── Department-segregated management-system audits (PAGE_IMS) ──────────
  // `categoryId` above carries the DEPARTMENT; these carry what that axis
  // cannot express. All null on every other library.
  //
  // `streamCode`      which of the two reports this row belongs to
  // `replicationKey`  the same workbook line in another department
  // `pairKey`         the same requirement on the other sheet, this department
  // `conformanceMode` which conformance control this row offers
  // `conformance`     the three-parameter face of `complianceStatus`, derived
  //                   server-side so the client cannot drift from the mapping
  // `standardClauses` the standards this line is assessed against — an IMS row
  //                   cites up to three at once
  streamCode: StreamCode | null;
  replicationKey: string | null;
  pairKey: string | null;
  conformanceMode: ConformanceMode | null;
  conformance: Conformance | null;
  standardClauses: { code: string; standard: string; clause: string }[];
  requiresPhotoOnFail: boolean;
  autoTriggerCapaOnFail: boolean;
  capaSeverity: string | null;
  linkedSafeopsModule: string | null;
  routedToUserId: string | null;
  // Ownership + two-axis state + ad-hoc (audit-lifecycle v2). assignedOwnerId =
  // auditee (responds to findings); assignedAuditorId = auditor who conducts it.
  assignedOwnerId: string | null;
  assignedAuditorId: string | null;
  assignedById: string | null;
  assignedAt: string | null;
  isAdHoc: boolean;
  addedById: string | null;
  assessmentStatus: string; // NOT_ASSESSED | PASS | PARTIAL | FAIL | NA
  workflowState: string; // OPEN | PASSED | AWAITING_AUDITEE | AUDITEE_RESPONDED | MORE_INFO_REQUESTED | RESOLVED | ACCEPTED_WITH_CAPA | ESCALATED_PM | FINALIZED
  currentRound: number;
  observation: string | null;
  auditorNote: string | null;
  auditorEvidenceIds: string[];
  auditeeEvidenceIds: string[];
  capaId: string | null;
  finalizedAt: string | null;
  auditorResponse: {
    value: AuditValue;
    text_observation?: string;
    auditor_notes?: string;
    photos?: StoredPhoto[];
    is_saved?: boolean;
    responded_at?: string;
  } | null;
  auditeeResponse: {
    respondent_user_id?: string;
    response_text?: string;
    action_taken?: string;
    action_date?: string | null;
    photos?: StoredPhoto[];
    status?: string;
    responded_at?: string;
  } | null;
  plantManagerReview: {
    reviewer_user_id?: string;
    decision?: string;
    comments?: string;
    reviewed_at?: string;
  } | null;
  capa: {
    auto_triggered?: boolean;
    capa_id?: string;
    capa_number?: string;
    capa_status?: string;
  } | null;
  overallStatus: string;
  answeredAt: string | null;
  interactions?: CheckpointInteraction[];
};

export type CheckpointInteraction = {
  id: string;
  round: number;
  actorId: string;
  actorRole: string; // AUDITOR | AUDITEE | PLANT_MANAGER | LEAD_AUDITOR
  action: string;
  comment: string | null;
  evidenceIds: string[];
  resultingState: string;
  timestamp: string;
};

export type Finalizability = {
  finalizable: boolean;
  submitted?: boolean;
  total: number;
  terminal: number;
  blockerCount: number;
  blockers: { checkpointCode: string; categoryName: string; workflowState: string; assessmentStatus: string }[];
};

export type CategoryScore = {
  category_id: string;
  category_name: string;
  total: number;
  passed: number;
  partial: number;
  failed: number;
  na: number;
  /** Σ obtained / Σ allotted for this discipline. Can be negative — a repeat
   *  non-compliance scores −1 against an allotment of 3. */
  score_pct: number;
  score_obtained?: number;
  score_allotted?: number;
};

export type AuditScore = {
  total_checkpoints: number;
  answered: number;
  passed: number;
  partially_passed: number;
  failed: number;
  not_applicable: number;
  /** POINTS-based: Σ score obtained / Σ score allotted, NOT a pass-ratio. */
  overall_score_pct: number;
  category_scores: CategoryScore[];
  critical_failures: number;
  major_failures: number;
  minor_failures: number;
  audit_passed: boolean | null;
  // Page grading rollup — the workbook's own arithmetic, so the percentage can
  // be checked rather than taken on trust.
  score_obtained?: number;
  score_allotted?: number;
  score_band?: string;
  repeat_findings?: number;
  statutory_findings?: number;
};

/**
 * The audited party on a supplier audit (WP-45).
 *
 * `plantId` on the audit is ALWAYS the owning plant — the site that holds the
 * vendor relationship — so the register must read `subjectType` to know whether
 * a row is an audit of our own factory or of someone else's.
 */
export type AuditSupplier = {
  vendorProfileId: string;
  vendorCode: string | null;
  legalName: string;
  criticality: string | null;
  tier: string | null;
  criticalityAtScheduling: string | null;
  vendorSiteRef: string | null;
  /** The vendor was re-tiered after this audit was scheduled. */
  riskPostureChanged: boolean;
};

export type AuditSubjectType = "OWN_SITE" | "VENDOR";

export type AuditRow = {
  id: string;
  auditNumber: string;
  title: string;
  subjectType: AuditSubjectType;
  subjectLabel: string | null;
  supplier: AuditSupplier | null;
  plantId: string;
  templateId: string | null;
  industryCode: string;
  auditType: string;
  status: string;
  scheduledDate: string | null;
  selectedDisciplineIds: string[];
  scopePresetUsed: string | null;
  materializedCheckpointCount: number | null;
  adHocCount: number;
  leadAuditorUserId: string;
  plantManagerUserId: string | null;
  auditees: { userId: string; responsibleCategories: string[] }[];
  totalCheckpoints: number | null;
  answeredCheckpoints: number;
  overallCompliancePct: number | null;
  auditPassed: boolean | null;
  openCapaCount: number;
  criticalFailureCount: number;
  submittedAt: string | null;
  closedAt: string | null;
};

/** The full supplier block on the detail screen (WP-45). */
export type SupplierDetail = {
  linkId: string;
  vendorProfileId: string;
  vendorCode: string | null;
  legalName: string;
  category: string | null;
  criticality: string | null;
  tier: string | null;
  criticalityAtScheduling: string | null;
  tierAtScheduling: string | null;
  riskPostureChanged: boolean;
  vendorSiteRef: string | null;
  supplierContactName: string | null;
  supplierContactEmail: string | null;
  isSingleSource: boolean;
  relationshipOwnerId: string | null;
  // Derived from whether a portal token actually exists and is live — never
  // assumed, so the panel cannot claim the supplier can respond when they can't.
  responseChannel: "PORTAL" | "OUT_OF_BAND";
  responseChannelNote: string;
  portalTokenIssued?: boolean;
  portalExpired?: boolean;
  portalTokenId?: string;
  portalExpiresAt?: string;
  portalContactEmail?: string;
  portalLastAccessedAt?: string | null;
  portalSubmissionCount?: number;
};

export type AuditDetail = AuditRow & {
  supplierDetail?: SupplierDetail | null;
  // A-03 overview enrichment.
  plantName?: string;
  plantCode?: string | null;
  factoryProfileId?: string | null;
  templateName?: string | null;
  templateVersion?: string | null;
  standards?: string[];
  ownerCount?: number;
  userNames?: Record<string, string>;
  team?: AuditTeam;
  scopeDepartments: string[];
  scopeAreas: string[];
  scopeDescription: string;
  scheduledStartTime: string;
  estimatedDurationHours: number;
  coAuditors: (string | CoAuditorAssignment)[];
  actualStartAt: string | null;
  actualEndAt: string | null;
  score: AuditScore | null;
  openingRemarks: string;
  closingRemarks: string;
  // Slim payload (1500-checkpoint safe): `responses` is now a BOUNDED review set
  // (findings / in-flight rows with threads), NOT the full checkpoint list. Use
  // the paginated GET /{id}/checkpoints endpoint to reach every checkpoint.
  responses: CheckpointResponse[];
  responsesTruncated?: boolean;
  disciplineRollup: DisciplineRollup[];
  /** Per-report progress on a department audit. Empty on every other audit,
   *  which is what tells a screen there is ONE report here rather than two. */
  streamRollup?: StreamRollup[];
  /**
   * Which conformance vocabulary THIS audit's checkpoints were materialised
   * with — derived server-side from the rows, not from the library, because the
   * rows are what the auditor answers and the library may have moved on.
   *
   * A mixed audit reports FULL: the filter row and the bulk actions have to
   * offer a vocabulary every card can be found by. Absent reads as FULL.
   */
  conformanceMode?: ConformanceMode;
  /**
   * `replicationKey` → how many DEPARTMENTS of this audit hold that workbook
   * line. Only keys reaching more than one are present, so a lookup that misses
   * means "this checkpoint has no counterpart anywhere" and the replicate
   * action is not offered on it at all.
   *
   * Shipped once with the audit rather than per row: it is one grouped query
   * over ~82 keys, and the alternative is a subquery the worklist would pay 200
   * times a page.
   */
  replicationCounts?: Record<string, number>;
  allocationSummary?: { assigned: number; unassigned: number; total: number };
  progress: {
    total: number;
    answered: number;
    completionPct: number;
    categories: { categoryId: string; categoryName: string; categoryColor: string; total: number; answered: number; failed: number; partial: number }[];
  };
  finalizability?: Finalizability;
};

// Per-discipline rollup (drives the conduct navigator + detail RAG without
// loading any checkpoint rows). Mirrors svc._discipline_rollup.
export type DisciplineRollup = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  total: number;
  answered: number;
  passed: number;
  partial: number;
  failed: number;
  na: number;
  criticalFailed: number;
  majorFailed: number;
  minorFailed: number;
  // Page grading, summed server-side: the discipline's points out of its
  // allotment, plus the two counts a reviewer looks for first.
  scoreAllotted: number;
  scoreObtained: number;
  scorePct: number;
  repeatFindings: number;
  statutoryFindings: number;
};

/**
 * Per-report rollup on a department audit — the "IMS 41/62 · EnMS 12/22" line,
 * and what each of the two report buttons is offering to issue.
 * Mirrors `svc.stream_rollup`.
 */
export type StreamRollup = {
  code: StreamCode;
  label: string;
  longLabel: string;
  reportTitle: string;
  standards: string;
  color: string;
  total: number;
  answered: number;
  passed: number;
  partial: number;
  failed: number;
  na: number;
  criticalFailed: number;
  scoreAllotted: number;
  scoreObtained: number;
  scorePct: number;
};

// Paginated checkpoint slice (GET /{id}/checkpoints).
export type CheckpointPage = {
  items: CheckpointResponse[];
  nextCursor: string | null;
  total: number;
  returned: number;
};

export type ProgrammeDashboard = {
  total: number;
  open: number;
  closed: number;
  averageCompliancePct: number | null;
  openCapas: number;
  criticalFindings: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  nextScheduled: { id: string; auditNumber: string; title: string; auditType: string; scheduledDate: string } | null;
};

export type AuditDashboard = {
  auditId: string;
  auditNumber: string;
  title: string;
  status: string;
  score: AuditScore;
  criticalCompliance: { total: number; compliant: number; pct: number };
  donut: { pass: number; partial: number; fail: number; na: number; not_answered: number };
};

/**
 * Which audit subject a checkpoint library is written for. Derived on the
 * backend (`library_subject_scope`) so there is exactly one classifier.
 *
 * A supplier audit scoped against an OWN_SITE library asks a supplier about our
 * kiln refractories — the report then reads as an internal plant inspection.
 * The scheduling wizard therefore branches on this, and `create_audit` rejects
 * the mismatch server-side as well.
 */
export type LibrarySubjectScope = "OWN_SITE" | "VENDOR" | "BOTH";

/**
 * The KIND of audit being scheduled — the scheduler's first choice, and what
 * decides which disciplines are on offer.
 *
 * Each category resolves exactly one checkpoint library, which is what makes
 * "the disciplines follow the category" a rule rather than a coincidence of
 * whichever library happened to sort first. Derived on the backend
 * (`library_audit_category`) so there is one classifier, in the same shape and
 * for the same reason as `LibrarySubjectScope`.
 *
 * This is a DIFFERENT axis from the audit subject: a category picks what is
 * asked (internal checklist / ISO management systems / social compliance),
 * `subjectType` picks who is asked (our facility / a supplier). Supplier
 * checklists therefore carry no category — the subject already selected them.
 */
export type AuditCategoryCode =
  | "INTERNAL" | "MANAGEMENT_SYSTEMS"        // own facility
  | "SOCIAL_COMPLIANCE" | "SUPPLIER_COC";    // a supplier's factory

export type AuditCategory = {
  code: AuditCategoryCode;
  label: string;
  description: string;
  /** The library this category materialises from. */
  industryCode: string;
  /**
   * Which audit SUBJECT this category belongs to.
   *
   * The two axes stay untangled by filtering on this: Social Compliance asks
   * whether "the factory" holds a valid licence and pays minimum wages —
   * questions put to a SUPPLIER, not to our own site, where the internal
   * HR/EHS audit already covers that ground. Offering it for an own-facility
   * audit produced a report reading as though we screened ourselves as a vendor.
   */
  subjectType: "OWN_SITE" | "VENDOR";
  /** Stamped onto the audit so a report names the regime it was run under. */
  auditType: string;
  standards: string[];
};

/**
 * Client-side mirror of the backend's `AUDIT_CATEGORIES`, used only when the
 * server list is unavailable (an older payload, or a caller that fetches the
 * libraries without it). The server's list wins whenever it arrives — this
 * exists so the category selector never renders empty and strands the
 * scheduler on a modal with no checklist.
 */
export const AUDIT_CATEGORY_FALLBACK: AuditCategory[] = [
  {
    code: "INTERNAL",
    label: "Internal",
    description: "Page Industries internal audit — HR, EHS and Production.",
    industryCode: "PAGE_INDUSTRIES",
    subjectType: "OWN_SITE",
    auditType: "internal_audit",
    standards: ["Page Industries Internal Audit"],
  },
  {
    code: "MANAGEMENT_SYSTEMS",
    label: "QMS, EMS, OHS",
    description: "Integrated management-system audit against ISO 9001, 14001, 45001 and 50001.",
    industryCode: "PAGE_IMS",
    subjectType: "OWN_SITE",
    auditType: "management_system_audit",
    standards: ["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 50001:2018"],
  },
  {
    code: "SOCIAL_COMPLIANCE",
    label: "Social Compliance",
    description: "PIL Social Compliance Audit checklist — labour, wages, safety and environment at a supplier's factory.",
    industryCode: "PAGE_SOCIAL",
    subjectType: "VENDOR",
    auditType: "social_compliance_audit",
    standards: ["PIL Social Compliance Audit Checklist (Annexure-2, v4)"],
  },
  {
    code: "SUPPLIER_COC",
    label: "Supplier Code of Conduct",
    description: "Supplier Code of Conduct — labour standards, health & safety, environment, ethics and management system.",
    industryCode: "SUPPLIER_COC",
    subjectType: "VENDOR",
    auditType: "supplier_coc_audit",
    standards: ["Supplier Code of Conduct"],
  },
];

export type AuditLibrary = {
  id: string;
  industryCode: string;
  industryName: string;
  version: string;
  checkpointCount: number;
  subjectScope?: LibrarySubjectScope;
  /** INTERNAL | MANAGEMENT_SYSTEMS | SOCIAL_COMPLIANCE, or null/absent for the
   *  supplier checklists — which are reached through the audit SUBJECT, not
   *  through a category. */
  auditCategory?: AuditCategoryCode | null;
  /** Correctly scoped AND has checkpoints loaded. Structure alone is not enough. */
  isSelectable?: boolean;
  /**
   * What a "category" of this library IS. Derived server-side
   * (`library_segregation`) so there is one classifier.
   *
   * The scheduling wizard, the programme wizard and the conduct navigator all
   * label this axis, and "Disciplines in scope" over a list reading HR / Admin
   * / OHC is a false statement on screen. Absent on an older payload, which
   * reads as DISCIPLINE — the historic behaviour exactly.
   */
  segregation?: "DISCIPLINE" | "DEPARTMENT";
  /** Which conformance control this library's checkpoints will offer. */
  conformanceMode?: ConformanceMode;
  /** The reports it produces. Empty when it is reported as one document. */
  streams?: { code: StreamCode; label: string; longLabel: string; standards: string }[];
  categories: { category_code: string; category_name: string; category_color: string; category_icon: string; checkpointCount: number }[];
};

/** The label for a library's scope axis — one place, so the scheduler and the
 *  programme wizard cannot call the same thing two different things. */
export function scopeAxisWords(lib: Pick<AuditLibrary, "segregation"> | null | undefined) {
  const dept = lib?.segregation === "DEPARTMENT";
  return {
    one: dept ? "department" : "discipline",
    many: dept ? "departments" : "disciplines",
    Title: dept ? "Departments" : "Disciplines",
  };
}

/** An audit category paired with the library it resolved to. */
export type ResolvedAuditCategory = AuditCategory & { library: AuditLibrary };

/** One icon per category, so the scheduler and the programme wizard show the
 *  same mark for the same category. */
export const AUDIT_CATEGORY_ICON: Record<AuditCategoryCode, LucideIcon> = {
  INTERNAL: Layers,
  MANAGEMENT_SYSTEMS: Gauge,
  SOCIAL_COMPLIANCE: Users,
  SUPPLIER_COC: ScrollText,
};

/**
 * Libraries valid for one audit subject, filtered to those with content.
 *
 * Pure and exported so the same resolution can run inside a `useMemo`, inside a
 * lazy `useState` initializer (the first paint needs the answer, or the
 * scheduler's footer flashes "Will materialize 0 checkpoints"), and inside a
 * server component.
 */
export function scopedSelectableLibs(
  libraries: AuditLibrary[],
  subjectType: "OWN_SITE" | "VENDOR",
): AuditLibrary[] {
  const wanted = subjectType === "VENDOR" ? "VENDOR" : "OWN_SITE";
  return libraries.filter((l) => {
    const scope = l.subjectScope ?? "OWN_SITE";
    if (!(scope === wanted || scope === "BOTH")) return false;
    // Structure without content is not selectable: the buyer regimes ship with
    // zero checkpoints because the criteria are licensed, and scoping against
    // one would produce an audit — or a programme scope unit — with nothing to
    // assess.
    return l.isSelectable ?? l.checkpointCount > 0;
  });
}

/**
 * Pair each audit category with its library.
 *
 * ONE resolver, used by every surface that offers a category: the audit
 * scheduler and the annual-programme wizard. They must agree — a programme that
 * plans against a taxonomy the scheduler cannot materialise is a coverage matrix
 * that can never go green.
 *
 * Matching prefers the library's own `auditCategory` (derived server-side) and
 * falls back to the industry code, so a payload from a backend that predates the
 * field still resolves.
 *
 * Categories with no usable library are dropped rather than disabled: an
 * unusable category on screen is a promise the instance cannot keep, and each
 * caller's empty state names the missing checklist for whoever can load it.
 */
export function resolveAuditCategories(
  libraries: AuditLibrary[],
  catalogue: AuditCategory[],
  subjectType: "OWN_SITE" | "VENDOR" = "OWN_SITE",
): ResolvedAuditCategory[] {
  const libs = scopedSelectableLibs(libraries, subjectType);
  return catalogue.filter((c) => c.subjectType === subjectType).flatMap((c) => {
    const library =
      libs.find((l) => l.auditCategory === c.code) ??
      libs.find((l) => l.industryCode === c.industryCode);
    return library ? [{ ...c, library }] : [];
  });
}

export type AuditTemplate = {
  id: string;
  name: string;
  description: string;
  auditType: string;
  baseIndustry: string;
  checkpointConfiguration: any;
  version: string;
};

export type PlantUser = { id: string; name: string; email?: string; role: string; department: string };

// Co-auditor with per-discipline scope. coAuditors on an audit may be this
// structured shape or (legacy) a plain user-id string.
export type CoAuditorAssignment = { userId: string; disciplineIds: string[] };

/**
 * Resolved cast of an audit, from the backend's audit_assignment.audit_team().
 * `role` is the person's job title; `authorised` is whether they still hold
 * `permission` at this plant. They differ when a grant changed after the audit
 * was scheduled — the panel shows the seat AND whether it can still be worked.
 */
export type AuditTeamMember = {
  userId: string;
  name: string;
  role: string | null;
  department: string;
  permission: string;
  authorised: boolean;
  /** Present on the per-discipline seats (co-auditors, auditees). */
  disciplines?: { id: string; name: string }[];
};
export type AuditTeam = {
  leadAuditor: AuditTeamMember | null;
  plantManager: AuditTeamMember | null;
  coAuditors: AuditTeamMember[];
  auditees: AuditTeamMember[];
  permissions: Record<string, string>;
  memberCount?: number;
  unauthorisedCount?: number;
};

// A-07 — Interim / Final reports.
/** The Page grading columns as they appear on a frozen report row. Optional
 *  throughout: reports generated before this vocabulary existed are still
 *  readable, and a snapshot is immutable so they can never be backfilled. */
export type ReportGrading = {
  requirementType?: RequirementType | null;
  gradeAwarded?: GradeAwarded | null;
  scoreAllotted?: number | null;
  scoreObtained?: number | null;
  complianceStatus?: ComplianceStatus | null;
  riskGrade?: RiskGrade | null;
};
export type ReportFinding = ReportGrading & {
  checkpointCode: string; discipline: string; severity: string; assessmentStatus: string;
  workflowState: string; round: number; ownerId: string | null; question: string; observation: string | null;
  standard: string; requirementReference: string; capaNumber: string | null; capaStatus: string | null; isAdHoc: boolean;
  isRepeat?: boolean;
};
export type ReportOpenIteration = { checkpointCode: string; discipline: string; workflowState: string; round: number; ownerId: string | null; unassigned: boolean };
export type ReportRegisterEntry = ReportGrading & {
  checkpointCode: string; discipline: string; question: string; severity: string; assessmentStatus: string;
  workflowState: string; standard: string; requirementReference: string; observation: string | null; isAdHoc: boolean;
  ownerId: string | null; capaNumber: string | null; auditorEvidenceIds: string[]; auditeeEvidenceIds: string[];
  interactions: CheckpointInteraction[];
};
// ── Section 1 insight layer ──────────────────────────────────────────────
// Mirrors `app/services/insights/rules_audit_report.py`. Every field is READ
// here and computed there: the screen and the PDF render the same frozen block,
// which is what stops them from disagreeing about what the audit found.
export type InsightBand = "green" | "amber" | "red" | "neutral";
export type InsightSeverity = "critical" | "high" | "watch" | "info";

export type ReportInsightPattern = {
  id: string;
  kind: string;
  severity: InsightSeverity;
  confidence: "low" | "medium" | "high";
  headline: string;
  evidence: string;
  recordRefs: string[];
  refCount: number;
  suggestedAction: string | null;
  /** Present only on the identical-wording pattern, whose evidence is freeform
   *  observation TEXT rather than a structured field — the UI caveats it. */
  basis?: "observation_text";
  ownerId?: string;
};

export type ReportInsights = {
  version: number;
  gauge: {
    pct: number | null; showGrade: boolean;
    band: InsightBand;
    /** What the dial is PAINTED — red on a critical fail whatever the pct. */
    displayBand: InsightBand;
    bandLabel: string; criticalGate: boolean;
    result: string | null; passed: boolean | null; explanation: string | null;
    assessed: number | null; applicable: number | null; coverageLabel: string | null;
    /** The arithmetic behind the dial — Σ points earned / Σ points available. */
    scoreObtained?: number | null; scoreAllotted?: number | null;
  };
  criticalBanner: {
    count: number; headline: string; codes: string[]; disciplines: string[];
  } | null;
  /** Per-discipline POINTS score (Σ obtained / Σ allotted) — the same formula
   *  as the headline percentage, not the engine's superseded pass-ratio. */
  categoryChart: {
    categoryId: string; name: string; pct: number | null; band: InsightBand;
    total: number; passed: number; partial: number; failed: number; na: number; assessed: number;
    scoreObtained: number; scoreAllotted: number;
  }[];
  capaStrip: {
    total: number; open: number; overdue: number; truncated: number; linkedShown: number;
    chips: { capaNumber: string; checkpointCode: string; status: string; severity: string; discipline: string }[];
  };
  repeats: {
    count: number; headline: string; evidence: string; disciplines: string[]; truncated: number;
    items: {
      checkpointCode: string; discipline: string; severity: string; question: string;
      observation: string | null; statusLabel: string; ownerId: string | null; capaNumber: string | null;
    }[];
  } | null;
  patterns: ReportInsightPattern[];
  patternsSuppressedCount?: number;
  suppressed: boolean;
  reason: string | null;
  /** Why the pattern list is empty, when it is. Rendered rather than left as a
   *  silent gap, which reads as a component that failed. */
  patternNote?: string;
};

export type AuditReportSnapshot = {
  reportType: string; auditCode: string; title: string; siteId: string; industryCode: string; auditType: string;
  /**
   * Which of the two documents a department audit issues. Null on a report
   * covering the whole audit, which is every report from every other library
   * and every report frozen before streams existed — so a renderer must treat
   * absence as "one report", never as a missing field.
   *
   * Every number in this snapshot is scoped to it: the headline percentage on
   * the IMS report is IMS points over the IMS allotment.
   */
  reportStream?: StreamCode | null;
  reportStreamLabel?: string | null;
  reportStreamTitle?: string | null;
  reportStreamStandards?: string | null;
  /** Whether `categoryScores` / `disciplineRag` break down by discipline or by
   *  department. Absent reads as DISCIPLINE — the historic behaviour. */
  scopeAxis?: "DISCIPLINE" | "DEPARTMENT";
  leadAuditorId: string; plantManagerId: string | null; templateId: string | null; scopePresetUsed: string | null;
  disciplinesInScope: string[]; plannedDate: string | null; submittedAt: string | null; closedAt: string | null;
  overallScorePct: number | null; overallResult: string; auditPassed: boolean | null;
  /** Arithmetic behind `overallScorePct`. Absent on snapshots frozen before it
   *  was carried — an immutable snapshot cannot be backfilled. */
  scoreObtained?: number; scoreAllotted?: number;
  /** What was actually signed, and what is still outstanding. */
  signOffSummary?: {
    recorded: number; missingRequiredRoles: string[];
    /** Disciplines whose auditor has not signed — derived server-side from who
     *  actually held allocated checkpoints, not from anything a client sends. */
    unsignedDisciplines: string[]; disciplinesSigned: number; disciplinesTotal: number;
    statement: string;
  };
  checkpointsTotal: number; checkpointsAssessed: number; passCount: number; failCount: number; partialCount: number; naCount: number;
  categoryScores: CategoryScore[]; criticalFailures: number; majorFailures: number; minorFailures: number;
  openIterationsCount: number; criticalOpenCount: number; adHocCount: number;
  capaSummary: { total: number; open: number; overdue: number };
  findings: ReportFinding[]; openIterations: ReportOpenIteration[];
  // The full register is no longer inlined into the FINAL snapshot (1500-cp
  // safe); it is served lazily from /reports/{id}/register when hasFullRegister.
  checkpointRegister?: ReportRegisterEntry[]; hasFullRegister?: boolean;
  standardsRollup?: { standard: string; total: number; pass: number; partial: number; fail: number; na: number; scorePct: number }[];
  finalizability?: Finalizability; generatedAt: string; snapshotHash: string;
  plantName?: string; plantCode?: string | null; userNames?: Record<string, string>;

  // WP-50 (F-30): `disciplinesInScope == []` is a SENTINEL for "the full
  // library", so its raw length printed "0 discipline(s)". The backend now
  // derives a label from the materialised rows. Optional — reports generated
  // before the fix do not carry it and fall back to the length.
  disciplinesInScopeCount?: number;
  disciplinesInScopeLabel?: string;

  // A closed audit cannot legitimately have open items; when rows still read
  // non-terminal that is a defect in the RECORD, not outstanding work.
  dataIntegrityFlags?: { code: string; count: number; message: string }[];

  // Checkpoints nobody has reached yet — distinct from open iterations, which
  // are findings awaiting a response. Conflating them reported 81 unassessed
  // checkpoints as 81 open iterations.
  notAssessedCount?: number;

  // Grade-suppression decision from `services/scoring_rules.grade_visibility`.
  // Optional: snapshots frozen before it shipped do not carry it.
  grade?: {
    showGrade: boolean;
    assessed: number;
    applicable: number;
    assessedPct: number;
    threshold: number;
    label: string;
  };
  gate?: { band: string; passed: boolean; explanation: string; rules: Record<string, number | string> };

  // Assurance blocks frozen into the snapshot (docs/cams/09 §2.1.6, §2.2–2.3).
  independence?: {
    count: number;
    statement: string;
    waivers: {
      id: string; subject: string; ruleViolated: string; conflict?: string | null;
      justification: string; approvedBy: string; approvedAt: string | null; scope: string;
    }[];
  };
  meetings?: {
    opening: ReportMeeting;
    closing: ReportMeeting;
  };
  competence?: {
    userId: string; userName?: string | null; competencyCode: string; competencyName: string;
    state: string | null; held: boolean; waivedGap: boolean; validUntil: string | null;
    externalCertificateReference: string | null; capturedAt: string | null;
  }[];
  reopenHistory?: {
    count: number; lastReopenedAt: string | null; lastReason: string | null; statement: string;
  };

  // docs/cams/09 §2.4 — the auditable artefact is the justification.
  samplingApproach?: string;
  samplingJustification?: string | null;

  // WP-12 certification-grade sections. All DERIVED from the record, so the
  // report cannot claim a method the audit did not follow.
  methodology?: {
    criteria: string[];
    method: string;
    scopeDescription: string;
    scopeAreas: string[];
    scopeDepartments: string[];
    // The part that earns trust: what the audit could NOT establish.
    limitations: string[];
  };
  clauseIndex?: {
    standard: string; clause: string; total: number;
    pass: number; fail: number; partial: number; na: number; notAssessed: number;
    checkpointCodes: string[];
  }[];
  /**
   * Where this library's clause citations came from. Most are AI drafts, and
   * the clause index above cannot tell a drafted citation from a sourced one —
   * so the index must not be rendered without this caveat beside it.
   */
  citationProvenance?: {
    total: number;
    cited: number;
    uncited: number;
    unverified: number;
    priorityReview: number;
    verifiedPct: number;
    statement: string;
    byStatus: Record<string, number>;
    footnote: {
      unverifiedCount: number;
      totalCitations: number;
      priorityReviewCount: number;
      statement: string;
    } | null;
  };
  /**
   * Section 1 insight layer, computed by `services/insights/rules_audit_report`
   * and FROZEN into this snapshot at issue — it is hashed with everything else,
   * so re-viewing an issued report can never change a headline here. Optional:
   * reports issued before the layer shipped do not carry it and render without
   * Section 1 rather than having one reconstructed at view time, which would be
   * a claim about a reading nobody took.
   */
  insights?: ReportInsights;
  distributionList?: { userId: string; role: string; name?: string }[];
  revisionHistory?: {
    reportCode: string; reportType: string; generatedAt: string | null;
    superseded: boolean; snapshotHash?: string | null;
  }[];
  revision?: number;
};

export type ReportMeeting = {
  recorded: boolean;
  meetingType: "OPENING" | "CLOSING";
  heldAt?: string | null;
  attendees?: { name: string; organisation?: string; role?: string | null; external?: boolean }[];
  attendeeCount?: number;
  scopeConfirmed?: boolean;
  findingsSummaryPresented?: string | null;
  auditeeAcknowledged?: boolean;
  auditeeAcknowledgedBy?: string | null;
  auditeeAcknowledgedAt?: string | null;
  notes?: string | null;
};

// Lazy paginated register page (GET /reports/{id}/register).
export type ReportRegisterPage = {
  auditId: string; siteId: string; register: ReportRegisterEntry[];
  nextCursor: string | null; total: number; returned: number;
};
export type AuditReport = {
  id: string; auditId: string; siteId: string; reportType: string; reportCode: string;
  generatedById: string; generatedAt: string; snapshot: AuditReportSnapshot;
  /** The RECORDED sign-offs, frozen from `ComplianceAudit.signOffs` at issue —
   *  written only by the authenticated `signoff.record_signoff` path, so a
   *  caller cannot assert a signature that never happened. Older reports carry
   *  only `role`/`userId`, hence everything past those two is optional. */
  signOffs: {
    role: string; userId: string; signedAt?: string; name?: string | null;
    designation?: string | null; disciplineCode?: string | null;
    signatureKind?: "DRAWN" | "TYPED"; typedName?: string | null; statement?: string | null;
  }[] | null;
  pdfAttachmentId: string | null; isSuperseded: boolean;
  /** IMS | ENMS, or null for a report covering the whole audit. Superseding is
   *  per (type, stream), so an IMS re-issue never marks the EnMS one stale. */
  reportStream?: StreamCode | null;
  reportStreamLabel?: string | null;
};

export const REPORT_RESULT_META: Record<string, { label: string; chip: string }> = {
  CONFORMING: { label: "Conforming", chip: "bg-emerald-100 text-emerald-800" },
  MINOR_NC: { label: "Minor NC", chip: "bg-amber-100 text-amber-800" },
  MAJOR_NC: { label: "Major NC", chip: "bg-orange-100 text-orange-800" },
  CRITICAL_NC: { label: "Critical NC", chip: "bg-rose-100 text-rose-700" },
  NOT_ASSESSED: { label: "Not assessed", chip: "bg-slate-100 text-slate-500" },
};

// A-06 — auditee "My Assigned Checkpoints".
export type MyCheckpointItem = CheckpointResponse & { needsResponse: boolean };
export type MyScorecard = { total: number; pass: number; partial: number; fail: number; na: number; not_assessed: number; needsResponse: number };
export type MyAuditGroup = {
  auditId: string; auditNumber: string; title: string; status: string; plantId: string; industryCode: string;
  items: MyCheckpointItem[]; scorecard: MyScorecard;
};
export type MyCheckpointsResponse = { audits: MyAuditGroup[]; totals: { total: number; needsResponse: number; audits: number } };

// Scope-preset shortcuts (audit-lifecycle v2). A preset is a keyword matcher
// over discipline (category) names; selecting one pre-ticks the matching
// disciplines. Keyword-based so it degrades gracefully across industries —
// a preset that matches nothing leaves the current selection untouched.
export type ScopePreset = { key: string; label: string; desc: string; match: (categoryName: string) => boolean };

export const SCOPE_PRESETS: ScopePreset[] = [
  // Deliberately axis-neutral: this same preset is offered over a library whose
  // categories are departments, where "Every discipline" is simply wrong.
  { key: "FULL", label: "Full library", desc: "Everything in the checklist", match: () => true },
  { key: "FIRE_FOCUSED", label: "Fire-Focused", desc: "Fire & emergency", match: (n) => /fire|emergency/i.test(n) },
  {
    key: "SA8000_ISO45001",
    label: "SA8000 + ISO 45001",
    desc: "Social + OHS management",
    match: (n) => /worker welfare|sa8000|social|training|competency|incident|near.?miss|environmental|legal/i.test(n),
  },
  {
    key: "WORKER_WELFARE",
    label: "Worker Welfare",
    desc: "Welfare, housekeeping & PPE",
    match: (n) => /worker welfare|sa8000|social|housekeeping|ergonomic|working environment|ppe|welfare/i.test(n),
  },
];

/** Discipline (category) codes a preset selects within a given library's categories. */
export function presetDisciplineCodes(
  preset: ScopePreset,
  categories: { category_code: string; category_name: string }[],
): string[] {
  return categories.filter((c) => preset.match(c.category_name)).map((c) => c.category_code);
}

// ── UI helpers ───────────────────────────────────────────────────────

export const STATUS_CHIP: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-600",
  in_progress: "bg-sky-100 text-sky-800",
  submitted_pending_response: "bg-amber-100 text-amber-900",
  response_in_progress: "bg-amber-100 text-amber-900",
  under_review: "bg-indigo-100 text-indigo-800",
  closed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-100 text-slate-400",
};

export const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  submitted_pending_response: "Awaiting Responses",
  response_in_progress: "Responses In Progress",
  under_review: "Under Review",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const CRITICALITY_CHIP: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700",
  major: "bg-amber-100 text-amber-800",
  minor: "bg-slate-100 text-slate-600",
  observation: "bg-sky-100 text-sky-700",
  informational: "bg-sky-100 text-sky-700",
};
export const CRITICALITY_FALLBACK = "bg-slate-100 text-slate-600";

// Iteration workflow-state chip (A-05). Terminal states are greenish/closed.
export const WORKFLOW_STATE_META: Record<string, { label: string; chip: string }> = {
  OPEN: { label: "Open", chip: "bg-slate-100 text-slate-600" },
  PASSED: { label: "Passed", chip: "bg-emerald-100 text-emerald-800" },
  AWAITING_AUDITEE: { label: "Awaiting auditee", chip: "bg-amber-100 text-amber-900" },
  AUDITEE_RESPONDED: { label: "Responded", chip: "bg-sky-100 text-sky-800" },
  MORE_INFO_REQUESTED: { label: "More info requested", chip: "bg-orange-100 text-orange-800" },
  RESOLVED: { label: "Resolved", chip: "bg-emerald-100 text-emerald-800" },
  ACCEPTED_WITH_CAPA: { label: "Accepted · CAPA", chip: "bg-violet-100 text-violet-800" },
  ESCALATED_PM: { label: "Escalated to PM", chip: "bg-rose-100 text-rose-700" },
  FINALIZED: { label: "Finalized", chip: "bg-slate-200 text-slate-700" },
};

// Interaction action → human label for the thread timeline.
export const INTERACTION_LABEL: Record<string, string> = {
  ASSESSED: "Auditor assessed",
  ROUTED_TO_OWNER: "Routed to owner",
  AUDITEE_RESPONSE: "Auditee responded",
  REQUEST_MORE_INFO: "More info requested",
  AUDITOR_ACCEPT: "Auditor accepted",
  RAISE_CAPA: "CAPA raised",
  ESCALATE_PM: "Escalated to plant manager",
  PM_DECISION: "Plant manager decision",
  REOPEN: "Reopened",
  ADHOC_ADDED: "Ad-hoc checkpoint added",
};

export const VALUE_META: Record<string, { label: string; chip: string; dot: string }> = {
  pass: { label: "Pass", chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  partial: { label: "Partial", chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  fail: { label: "Fail", chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  na: { label: "N/A", chip: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

// ──────────────────────────────────────────────────────────────────────
// Page Industries grading — the internal-audit checklist's columns C–I.
//
// The canonical definition lives in the backend
// (app/services/page_grading.py, served at /grading-vocabulary). These are the
// PRESENTATION halves: labels short enough for a button, and the colour each
// grade carries. Codes must match the server's; the labels are ours to shape.
// ──────────────────────────────────────────────────────────────────────

export type GradeAwarded =
  | "EFFECTIVE" | "SOME_IMPROVEMENT_NEEDED" | "MAJOR_IMPROVEMENT_NEEDED"
  | "UNSATISFACTORY" | "NA";

export type ComplianceStatus =
  | "COMPLIED" | "NON_COMPLIANCE" | "REPEATED_NON_COMPLIANCE"
  | "NEW_OBSERVATION" | "REPEATED_OBSERVATION" | "NA" | "MAS_NA";

export type RiskGrade = "HIGH" | "MEDIUM" | "LOW";
export type RequirementType = "STATUTORY_REGULATORY" | "INTERNAL_REQUIREMENT";

/** Column C. `short` is what fits on a conduct-screen button; `label` is the
 *  workbook's own wording, used everywhere there is room for it. */
export const GRADE_META: Record<GradeAwarded, {
  label: string; short: string; score: number | null;
  chip: string; dot: string; ring: string;
}> = {
  EFFECTIVE: {
    label: "Effective", short: "Effective", score: 3,
    chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500",
    ring: "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  },
  SOME_IMPROVEMENT_NEEDED: {
    label: "Some Improvement Needed", short: "Some Imp.", score: 2,
    chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500",
    ring: "border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-50",
  },
  MAJOR_IMPROVEMENT_NEEDED: {
    label: "Major Improvement Needed", short: "Major Imp.", score: 1,
    chip: "bg-orange-100 text-orange-800", dot: "bg-orange-500",
    ring: "border-orange-500 bg-orange-50 text-orange-800 hover:bg-orange-50",
  },
  UNSATISFACTORY: {
    label: "Unsatisfactory", short: "Unsat.", score: 0,
    chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500",
    ring: "border-rose-500 bg-rose-50 text-rose-700 hover:bg-rose-50",
  },
  NA: {
    label: "N/A", short: "N/A", score: null,
    chip: "bg-slate-100 text-slate-500", dot: "bg-slate-400",
    ring: "border-slate-400 bg-slate-100 text-slate-600 hover:bg-slate-100",
  },
};

/** Button order — worst to best, matching the workbook's dropdown. */
export const GRADE_ORDER: GradeAwarded[] = [
  "UNSATISFACTORY", "MAJOR_IMPROVEMENT_NEEDED", "SOME_IMPROVEMENT_NEEDED", "EFFECTIVE", "NA",
];

/** Column F. `isRepeat` is what drives the −1 score; `isNa` takes the
 *  checkpoint out of the denominator. */
export const STATUS_META: Record<ComplianceStatus, {
  label: string; chip: string; isRepeat: boolean; isNa: boolean;
}> = {
  COMPLIED: { label: "Complied", chip: "bg-emerald-100 text-emerald-800", isRepeat: false, isNa: false },
  NON_COMPLIANCE: { label: "Non Compliance", chip: "bg-rose-100 text-rose-700", isRepeat: false, isNa: false },
  REPEATED_NON_COMPLIANCE: { label: "Repeated Non Compliance", chip: "bg-rose-200 text-rose-900", isRepeat: true, isNa: false },
  NEW_OBSERVATION: { label: "New Observation", chip: "bg-sky-100 text-sky-800", isRepeat: false, isNa: false },
  REPEATED_OBSERVATION: { label: "Repeated Observation", chip: "bg-sky-200 text-sky-900", isRepeat: true, isNa: false },
  NA: { label: "N/A", chip: "bg-slate-100 text-slate-500", isRepeat: false, isNa: true },
  MAS_NA: { label: "MAS (N/A)", chip: "bg-slate-100 text-slate-500", isRepeat: false, isNa: true },
};

export const STATUS_ORDER: ComplianceStatus[] = [
  "COMPLIED", "NON_COMPLIANCE", "REPEATED_NON_COMPLIANCE",
  "NEW_OBSERVATION", "REPEATED_OBSERVATION", "NA", "MAS_NA",
];

/** Column H — the auditor's assessment of the finding they raised. */
export const RISK_META: Record<RiskGrade, { label: string; chip: string; ring: string }> = {
  HIGH: { label: "High", chip: "bg-rose-100 text-rose-700", ring: "border-rose-500 bg-rose-50 text-rose-700 hover:bg-rose-50" },
  MEDIUM: { label: "Medium", chip: "bg-amber-100 text-amber-800", ring: "border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-50" },
  LOW: { label: "Low", chip: "bg-sky-100 text-sky-800", ring: "border-sky-500 bg-sky-50 text-sky-800 hover:bg-sky-50" },
};

export const RISK_ORDER: RiskGrade[] = ["HIGH", "MEDIUM", "LOW"];

/** Column I — checkpoint master data, shown read-only during conduct. */
export const REQUIREMENT_TYPE_META: Record<RequirementType, { label: string; short: string; chip: string }> = {
  STATUTORY_REGULATORY: { label: "Statutory/Regulatory", short: "Statutory", chip: "bg-violet-100 text-violet-800" },
  INTERNAL_REQUIREMENT: { label: "Internal Requirement", short: "Internal", chip: "bg-slate-100 text-slate-600" },
};

/** Every scored checkpoint is allotted the same 3 points. */
export const FULL_SCORE = 3;
export const SCORE_CHOICES = [3, 2, 1, 0, -1] as const;

export const GRADE_TO_VALUE: Record<GradeAwarded, AuditValue> = {
  EFFECTIVE: "pass",
  SOME_IMPROVEMENT_NEEDED: "partial",
  MAJOR_IMPROVEMENT_NEEDED: "fail",
  UNSATISFACTORY: "fail",
  NA: "na",
};

/** Mirrors page_grading.suggest_score — the ladder, with the repeat penalty on
 *  top. Duplicated client-side ONLY so the score field can fill in the instant
 *  a grade is tapped; the server recomputes it and the server's answer wins. */
export function suggestScore(grade: GradeAwarded | null, status: ComplianceStatus | null): number | null {
  if (!grade) return null;
  const base = GRADE_META[grade].score;
  if (base === null) return null;
  if (status && STATUS_META[status].isRepeat && base < FULL_SCORE) return -1;
  return base;
}

/** Mirrors page_grading.suggest_status. Only ever applied when the auditor has
 *  not already chosen a status — a Repeated Non Compliance must not be quietly
 *  downgraded by a re-grade. */
export function suggestStatus(grade: GradeAwarded | null): ComplianceStatus | null {
  if (!grade) return null;
  return ({
    EFFECTIVE: "COMPLIED", SOME_IMPROVEMENT_NEEDED: "NEW_OBSERVATION",
    MAJOR_IMPROVEMENT_NEEDED: "NON_COMPLIANCE", UNSATISFACTORY: "NON_COMPLIANCE",
    NA: "NA",
  } as Record<GradeAwarded, ComplianceStatus>)[grade];
}

/**
 * Whether a risk grade is MEANINGFUL on this grade — i.e. the checkpoint is a
 * finding at all. Drives whether the control unfolds and whether a stale risk
 * grade is cleared.
 */
export function carriesRiskGrade(grade: GradeAwarded | null): boolean {
  return grade === "UNSATISFACTORY" || grade === "MAJOR_IMPROVEMENT_NEEDED"
    || grade === "SOME_IMPROVEMENT_NEEDED";
}

/**
 * Whether the audit can be SUBMITTED without one. Mirrors
 * `page_grading.requires_risk_grade`, including the TRISTATE exemption: the
 * customer's IMS/EnMS department form has no risk column, so marking the field
 * required there would show a red blocker for something their auditors are
 * never given.
 */
export function requiresRiskGrade(
  grade: GradeAwarded | null, mode?: ConformanceMode | null,
): boolean {
  if (mode === "TRISTATE") return false;
  return carriesRiskGrade(grade);
}

// ──────────────────────────────────────────────────────────────────────
// Department-segregated management-system audits (PAGE_IMS)
//
// Page conduct ONE audit per department — HR, Admin, OHC — and assess each
// against both source sheets: the IMS one (ISO 9001/14001/45001) and the EnMS
// one (ISO 50001). A "discipline" in that library IS a department, and the two
// sheets are two report STREAMS.
//
// Everything here is null / absent on every other library, which is how a
// screen tells a department audit from a discipline one without being told
// which library it happens to be showing.
// ──────────────────────────────────────────────────────────────────────

/** Which of the two documents a checkpoint belongs to. */
export type StreamCode = "IMS" | "ENMS";

/**
 * Which conformance control a checkpoint offers.
 *
 * FULL is the internal audit's five grades + seven statuses. TRISTATE is the
 * three parameters the customer's IMS/EnMS sheet actually carries, written
 * through to the same two columns underneath — a narrower face on one verdict,
 * not a second state machine.
 */
export type ConformanceMode = "FULL" | "TRISTATE";

/** The three parameters, verbatim from column E of both sheets. */
export type Conformance = "CONFORMANCE" | "NON_CONFORMANCE" | "OBSERVATION";

export const STREAM_META: Record<StreamCode, {
  label: string; longLabel: string; standards: string;
  chip: string; ring: string; dot: string;
}> = {
  IMS: {
    label: "IMS", longLabel: "Integrated Management System",
    standards: "ISO 9001:2015, ISO 14001:2015 & ISO 45001:2018",
    chip: "bg-violet-100 text-violet-800",
    ring: "border-violet-500 bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
  },
  ENMS: {
    label: "EnMS", longLabel: "Energy Management System",
    standards: "ISO 50001:2018",
    chip: "bg-amber-100 text-amber-800",
    ring: "border-amber-500 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
};

export const STREAM_ORDER: StreamCode[] = ["IMS", "ENMS"];

/**
 * Column E of both sheets, and what each parameter resolves to underneath.
 *
 * The `grade` and `status` are here so the conduct screen can update its own
 * row optimistically without a round-trip — the SERVER still derives them from
 * the `conformance` token it is sent, and the server's answer wins.
 */
export const CONFORMANCE_META: Record<Conformance, {
  label: string; short: string; grade: GradeAwarded; status: ComplianceStatus;
  score: number; chip: string; ring: string; dot: string;
}> = {
  CONFORMANCE: {
    label: "Conformance", short: "Conform", grade: "EFFECTIVE", status: "COMPLIED", score: 3,
    chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500",
    ring: "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  },
  NON_CONFORMANCE: {
    label: "Non-Conformance", short: "Non-Conform", grade: "MAJOR_IMPROVEMENT_NEEDED",
    status: "NON_COMPLIANCE", score: 1,
    chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500",
    ring: "border-rose-500 bg-rose-50 text-rose-700 hover:bg-rose-50",
  },
  OBSERVATION: {
    label: "Observation", short: "Observation", grade: "SOME_IMPROVEMENT_NEEDED",
    status: "NEW_OBSERVATION", score: 2,
    chip: "bg-sky-100 text-sky-800", dot: "bg-sky-500",
    ring: "border-sky-500 bg-sky-50 text-sky-800 hover:bg-sky-50",
  },
};

export const CONFORMANCE_ORDER: Conformance[] = [
  "CONFORMANCE", "NON_CONFORMANCE", "OBSERVATION",
];

/**
 * Which of the three parameters a stored status displays as.
 *
 * Mirrors `page_grading.tristate_for_status`. Tolerant on purpose: a row graded
 * before this vocabulary existed, or one bulk-marked through the "mark
 * department compliant" fast path, still renders as the parameter it means.
 * Anything with no tristate equivalent (N/A, MAS) renders as unanswered rather
 * than as a wrong parameter.
 */
export function conformanceOf(status: ComplianceStatus | null | undefined): Conformance | null {
  switch (status) {
    case "COMPLIED": return "CONFORMANCE";
    case "NON_COMPLIANCE":
    case "REPEATED_NON_COMPLIANCE": return "NON_CONFORMANCE";
    case "NEW_OBSERVATION":
    case "REPEATED_OBSERVATION": return "OBSERVATION";
    default: return null;
  }
}

/**
 * Group a page of checkpoints into CARDS.
 *
 * Ten requirements appear on both sheets — "Previous Audit and NC Closure
 * Status" is asked once against ISO 9001/14001/45001 and again against ISO
 * 50001. They materialise as two rows (the score, the routing and the two
 * reports are all per-stream), but the auditor should see one card with an
 * IMS / EnMS toggle rather than the same question twice, forty rows apart.
 *
 * Pairing is on `pairKey` AND `categoryId`: the key identifies the requirement,
 * the department says whose copy of it this is. Pairing on the key alone would
 * fold HR's row together with Admin's.
 *
 * A row with no pair key is its own card, which is every checkpoint of every
 * other library — so this is safe to run over any page.
 */
export function pairCheckpoints(items: CheckpointResponse[]): CheckpointResponse[][] {
  const cards: CheckpointResponse[][] = [];
  const index = new Map<string, CheckpointResponse[]>();
  for (const item of items) {
    if (!item.pairKey) {
      cards.push([item]);
      continue;
    }
    const key = `${item.categoryId}::${item.pairKey}`;
    const existing = index.get(key);
    if (existing) {
      // Stream order, not arrival order: the toggle must read "IMS | EnMS" the
      // same way on every card whichever half the server returned first.
      existing.push(item);
      existing.sort(
        (a, b) => STREAM_ORDER.indexOf(a.streamCode as StreamCode)
          - STREAM_ORDER.indexOf(b.streamCode as StreamCode),
      );
      continue;
    }
    const card = [item];
    index.set(key, card);
    cards.push(card);
  }
  return cards;
}

/** Score band label, mirroring page_grading.band. */
export function scoreBandLabel(pct: number | null | undefined): string {
  if (pct == null) return "—";
  if (pct >= 90) return "Effective";
  if (pct >= 80) return "Some Improvement Needed";
  if (pct >= 50) return "Major Improvement Needed";
  return "Unsatisfactory";
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Date + time, for audit-trail events (thread, report register, generated, sign-off)
// where same-day ordering matters.
export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Read the best human message from an API/proxy error body. The catch-all proxy
// returns {error, reason} (not detail) for 502/504/503, so fall through.
export function apiErrorMessage(j: unknown, status?: number): string {
  const o = (j ?? {}) as Record<string, unknown>;
  return (o.detail as string) ?? (o.error as string) ?? (o.reason as string) ?? (status ? `Error ${status}` : "Please try again.");
}

export function Chip({ map, value, label, className }: { map: Record<string, string>; value: string; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", map[value] ?? "bg-slate-100 text-slate-600", className)}>
      {(label ?? value).replace(/_/g, " ")}
    </span>
  );
}

export function complianceColor(pct: number | null | undefined): string {
  if (pct == null) return "text-slate-400";
  if (pct >= 90) return "text-emerald-600";
  if (pct >= 75) return "text-amber-600";
  return "text-rose-600";
}

export function complianceBg(pct: number | null | undefined): string {
  if (pct == null) return "bg-slate-300";
  if (pct >= 90) return "bg-emerald-500";
  if (pct >= 75) return "bg-amber-500";
  return "bg-rose-500";
}

// A-03 RAG thresholds (green ≥85 / amber 75–84 / red <75 / grey = not started).
export function ragBar(pct: number | null | undefined): string {
  if (pct == null) return "bg-slate-200";
  if (pct >= 85) return "bg-emerald-500";
  if (pct >= 75) return "bg-amber-500";
  return "bg-rose-500";
}
export function ragText(pct: number | null | undefined): string {
  if (pct == null) return "text-slate-400";
  if (pct >= 85) return "text-emerald-600";
  if (pct >= 75) return "text-amber-600";
  return "text-rose-600";
}

// INDUSTRY_LABEL was removed with the industry selector. `industryCode` is
// still on the audit row and still identifies which checkpoint library an audit
// materialised from — it is simply not something a user chooses or reads any
// more, so nothing renders it. Do not reintroduce a label map here without
// first deciding what an industry would mean on a single-checklist instance.
