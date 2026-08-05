// Daily Alert Brief — client types (mirror of /api/dashboard/daily-brief + /api/alerts).

export type AlertSeverity = "critical" | "attention" | "info";
export type AlertStatus = "new" | "acknowledged" | "resolved" | "muted";
// Executive Sentinel tier (spec §1.3) — the display band, richer than severity.
export type BriefTier = "critical" | "attention" | "watch";
export type BriefLens = "executive" | "hse_manager" | "site_lead";

export type ImpactedEntity = {
  type: string;
  id: string;
  ref: string;
  label: string;
  href: string;
};

export type ScoreComponents = {
  seriousPotential: number;
  overdue: number;
  cluster: number;
  severity: number;
  freshness: number;
  confidence: number;
};

export type AlertOut = {
  id: string;
  siteId: string | null;
  severity: AlertSeverity;
  title: string;
  bodyText: string;
  bodyTemplateKey: string | null;
  bodyParams: Record<string, unknown>;
  sourceEventType: string | null;
  impactedEntities: ImpactedEntity[];
  deepLink: string | null;
  dedupeKey: string;
  count: number;
  status: AlertStatus;
  ackBy: string | null;
  ackAt: string | null;
  mutedUntil: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  // ── Brief Priority Score (spec §1.2) — computed server-side, inspectable ──
  priorityScore: number;
  scoreComponents: ScoreComponents;
  tier: BriefTier;
  earlySignal: boolean;
};

export type BriefNumber = {
  key: string;
  label: string;
  value: number;
  delta: number | null;
};

export type SiteComparison = {
  siteId: string;
  code: string;
  name: string;
  critical: number;
  attention: number;
};

export type DailyBriefPayload = {
  generatedAt: string;
  window: "24h" | "7d";
  role: BriefLens;
  sites: { id: string; code: string; name: string }[];
  siteId: string | null;
  siteComparison: SiteComparison[];
  feed: AlertOut[];
  acknowledgedThisWeek: number;
  numbers: BriefNumber[];
  fieldPulse: {
    windowHours: number;
    total: number;
    voicePct: number;
    offlinePct: number;
    byArea: { area: string; count: number }[];
  };
  agingWatch: { type: string; ref: string; label: string; ageDays: number; href: string }[];
};
