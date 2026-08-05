// Guided Field Capture — shared client types (mirror of the FastAPI payloads).

export type TaxNode = {
  id: string;
  kind: "HAZARD" | "CAUSE" | "CONTROL";
  level: number;
  parentId: string | null;
  code: string;
  labels: Record<string, string>; // { en, hi }
  iconKey: string | null;
  fishboneCategory: string | null;
  sortWeight: number;
};

// DuPont STOP taxonomy (/api/observation-taxonomy). Distinct from TaxNode:
// this master is scoped to the act/condition axis, and the categories endpoint
// only returns categories that actually have sub-categories on that axis — so
// "Reactions of People" / "Positions of People" never arrive for a Condition.
export type StopCategory = {
  categoryCode: string;
  categoryLabel: string;
  stopReferenceCode: string;
  displayOrder?: number;
};

export type StopSubCategory = {
  subCategoryCode: string;
  subCategoryLabel: string;
  categoryCode: string;
  stopReferenceCode: string;
  displayOrder?: number;
};

export type CaptureEquipment = { id: string; code: string; name: string; location: string | null };

export type CaptureBootstrap = {
  user: { id: string; name: string; plantId: string | null };
  plant: { id: string; code: string; name: string } | null;
  areas: { id: string; name: string }[];
  equipment: CaptureEquipment[];
  taxonomyVersion: number;
  features: { aiCaptureAssist: boolean; voiceTranscription: boolean; dailyBriefDigest: boolean };
};

export type SubmissionType = "observation" | "near_miss" | "unsafe_condition" | "incident" | "ptw" | "flra";
export type SelfSeverity = "low" | "medium" | "high";

export type CleanupTextResponse = { ok: boolean; reason?: string; original: string; cleaned?: string };
export type DraftDescriptionResponse = { ok: boolean; reason?: string; description?: string; descriptionEn?: string };
export type SuggestCategoryResponse = {
  ok: boolean;
  reason?: string;
  l1?: { id: string; code: string; labels: Record<string, string>; iconKey: string | null };
  l2?: { id: string; code: string; labels: Record<string, string>; iconKey: string | null } | null;
  confidence?: number;
};

export type SubmissionOut = {
  id: string;
  number: string;
  clientSubmissionId: string;
  type: SubmissionType;
  status: "submitted" | "triaged" | "converted" | "closed" | "rejected";
  isAnonymous: boolean;
  reporter: { id: string; name: string; designation: string | null } | null;
  plantId: string;
  areaId: string | null;
  mapPinX: number | null;
  mapPinY: number | null;
  equipmentId: string | null;
  qrScanned: boolean;
  categoryL1Id: string | null;
  categoryL2Id: string | null;
  categorySnapshot: {
    l1?: { code: string; labels: Record<string, string>; iconKey: string | null } | null;
    l2?: { code: string; labels: Record<string, string>; iconKey: string | null } | null;
  } | null;
  aiSuggested: boolean;
  aiConfidence: number | null;
  severitySelfReported: SelfSeverity;
  description: string | null;
  voiceLangCode: string | null;
  transcriptOriginal: string | null;
  transcriptEnglish: string | null;
  transcriptionStatus: string;
  triage: {
    triagedById: string | null;
    triagedAt: string | null;
    hiraLikelihood: number | null;
    hiraSeverity: number | null;
    riskScore: number | null;
    riskLevel: string | null;
    note: string | null;
  };
  converted: { entityType: string | null; entityId: string | null; at: string | null };
  goldenThread: { linkedRcaIds: string[]; linkedCapaIds: string[]; linkedPtwIds: string[] };
  capture: {
    tapCount: number | null;
    durationMs: number | null;
    offline: boolean;
    appVersion: string | null;
    deviceLang: string | null;
  };
  createdAtClient: string | null;
  createdAt: string | null;
  attachments: AttachmentOut[];
  replayed?: boolean;
};

export type AttachmentOut = {
  id: string;
  kind: "PHOTO" | "VIDEO" | "VOICE" | "DOCUMENT";
  fileName: string;
  fileSize: number;
  mimeType: string;
  durationSec: number | null;
  caption: string | null;
  clientMediaId: string | null;
  uploadedAt: string | null;
};

export type VisionSuggestResponse = {
  ok: boolean;
  reason?: string;
  provider?: string;
  l1?: { id: string; code: string; labels: Record<string, string>; iconKey: string | null };
  l2?: { id: string; code: string; labels: Record<string, string>; iconKey: string | null } | null;
  /** The same suggestion expressed in the DuPont STOP taxonomy, resolved
   *  server-side for both axes so the observation flow can apply it to
   *  whichever the reporter picked. Absent/empty when the taxonomy master
   *  isn't seeded — the card then hides rather than offering a dead control. */
  stop?: Partial<
    Record<
      "ACT" | "CONDITION",
      {
        categoryCode: string;
        categoryLabel: string;
        subCategoryCode: string;
        subCategoryLabel: string;
        stopReferenceCode: string;
      }
    >
  >;
  description?: string;
  descriptionEn?: string;
  confidence?: number;
};

/** Media captured in the wizard, pre-upload. */
export type WizardMedia = {
  clientMediaId: string;
  kind: "PHOTO" | "VIDEO" | "VOICE";
  blob: Blob;
  fileName: string;
  mimeType: string;
  durationSec?: number;
  previewUrl?: string;
};
