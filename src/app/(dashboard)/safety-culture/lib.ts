// Safety Culture Management — shared types, palette and client fetch helpers.
// The per-site score aggregates five components and feeds the ERM Risk Register
// as a KRI (see /erm/kris — "Human Factor / Safety Culture Risk").

export const STAGES = ["Reactive", "Dependent", "Independent", "Interdependent"] as const;
export type Stage = (typeof STAGES)[number];

// Midnight Executive palette (build spec §0) — navy / gold / ice, applied as
// accents over the app's existing card system.
export const PALETTE = {
  navy: "#0B1F4D",
  gold: "#C9A961",
  ice: "#E8EEF7",
};

// Stage → colour ramp (Reactive = red → Interdependent = green), tuned to read
// in the Midnight Executive language.
export const STAGE_COLOR: Record<Stage, string> = {
  Reactive: "#B4232A",
  Dependent: "#C9761F",
  Independent: "#2F6DB4",
  Interdependent: "#1F7A4D",
};

export const STAGE_BG: Record<Stage, string> = {
  Reactive: "#FBEAEA",
  Dependent: "#FBF1E4",
  Independent: "#E9F1FB",
  Interdependent: "#E6F4EC",
};

// `tip` documents each component's exact inputs on screen (§Fix 6). Worker
// Participation explicitly discloses the one raw input it shares with BBS Quality
// (an observation exists) so all five aren't presented as fully independent.
export const COMPONENT_META: { key: string; label: string; weight: number; tip: string }[] = [
  {
    key: "leadershipEngagement",
    label: "Leadership Engagement",
    weight: 30,
    tip: "Leadership-walk compliance-to-schedule (×0.6) blended with walk quality (×0.4). Source: Leadership Walks.",
  },
  {
    key: "workerParticipation",
    label: "Worker Participation",
    weight: 20,
    tip: "Breadth: distinct people who logged an observation, reported a near-miss, or led a walk in the last 90 days ÷ headcount. Shares one raw input with BBS Quality (an observation exists); BBS measures the quality of those observations, this measures reach — disclosed, not double-counted.",
  },
  {
    key: "leadingLaggingRatio",
    label: "Leading / Lagging Ratio",
    weight: 20,
    tip: "Leading activity (observations, near-misses, audits, trainings) ÷ lagging events (incidents, injuries), scored against a site-configurable target. Click to open the drill-down.",
  },
  {
    key: "bbsQualityIndex",
    label: "BBS Quality Index",
    weight: 20,
    tip: "Quality-weighted, per-observer-capped, closure-loop-multiplied observation index (not raw count). Source: Observations + closure loop.",
  },
  {
    key: "perceptionIndex",
    label: "Perception Index",
    weight: 10,
    tip: "Latest threshold-met anonymous perception survey composite (trust, psychological safety, management commitment, peer accountability).",
  },
];

// ── §Fix 2 Leading / Lagging Ratio drill-down ────────────────────────────────
export type LeadingLaggingBreakdown = {
  observations: number;
  nearMisses: number;
  audits: number;
  trainings: number;
  incidents: number;
  injuries: number;
};

export type LeadingLaggingPoint = {
  period: string;
  leading: number;
  lagging: number;
  ratio: number;
  score: number;
};

export type LeadingLaggingDetail = {
  plantId: string;
  industryVertical?: string | null;
  score: number;
  ratio: number;
  leading: number;
  lagging: number;
  breakdown: LeadingLaggingBreakdown;
  target: number;
  underReporting: boolean;
  trend: LeadingLaggingPoint[];
};

export type ComponentScores = Record<string, number>;

export type MaturityProfile = {
  plantId: string;
  currentStage: Stage;
  stageScore: number;
  industryVertical?: string | null;
  componentScores: ComponentScores;
  history: { period: string; stageScore: number; currentStage: Stage; componentScores: ComponentScores }[];
  lastCalculatedAt: string | null;
};

export type EnterpriseSite = {
  plantId: string;
  plantName: string;
  plantCode: string;
  state: string | null;
  currentStage: Stage;
  stageScore: number;
  componentScores: ComponentScores;
  lastCalculatedAt: string | null;
};

export type EnterpriseRollup = {
  enterpriseScore: number;
  siteCount: number;
  stageCounts: Record<string, number>;
  sites: EnterpriseSite[];
};

export type PlantOption = { id: string; code: string; name: string };

export function scoreColor(score: number): string {
  if (score <= 25) return STAGE_COLOR.Reactive;
  if (score <= 50) return STAGE_COLOR.Dependent;
  if (score <= 75) return STAGE_COLOR.Independent;
  return STAGE_COLOR.Interdependent;
}

export function stageForScore(score: number): Stage {
  if (score <= 25) return "Reactive";
  if (score <= 50) return "Dependent";
  if (score <= 75) return "Independent";
  return "Interdependent";
}

// ── Client-side fetch through the catch-all proxy (mints token + x-active-plant)
export async function cultureGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/culture${path}`, { cache: "no-store" });
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

export async function cultureSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/culture${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

async function toError(res: Response): Promise<Error> {
  try {
    const j = await res.json();
    const detail = j?.detail ?? j?.message ?? j?.reason;
    if (typeof detail === "string") return new Error(detail);
    if (Array.isArray(detail)) return new Error(detail.map((d: any) => d?.msg).filter(Boolean).join("; "));
    if (detail?.message) return new Error(detail.message);
  } catch {
    /* fall through */
  }
  return new Error(`Request failed (${res.status})`);
}
