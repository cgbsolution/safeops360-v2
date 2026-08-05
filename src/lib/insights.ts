// AI Insights — frontend contract + tolerant server fetch.
//
// Mirrors the backend `InsightResponse` (app/schemas/insights.py). The engine
// is deterministic and airgap-safe; this helper only fetches + degrades. A
// failed / disabled insight call must NEVER break a list screen — the page
// renders exactly as before (no bar, no chips), so `fetchInsights` swallows
// errors and returns null.

import { backendFetch } from "@/lib/backend/fetch";

export type InsightKind =
  | "trend"
  | "cluster"
  | "anomaly"
  | "predictive_risk"
  | "next_best_action"
  | "duplicate"
  | "overdue_escalation";

export type InsightSeverity = "info" | "watch" | "high" | "critical";
export type InsightConfidence = "low" | "medium" | "high";

export interface Insight {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  headline: string;
  evidence: string;
  recordRefs: string[];
  suggestedAction?: string | null;
  confidence: InsightConfidence;
}

export interface Signal {
  recordId: string;
  recordRef: string;
  kind: InsightKind;
  severity: InsightSeverity;
  label: string;
  evidence: string;
  suggestedAction?: string | null;
  /** Row-Level Insight Layer (Part 3): a query string the host list page
   *  understands (e.g. "?cat=ELECTRICAL&area=<id>"). When present, clicking the
   *  chip narrows the list to this signal's cluster/location. */
  filterHref?: string | null;
}

export interface InsightResponse {
  module: string;
  plant: string | null;
  generatedAt: string;
  bar: Insight[];
  signals: Signal[];
  recordCount: number;
  suppressed: boolean;
  reason: string | null;
  cached: boolean;
}

export interface InsightBundle {
  bar: Insight[];
  /** recordId → the single highest-priority signal, for O(1) row lookup. The
   *  seven non-observation list screens render one chip per row from this. */
  signalByRecord: Map<string, Signal>;
  /** recordId → ALL signals for that record, priority-ordered. The Row-Level
   *  Insight Layer (Observations) renders a SignalChipGroup from this so a row
   *  can carry several chips with a "+N" overflow. `signalByRecord.get(id)`
   *  equals `signalsByRecord.get(id)?.[0]`. */
  signalsByRecord: Map<string, Signal[]>;
}

const EMPTY: InsightBundle = {
  bar: [],
  signalByRecord: new Map(),
  signalsByRecord: new Map(),
};

/**
 * Server-side insight fetch for a list screen. Tolerant: any failure (backend
 * down, module unknown, auth) degrades to the empty bundle so the list still
 * renders. Pass the active `plant` id when the screen is plant-scoped; omit it
 * to mirror an all-plants list view.
 */
export async function fetchInsights(
  module: string,
  opts: { plant?: string; from?: string; to?: string } = {}
): Promise<InsightBundle> {
  try {
    const res = await backendFetch<InsightResponse>(`/api/insights/${module}`, {
      query: { plant: opts.plant, from: opts.from, to: opts.to },
    });
    // Group signals by record, preserving the backend's priority order (the
    // engine emits a record's most important signal first). `signalByRecord`
    // keeps that first one so single-chip screens are unchanged.
    const signalsByRecord = new Map<string, Signal[]>();
    for (const s of res.signals ?? []) {
      const arr = signalsByRecord.get(s.recordId);
      if (arr) arr.push(s);
      else signalsByRecord.set(s.recordId, [s]);
    }
    const signalByRecord = new Map<string, Signal>();
    for (const [id, arr] of signalsByRecord) signalByRecord.set(id, arr[0]);
    return { bar: res.bar ?? [], signalByRecord, signalsByRecord };
  } catch {
    return EMPTY;
  }
}
