// TypeScript shapes mirroring the Python Pydantic models in
// safeops_360_bakend/app/schemas/agent.py. Two repos, two type systems
// — when changing one, change the other. The drift-detection test on
// the backend covers tool registries but NOT these wire shapes; treat
// the field names below as a contract.
//
// If a field is renamed on the Python side without updating these, the
// frontend will silently render undefined for that field — review
// AgentInvocationOut + HumanDecisionRequest in app/schemas/agent.py
// when touching either side.

import type { RcaMethod } from "@/lib/rca/types";

// ─── Wire types ─────────────────────────────────────────────────────────

export type AgentInvocationStatus =
  | "RUNNING"
  | "PENDING_REVIEW"
  | "ACCEPTED"
  | "MODIFIED"
  | "REJECTED"
  | "EXPIRED"
  | "ERRORED";

export type HallucinationFinding = {
  type: string;
  recordType?: string;
  value: string;
  context?: string;
};

export type AgentToolCallOut = {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: unknown;
  executionMs: number | null;
  hadError: boolean;
  errorDetails: string | null;
  sequence: number;
  invokedAt: string;
};

// Shape of `agentSuggestion` (set by the system prompt's contract).
// Unknown-shape `draftAnalysis` because the methodology determines its
// structure — load it into the RcaEditor via setRcaData rather than
// rendering its internals directly here.
export type RcaSuggestion = {
  recommendedMethod: RcaMethod;
  methodRationale: string;
  draftAnalysis: unknown;
  proposedRootCauses: string[];
  contributingFactors: string[];
  evidenceGaps: string[];
  similarCasesReferenced: {
    incidentNumber: string;
    relevance: string;
  }[];
  caveats: string[];
};

export type AgentInvocationOut = {
  id: string;
  invocationNumber: string;
  agentId: string;
  invocationTrigger: string;
  invokedAt: string;
  invokedById: string | null;
  sourceModule: string;
  sourceRecordId: string;
  sourceRecordType: string;
  sourcePlantId: string | null;
  authorityLevelUsed: string;
  promptVersionId: string;
  modelUsed: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalCostUsd: number | null;
  latencyMs: number | null;
  agentReasoning: string | null;
  agentSuggestion: RcaSuggestion | { _unparsed: string } | null;
  agentConfidence: number | null;
  status: AgentInvocationStatus;
  humanDecisionAt: string | null;
  humanDecisionById: string | null;
  humanDecision: string | null;
  humanModifications: Record<string, unknown> | null;
  rejectionReason: string | null;
  ratingByHuman: number | null;
  detailedFeedback: string | null;
  hadError: boolean;
  errorType: string | null;
  errorDetails: string | null;
  hallucinationFlagged: boolean;
  hallucinationDetails: HallucinationFinding[] | null;
  toolCalls: AgentToolCallOut[];
};

// Type-guard separating a parsed suggestion from the "_unparsed" fallback
// produced when the model emitted invalid JSON inside <suggestion>.
export function isParsedSuggestion(
  s: AgentInvocationOut["agentSuggestion"]
): s is RcaSuggestion {
  return s != null && typeof s === "object" && !("_unparsed" in s);
}

// ─── Request types ──────────────────────────────────────────────────────

export type InvokeAgentRequest = {
  sourceModule: "INCIDENT";
  sourceRecordId: string;
  forceEscalationModel?: boolean;
};

export type InvocationStartedResponse = {
  invocationId: string;
  invocationNumber: string;
  status: AgentInvocationStatus;
  pollUrl: string;
};

export type HumanDecision =
  | "ACCEPT_AS_IS"
  | "ACCEPT_WITH_MODIFICATION"
  | "REJECT";

export type HumanDecisionRequest = {
  decision: HumanDecision;
  humanModifications?: Record<string, unknown>;
  rejectionReason?: string;
  rating?: number;
  feedback?: string;
};

// ─── Tool labels (UX only — display strings) ────────────────────────────

// Maps the 9 RCA tool names to friendly labels for the progress UI.
// Kept here (not in the prompt) so changing a label doesn't churn the
// agent prompt or trigger a prompt re-version.
export const TOOL_LABELS: Record<string, string> = {
  find_similar_incidents: "Searching similar past incidents",
  find_related_observations: "Looking for missed warnings",
  find_related_near_misses: "Checking related near misses",
  get_equipment_history: "Reviewing equipment history",
  get_training_records: "Verifying training currency",
  get_active_permits_at_time: "Checking active permits",
  search_documents_reviewed: "Searching reviewed documents",
  check_recent_changes: "Checking recent changes",
  get_industry_benchmark: "Looking up industry benchmarks",
  echo_incident_summary: "Reviewing incident facts"
};
