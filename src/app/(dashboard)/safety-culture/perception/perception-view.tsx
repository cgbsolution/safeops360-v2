"use client";

// Worker Perception Survey — anonymous culture-perception capture + index.
// Anonymity is the headline: individual responses are never linked to a person,
// and dimension scores stay withheld until a minimum response threshold is met.
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { ScoreDial } from "../ui";
import { PALETTE, scoreColor, cultureSend, type PlantOption } from "../lib";

// ── Types (perception surveys aren't in the shared lib; declared here) ────────
export type ResponseRate = {
  plantId: string;
  period: string;
  responseCount: number;
  responseRatePercent: number;
  thresholdMet: boolean;
};

export type PerceptionIndex =
  | {
      plantId: string;
      period: string;
      thresholdMet: false;
      responseCount: number;
      responseRatePercent: number;
      message: string;
    }
  | {
      plantId: string;
      period: string;
      thresholdMet: true;
      dimensionScores: {
        trustInReporting: number;
        psychologicalSafety: number;
        managementCommitment: number;
        peerAccountability: number;
      };
      compositeScore: number;
      responseCount: number;
      responseRatePercent: number;
    };

export type Dimension =
  | "TrustInReporting"
  | "PsychologicalSafety"
  | "ManagementCommitment"
  | "PeerAccountability";

export type SurveyQuestion = {
  id: string;
  text: string;
  dimension: Dimension;
  scaleType: "likert5";
};

export type SurveyTemplate = {
  id: string;
  name: string;
  description?: string | null;
  industryVertical?: string | null;
  cadence: string;
  isActive: boolean;
  questions: SurveyQuestion[];
};

export type TemplatesResponse = { items: SurveyTemplate[] };

export type PerceptionTrend = {
  plantId: string;
  series: {
    period: string;
    compositeScore: number;
    dimensionScores: {
      trustInReporting?: number;
      psychologicalSafety?: number;
      managementCommitment?: number;
      peerAccountability?: number;
    };
    responseRatePercent?: number;
  }[];
  benchmarkComposite: number | null;
  benchmarkLabel: string;
};

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: "TrustInReporting", label: "Trust in Reporting" },
  { value: "PsychologicalSafety", label: "Psychological Safety" },
  { value: "ManagementCommitment", label: "Management Commitment" },
  { value: "PeerAccountability", label: "Peer Accountability" },
];

const LIKERT: { score: number; label: string }[] = [
  { score: 1, label: "Strongly Disagree" },
  { score: 2, label: "Disagree" },
  { score: 3, label: "Neutral" },
  { score: 4, label: "Agree" },
  { score: 5, label: "Strongly Agree" },
];

// ── Root ──────────────────────────────────────────────────────────────────
export function PerceptionView({
  plantId,
  period,
  rate,
  index,
  templates,
  trend,
}: {
  plantId: string;
  plants: PlantOption[];
  period: string;
  rate: ResponseRate;
  index: PerceptionIndex;
  templates: TemplatesResponse;
  trend: PerceptionTrend;
}) {
  const items = templates?.items ?? [];

  return (
    <div className="space-y-6">
      <AnonymityBanner />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerceptionIndexCard index={index} period={period} />
        </div>
        <ResponseRateCard rate={rate} period={period} />
      </div>

      <DimensionTrendCard trend={trend} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SurveyCard plantId={plantId} period={period} templates={items} />
        <AdminPanel templates={items} />
      </div>
    </div>
  );
}

// ── Dimension-level trend (§Fix 4 — needs ≥2 threshold-met periods) ───────────
const TREND_DIMENSIONS: { key: keyof PerceptionTrend["series"][number]["dimensionScores"]; label: string; color: string }[] = [
  { key: "trustInReporting", label: "Trust in Reporting", color: "#0B1F4D" },
  { key: "psychologicalSafety", label: "Psychological Safety", color: "#2F6DB4" },
  { key: "managementCommitment", label: "Management Commitment", color: "#C9A961" },
  { key: "peerAccountability", label: "Peer Accountability", color: "#1F7A4D" },
];

function DimensionTrendCard({ trend }: { trend: PerceptionTrend }) {
  const series = trend?.series ?? [];
  if (series.length < 2) {
    return (
      <div className="rounded-xl border bg-white p-5">
        <p className="text-sm font-semibold" style={{ color: PALETTE.navy }}>
          Dimension trend
        </p>
        <p className="mt-2 text-sm text-slate-500">
          A period-over-period trend for each of the four dimensions appears here once this site has completed{" "}
          <span className="font-semibold">two or more</span> threshold-met survey periods. So far:{" "}
          {series.length === 1 ? "one period" : "no periods"}.
        </p>
      </div>
    );
  }

  const data = series.map((s) => ({
    period: s.period,
    trustInReporting: clamp(s.dimensionScores?.trustInReporting ?? 0),
    psychologicalSafety: clamp(s.dimensionScores?.psychologicalSafety ?? 0),
    managementCommitment: clamp(s.dimensionScores?.managementCommitment ?? 0),
    peerAccountability: clamp(s.dimensionScores?.peerAccountability ?? 0),
  }));

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: PALETTE.navy }}>
          Dimension trend
        </p>
        {trend.benchmarkComposite != null && (
          <span className="text-xs text-slate-500">
            {trend.benchmarkLabel}: <span className="font-semibold text-slate-700">{Math.round(trend.benchmarkComposite)}</span>
          </span>
        )}
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#EEF2F7" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {trend.benchmarkComposite != null && (
              <ReferenceLine
                y={trend.benchmarkComposite}
                stroke="#94A3B8"
                strokeDasharray="4 4"
                label={{ value: "Cross-site avg", fontSize: 10, fill: "#64748B", position: "insideTopRight" }}
              />
            )}
            {TREND_DIMENSIONS.map((d) => (
              <Line
                key={d.key}
                type="monotone"
                dataKey={d.key}
                name={d.label}
                stroke={d.color}
                strokeWidth={2}
                dot={{ r: 2.5 }}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Benchmark line is the cross-site average composite for the latest period — directional only, not an external
        dataset.
      </p>
    </div>
  );
}

// ── Anonymity headline ──────────────────────────────────────────────────────
function AnonymityBanner() {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-4 text-sm"
      style={{ borderColor: PALETTE.gold, background: "linear-gradient(90deg,#0B1F4D,#122a5e)" }}
    >
      <span className="mt-0.5 text-lg" style={{ color: PALETTE.gold }}>
        ◆
      </span>
      <div className="text-white/90">
        <span className="font-semibold text-white">Responses are fully anonymous</span> — no response is
        ever linked to an individual. Dimension scores are withheld until a minimum response threshold is
        met to protect anonymity.
      </div>
    </div>
  );
}

// ── Perception index (radar + composite, or withheld notice) ────────────────
function PerceptionIndexCard({ index, period }: { index: PerceptionIndex; period: string }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: PALETTE.navy }}>
            Perception Index
          </p>
          <p className="text-xs text-slate-500">Period {period}</p>
        </div>
      </div>

      {index.thresholdMet ? (
        <IndexRevealed index={index} />
      ) : (
        <IndexWithheld
          message={index.message}
          responseCount={index.responseCount}
          responseRatePercent={index.responseRatePercent}
        />
      )}
    </div>
  );
}

function IndexRevealed({ index }: { index: Extract<PerceptionIndex, { thresholdMet: true }> }) {
  const d = index.dimensionScores;
  const radarData = [
    { dimension: "Trust in Reporting", value: clamp(d.trustInReporting) },
    { dimension: "Psychological Safety", value: clamp(d.psychologicalSafety) },
    { dimension: "Management Commitment", value: clamp(d.managementCommitment) },
    { dimension: "Peer Accountability", value: clamp(d.peerAccountability) },
  ];

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[1fr,auto]">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="72%">
            <PolarGrid stroke="#E2E8F0" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 11, fill: "#475569" }}
            />
            <PolarRadiusAxis
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: "#94A3B8" }}
              axisLine={false}
            />
            <Radar
              name="Perception"
              dataKey="value"
              stroke={PALETTE.navy}
              fill={PALETTE.navy}
              fillOpacity={0.28}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col items-center gap-3">
        <ScoreDial score={clamp(index.compositeScore)} label="Composite" />
        <div className="w-full space-y-1.5">
          {radarData.map((r) => (
            <div key={r.dimension} className="flex items-center justify-between text-xs">
              <span className="text-slate-600">{r.dimension}</span>
              <span className="font-semibold" style={{ color: scoreColor(r.value) }}>
                {Math.round(r.value)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          Based on {index.responseCount} anonymous responses ·{" "}
          {Math.round(index.responseRatePercent)}% response rate
        </p>
      </div>
    </div>
  );
}

function IndexWithheld({
  message,
  responseCount,
  responseRatePercent,
}: {
  message: string;
  responseCount: number;
  responseRatePercent: number;
}) {
  const pct = clamp(responseRatePercent);
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg shadow-sm">
        🔒
      </div>
      <p className="text-sm font-medium text-slate-700">Dimension scores withheld</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
        {message || "Not enough responses yet to publish scores while protecting anonymity."}
      </p>

      <div className="mx-auto mt-4 max-w-sm">
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>Response rate toward threshold</span>
          <span className="font-semibold text-slate-700">{Math.round(pct)}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PALETTE.gold }} />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          {responseCount} anonymous {responseCount === 1 ? "response" : "responses"} so far
        </p>
      </div>
    </div>
  );
}

// ── Response rate ───────────────────────────────────────────────────────────
function ResponseRateCard({ rate, period }: { rate: ResponseRate; period: string }) {
  const pct = clamp(rate?.responseRatePercent ?? 0);
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: PALETTE.navy }}>
            Response Rate
          </p>
          <p className="text-xs text-slate-500">Period {period}</p>
        </div>
        {rate?.thresholdMet ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Threshold met
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Below threshold
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold" style={{ color: PALETTE.navy }}>
          {Math.round(pct)}%
        </span>
        <span className="text-xs text-slate-500">participation</span>
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: rate?.thresholdMet ? "#1F7A4D" : PALETTE.gold }}
        />
      </div>

      <p className="mt-3 text-sm text-slate-600">
        <span className="font-semibold text-slate-800">{rate?.responseCount ?? 0}</span> anonymous{" "}
        {(rate?.responseCount ?? 0) === 1 ? "response" : "responses"} collected this period.
      </p>
    </div>
  );
}

// ── Take the survey ─────────────────────────────────────────────────────────
function SurveyCard({
  plantId,
  period,
  templates,
}: {
  plantId: string;
  period: string;
  templates: SurveyTemplate[];
}) {
  const router = useRouter();
  const active = templates.find((t) => t.isActive) ?? null;
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const questions = active?.questions ?? [];

  async function submit() {
    if (!active) return;
    setError(null);
    const responses = questions.map((q) => ({ questionId: q.id, score: answers[q.id] }));
    if (responses.some((r) => !r.score)) {
      setError("Please answer every statement before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await cultureSend(`/api/culture/perception-surveys/${active.id}/respond`, "POST", {
        plantId,
        period,
        responses,
      });
      setDone(true);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm font-semibold" style={{ color: PALETTE.navy }}>
        Take the survey
      </p>
      <p className="mt-1 text-xs text-slate-500">
        A few quick statements — rate each from Strongly Disagree to Strongly Agree. It takes under two
        minutes, and your answers stay anonymous.
      </p>

      {!active ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          No active survey is available for this period.
        </div>
      ) : done ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm">
            ✓
          </div>
          <p className="text-sm font-semibold text-emerald-800">Thank you — your response was recorded.</p>
          <p className="mt-1 text-xs text-emerald-700">
            It has been captured anonymously and cannot be traced back to you.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-sm text-slate-700">
                <span className="mr-1.5 text-xs font-semibold text-slate-400">{i + 1}.</span>
                {q.text}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {LIKERT.map((opt) => {
                  const selected = answers[q.id] === opt.score;
                  return (
                    <button
                      key={opt.score}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.score }))}
                      className={`flex-1 min-w-[92px] rounded-md border px-2 py-1.5 text-[11px] font-medium transition ${
                        selected ? "text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      style={selected ? { background: PALETTE.navy, borderColor: PALETTE.navy } : undefined}
                    >
                      <span className="block text-sm font-bold">{opt.score}</span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-400">
              {Object.keys(answers).length}/{questions.length} answered
            </p>
            <button
              onClick={submit}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: PALETTE.navy }}
            >
              {submitting ? "Submitting…" : "Submit anonymously"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin (create + list templates) ─────────────────────────────────────────
type QuestionRow = { id: string; text: string; dimension: Dimension };

function newRow(): QuestionRow {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, text: "", dimension: "TrustInReporting" };
}

function AdminPanel({ templates }: { templates: SurveyTemplate[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [industryVertical, setIndustryVertical] = React.useState("");
  const [rows, setRows] = React.useState<QuestionRow[]>([newRow(), newRow()]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  async function create() {
    setError(null);
    setOk(false);
    if (!name.trim()) {
      setError("Give the template a name.");
      return;
    }
    const questions = rows
      .filter((r) => r.text.trim())
      .map((r) => ({
        id: r.id,
        text: r.text.trim(),
        dimension: r.dimension,
        scaleType: "likert5" as const,
      }));
    if (questions.length === 0) {
      setError("Add at least one question.");
      return;
    }
    setSaving(true);
    try {
      await cultureSend("/api/culture/perception-surveys/templates", "POST", {
        name: name.trim(),
        description: description.trim() || undefined,
        industryVertical: industryVertical.trim() || undefined,
        cadence: "QUARTERLY",
        questions,
      });
      setOk(true);
      setName("");
      setDescription("");
      setIndustryVertical("");
      setRows([newRow(), newRow()]);
      router.refresh();
    } catch (e: any) {
      const msg = e?.message ?? "Failed to create template";
      if (/forbid|not authori|permission|denied|403/i.test(msg)) {
        setBlocked(true);
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: PALETTE.navy }}>
          Survey templates
        </p>
        {!blocked && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {open ? "Close" : "Manage templates"}
          </button>
        )}
      </div>

      {/* Existing templates list */}
      <div className="mt-4 space-y-2">
        {templates.length === 0 && (
          <p className="text-xs text-slate-400">No templates defined yet.</p>
        )}
        {templates.map((t) => {
          const dims = Array.from(new Set((t.questions ?? []).map((q) => q.dimension)));
          return (
            <div key={t.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-800">{t.name}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    t.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {t.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {t.description && <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                <span className="font-semibold text-slate-600">
                  {(t.questions ?? []).length} question{(t.questions ?? []).length === 1 ? "" : "s"}
                </span>
                {t.cadence && <span>· {t.cadence}</span>}
                {dims.map((d) => (
                  <span key={d} className="rounded bg-slate-100 px-1.5 py-0.5">
                    {DIMENSIONS.find((x) => x.value === d)?.label ?? d}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create form */}
      {open && !blocked && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New template</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
          <input
            value={industryVertical}
            onChange={(e) => setIndustryVertical(e.target.value)}
            placeholder="Industry vertical (optional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />

          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Cadence <span className="font-semibold text-slate-700">Quarterly</span>
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2">
                <input
                  value={r.text}
                  onChange={(e) =>
                    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)))
                  }
                  placeholder={`Question ${i + 1}`}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
                <select
                  value={r.dimension}
                  onChange={(e) =>
                    setRows((rs) =>
                      rs.map((x) => (x.id === r.id ? { ...x, dimension: e.target.value as Dimension } : x))
                    )
                  }
                  className="rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-600 focus:border-primary-500 focus:outline-none"
                >
                  {DIMENSIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                    className="text-slate-400 hover:text-rose-600"
                    aria-label="Remove question"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRows((rs) => [...rs, newRow()])}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              + Add question
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {error}
            </div>
          )}
          {ok && <p className="text-xs text-emerald-700">Template created.</p>}

          <button
            onClick={create}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: PALETTE.navy }}
          >
            {saving ? "Saving…" : "Create template"}
          </button>
        </div>
      )}

      {blocked && (
        <p className="mt-3 text-[11px] text-slate-400">
          Template management requires the Survey Admin role.
        </p>
      )}
    </div>
  );
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
