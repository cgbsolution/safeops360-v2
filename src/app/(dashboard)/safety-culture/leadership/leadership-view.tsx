"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PALETTE, scoreColor, cultureGet, cultureSend } from "../lib";
import { Sparkline } from "../ui";
import { formatUserRefText, type UserDirectory } from "@/lib/users/user-ref";

const HAZARD_CATEGORIES = [
  "PPE",
  "Housekeeping",
  "Work at Height",
  "Electrical",
  "Machine Guarding",
  "Material Handling",
  "Ergonomics",
  "Chemical Handling",
];

// ── Types (also imported by the server page for its fetch typing) ────────────

export type LeadershipCompliance = {
  complianceToSchedule: number;
  engagementScore: number;
  walkQuality: number;
  scheduledWalks: number;
  completedWalks: number;
};

export type WalkChecklist = {
  hazardCategories?: string[];
  workerInteractions?: { count: number; topic: string }[];
  ppeCompliance?: number | null;
  housekeepingRating?: number | null;
};

export type Walk = {
  id: string;
  plantId: string;
  leaderId: string;
  scheduledDate: string;
  completedDate: string | null;
  status: "Scheduled" | "Completed" | "Missed" | "Rescheduled";
  areaVisited: string | null;
  cadence: string | null;
  workersInteracted: number;
  observationsRaised: number;
  hazardsIdentified: number;
  notes: string | null;
  checklist: WalkChecklist | null;
  followUpActionIds: string[] | null;
  escalatedAt: string | null;
};

export type LeaderOption = { id: string; name: string; role?: string | null };

export type LeaderScorecard = {
  leaderId: string;
  scheduledWalks: number;
  completedWalks: number;
  complianceToSchedule: number;
  hazardsIdentified: number;
  workersInteracted: number;
  observationsRaised: number;
  rollingEngagementScore: number;
  complianceTrend?: { period: string; complianceToSchedule: number; scheduled: number; completed: number }[];
  recentWalks: {
    id: string;
    scheduledDate: string;
    completedDate: string | null;
    status: string;
    areaVisited: string | null;
    hazardsIdentified: number;
    workersInteracted: number;
  }[];
};

// ── Status chip styling ──────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Scheduled: { bg: "#E9F1FB", color: "#2F6DB4" },
  Completed: { bg: "#E6F4EC", color: "#1F7A4D" },
  Missed: { bg: "#FBEAEA", color: "#B4232A" },
  Rescheduled: { bg: "#FBF1E4", color: "#C9761F" },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "#F1F5F9", color: "#475569" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {status}
    </span>
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

// ── Main view ────────────────────────────────────────────────────────────────

export function LeadershipView({
  plantId,
  compliance,
  walks,
  leaders,
  userDir,
}: {
  plantId: string;
  compliance: LeadershipCompliance;
  walks: Walk[];
  leaders: LeaderOption[];
  userDir: UserDirectory;
}) {
  const upcoming = walks.filter((w) => w.status !== "Completed");
  const completed = walks.filter((w) => w.status === "Completed");

  // Merge leaders (from /api/users) with any leader referenced only by a walk.
  const leaderIds = React.useMemo(() => {
    const set = new Set<string>();
    leaders.forEach((l) => set.add(l.id));
    walks.forEach((w) => w.leaderId && set.add(w.leaderId));
    return Array.from(set);
  }, [leaders, walks]);

  const leaderLabel = React.useCallback(
    (id: string) => {
      const resolved = formatUserRefText(userDir, id);
      if (resolved && resolved !== "Unknown user" && resolved !== "—") return resolved;
      return leaders.find((l) => l.id === id)?.name ?? "Unknown user";
    },
    [userDir, leaders]
  );

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Compliance to schedule"
          value={`${Math.round(compliance.complianceToSchedule)}`}
          suffix="%"
          color={scoreColor(compliance.complianceToSchedule)}
          sub="Walks completed vs planned"
        />
        <KpiTile
          label="Completed / scheduled"
          value={`${compliance.completedWalks}`}
          suffix={` / ${compliance.scheduledWalks}`}
          sub="Walks this period"
        />
        <KpiTile
          label="Engagement score"
          value={`${Math.round(compliance.engagementScore)}`}
          color={scoreColor(compliance.engagementScore)}
          sub="Worker interaction depth"
        />
        <KpiTile
          label="Walk quality"
          value={`${Math.round(compliance.walkQuality)}`}
          color={scoreColor(compliance.walkQuality)}
          sub="Hazards & observations raised"
        />
      </div>

      <WalkFormulaCard />

      <div className="grid gap-6 lg:grid-cols-[1fr,1.1fr]">
        <Scheduler plantId={plantId} leaders={leaders} leaderIds={leaderIds} leaderLabel={leaderLabel} />
        <LeaderScorecardCard leaderIds={leaderIds} leaderLabel={leaderLabel} />
      </div>

      {/* Walks table */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WalksPanel
          title="Upcoming / Scheduled"
          empty="No scheduled walks — use the scheduler to plan one."
          walks={upcoming}
          leaderLabel={leaderLabel}
          canComplete
        />
        <WalksPanel
          title="Completed"
          empty="No walks logged yet."
          walks={completed}
          leaderLabel={leaderLabel}
        />
      </div>
    </div>
  );
}

// ── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  suffix,
  color,
  sub,
}: {
  label: string;
  value: string;
  suffix?: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold" style={{ color: color ?? PALETTE.navy }}>
        {value}
        {suffix && <span className="text-lg font-semibold text-slate-400">{suffix}</span>}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ── Formula explainer (§Fix 3 — the scores are no longer a black box) ─────────

function WalkFormulaCard() {
  return (
    <div className="rounded-xl border p-4 text-sm" style={{ borderColor: PALETTE.gold, background: "#FBF7EC" }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg" style={{ color: PALETTE.gold }}>
          ◆
        </span>
        <p className="font-semibold" style={{ color: PALETTE.navy }}>
          How Engagement & Walk Quality are scored
        </p>
      </div>
      <div className="grid gap-2 text-[13px] text-slate-700 sm:grid-cols-2">
        <p>
          <span className="font-semibold">Walk Quality</span> = clamp((workers interacted + hazards identified +
          observations raised) ÷ completed walks ÷ 12 × 100). ~12 combined signals per walk = full marks.
        </p>
        <p>
          <span className="font-semibold">Engagement Score</span> = compliance-to-schedule × 0.6 + Walk Quality × 0.4.
          It rolls straight into the 30%-weighted Leadership Engagement culture component.
        </p>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        A structured checklist (hazard categories, worker-interaction topics, PPE spot-check, housekeeping) is captured on
        completion; any hazard can be raised into the same BBS closure loop (Logged → Linked → Verified).
      </p>
    </div>
  );
}

// ── Scheduler ────────────────────────────────────────────────────────────────

function Scheduler({
  plantId,
  leaders,
  leaderIds,
  leaderLabel,
}: {
  plantId: string;
  leaders: LeaderOption[];
  leaderIds: string[];
  leaderLabel: (id: string) => string;
}) {
  const router = useRouter();
  const [leaderId, setLeaderId] = React.useState("");
  const [scheduledDate, setScheduledDate] = React.useState("");
  const [area, setArea] = React.useState("");
  const [cadence, setCadence] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Prefer the full leaders list; fall back to any id we saw on a walk.
  const options = leaders.length > 0 ? leaders.map((l) => l.id) : leaderIds;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!leaderId) {
      setError("Select a leader.");
      return;
    }
    if (!scheduledDate) {
      setError("Choose a scheduled date.");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        plantId,
        leaderId,
        scheduledDate: new Date(scheduledDate).toISOString(),
      };
      if (area.trim()) body.areaVisited = area.trim();
      if (cadence) body.cadence = cadence;
      if (notes.trim()) body.notes = notes.trim();
      await cultureSend("/leadership-walks", "POST", body);
      setLeaderId("");
      setScheduledDate("");
      setArea("");
      setCadence("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule walk");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="mb-1 text-sm font-semibold" style={{ color: PALETTE.navy }}>
        Leadership Walk Scheduler
      </p>
      <p className="mb-4 text-xs text-slate-500">Commit a leader to a dated shop-floor walk.</p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Leader</label>
          <select
            value={leaderId}
            onChange={(e) => setLeaderId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
          >
            <option value="">Select a leader…</option>
            {options.map((id) => (
              <option key={id} value={id}>
                {leaderLabel(id)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Scheduled date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Cadence</label>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
            >
              <option value="">One-off</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Area</label>
          <input
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="e.g. Cutting hall, Line 3"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: PALETTE.navy }}
        >
          {busy ? "Scheduling…" : "Schedule walk"}
        </button>
      </form>
    </div>
  );
}

// ── Walks panel + completion form ────────────────────────────────────────────

function WalksPanel({
  title,
  empty,
  walks,
  leaderLabel,
  canComplete = false,
}: {
  title: string;
  empty: string;
  walks: Walk[];
  leaderLabel: (id: string) => string;
  canComplete?: boolean;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [raiseId, setRaiseId] = React.useState<string | null>(null);

  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="mb-3 text-sm font-semibold" style={{ color: PALETTE.navy }}>
        {title}
        <span className="ml-2 text-xs font-normal text-slate-400">({walks.length})</span>
      </p>

      {walks.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="space-y-2">
          {walks.map((w) => (
            <div key={w.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{leaderLabel(w.leaderId)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {w.status === "Completed" ? fmtDate(w.completedDate) : fmtDate(w.scheduledDate)}
                    {w.areaVisited ? ` · ${w.areaVisited}` : ""}
                    {w.cadence ? ` · ${w.cadence.toLowerCase()}` : ""}
                  </p>
                  {w.status === "Completed" && (
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-600">
                      <Signal label="workers" value={w.workersInteracted} />
                      <Signal label="hazards" value={w.hazardsIdentified} />
                      <Signal label="observations" value={w.observationsRaised} />
                    </div>
                  )}
                  {w.checklist?.hazardCategories && w.checklist.hazardCategories.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {w.checklist.hazardCategories.map((c) => (
                        <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusChip status={w.status} />
                  {w.status === "Missed" && w.escalatedAt && (
                    <span className="text-[10px] font-medium text-rose-600" title={`Escalated ${fmtDate(w.escalatedAt)}`}>
                      ⚑ Escalated {fmtDate(w.escalatedAt)}
                    </span>
                  )}
                  {canComplete && (
                    <button
                      onClick={() => {
                        setOpenId(openId === w.id ? null : w.id);
                        setRaiseId(null);
                      }}
                      className="rounded-md border px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      style={{ borderColor: PALETTE.gold, color: PALETTE.navy }}
                    >
                      {openId === w.id ? "Cancel" : "Log completion"}
                    </button>
                  )}
                  {w.status === "Completed" && (
                    <button
                      onClick={() => {
                        setRaiseId(raiseId === w.id ? null : w.id);
                        setOpenId(null);
                      }}
                      className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
                      style={{ borderColor: PALETTE.navy, color: PALETTE.navy }}
                    >
                      {raiseId === w.id ? "Cancel" : "Raise + link CAPA"}
                    </button>
                  )}
                </div>
              </div>

              {canComplete && openId === w.id && (
                <CompletionForm
                  walk={w}
                  onDone={() => setOpenId(null)}
                  onCancel={() => setOpenId(null)}
                />
              )}

              {raiseId === w.id && (
                <RaiseHazardForm walk={w} onDone={() => setRaiseId(null)} onCancel={() => setRaiseId(null)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Signal({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className="font-semibold" style={{ color: PALETTE.navy }}>
        {value}
      </span>{" "}
      {label}
    </span>
  );
}

function CompletionForm({
  walk,
  onDone,
  onCancel,
}: {
  walk: Walk;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [workers, setWorkers] = React.useState("");
  const [hazards, setHazards] = React.useState("");
  const [observations, setObservations] = React.useState("");
  const [area, setArea] = React.useState(walk.areaVisited ?? "");
  const [notes, setNotes] = React.useState("");
  // §Fix 3 structured checklist
  const [hazardCats, setHazardCats] = React.useState<string[]>([]);
  const [interactionTopic, setInteractionTopic] = React.useState("");
  const [ppe, setPpe] = React.useState("");
  const [housekeeping, setHousekeeping] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggleHazard(cat: string) {
    setHazardCats((cs) => (cs.includes(cat) ? cs.filter((c) => c !== cat) : [...cs, cat]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const workerN = Number(workers) || 0;
      const body: Record<string, unknown> = {
        completedDate: new Date().toISOString(),
        workersInteracted: workerN,
        observationsRaised: Number(observations) || 0,
        hazardsIdentified: Number(hazards) || 0,
        checklist: {
          hazardCategories: hazardCats,
          workerInteractions: interactionTopic.trim() ? [{ count: workerN, topic: interactionTopic.trim() }] : [],
          ppeCompliance: ppe === "" ? null : Number(ppe),
          housekeepingRating: housekeeping === "" ? null : Number(housekeeping),
        },
      };
      if (area.trim()) body.areaVisited = area.trim();
      if (notes.trim()) body.notes = notes.trim();
      await cultureSend(`/leadership-walks/${walk.id}/complete`, "PUT", body);
      onDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log completion");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Workers" value={workers} onChange={setWorkers} />
        <NumberField label="Hazards" value={hazards} onChange={setHazards} />
        <NumberField label="Observations" value={observations} onChange={setObservations} />
      </div>

      {/* §Fix 3 structured checklist */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-600">Hazard categories observed</label>
        <div className="flex flex-wrap gap-1.5">
          {HAZARD_CATEGORIES.map((cat) => {
            const on = hazardCats.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleHazard(cat)}
                className="rounded-full border px-2 py-0.5 text-[11px] font-medium transition"
                style={
                  on
                    ? { background: PALETTE.navy, borderColor: PALETTE.navy, color: "white" }
                    : { borderColor: "#CBD5E1", color: "#475569" }
                }
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-600">Worker-interaction topic</label>
        <input
          type="text"
          value={interactionTopic}
          onChange={(e) => setInteractionTopic(e.target.value)}
          placeholder="e.g. Discussed line-3 lockout with 4 operators"
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">PPE compliance (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={ppe}
            onChange={(e) => setPpe(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">Housekeeping (1-5)</label>
          <select
            value={housekeeping}
            onChange={(e) => setHousekeeping(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-600">Area</label>
        <input
          type="text"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-600">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          style={{ background: PALETTE.navy }}
        >
          {busy ? "Saving…" : "Save completion"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-slate-600">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
      />
    </div>
  );
}

// ── Raise a walk hazard into the BBS closure loop (§Fix 3) ─────────────────────

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
// Must match the live DB ObservationCategory enum labels exactly.
const OBS_CATEGORIES = [
  "PPE",
  "HOUSEKEEPING",
  "WORK_AT_HEIGHT",
  "HOT_WORK",
  "ELECTRICAL",
  "MOBILE_EQUIPMENT",
  "MATERIAL_HANDLING",
  "CONFINED_SPACE",
  "CHEMICAL_HANDLING",
  "OTHERS",
] as const;

function RaiseHazardForm({ walk, onDone, onCancel }: { walk: Walk; onDone: () => void; onCancel: () => void }) {
  const router = useRouter();
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<string>("OTHERS");
  const [severity, setSeverity] = React.useState<string>("MEDIUM");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim()) {
      setError("Describe the hazard.");
      return;
    }
    setBusy(true);
    try {
      const res = await cultureSend<{ number: string; linkedCapaId: string | null }>(
        `/leadership-walks/${walk.id}/raise-observation`,
        "POST",
        { description: description.trim(), category, severity, spawnCapa: true }
      );
      setOk(
        res.linkedCapaId
          ? `Raised ${res.number} and linked a CAPA — now in the BBS closure loop.`
          : `Raised ${res.number} into the BBS closure loop.`
      );
      setDescription("");
      router.refresh();
      setTimeout(onDone, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to raise hazard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Raise a hazard from this walk</p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Describe the hazard observed during the walk…"
        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
          >
            {OBS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {ok && <p className="text-xs text-emerald-700">{ok}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          style={{ background: PALETTE.navy }}
        >
          {busy ? "Raising…" : "Raise + link CAPA"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Leader scorecard ─────────────────────────────────────────────────────────

function LeaderScorecardCard({
  leaderIds,
  leaderLabel,
}: {
  leaderIds: string[];
  leaderLabel: (id: string) => string;
}) {
  const [leaderId, setLeaderId] = React.useState("");
  const [card, setCard] = React.useState<LeaderScorecard | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSelect(id: string) {
    setLeaderId(id);
    setCard(null);
    setError(null);
    if (!id) return;
    setBusy(true);
    try {
      const data = await cultureGet<LeaderScorecard>(`/leadership-walks/scorecard/${id}`);
      setCard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scorecard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="mb-1 text-sm font-semibold" style={{ color: PALETTE.navy }}>
        Leader Scorecard
      </p>
      <p className="mb-4 text-xs text-slate-500">Per-leader transparency on walk discipline and impact.</p>

      <select
        value={leaderId}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none"
      >
        <option value="">Select a leader…</option>
        {leaderIds.map((id) => (
          <option key={id} value={id}>
            {leaderLabel(id)}
          </option>
        ))}
      </select>

      {busy && <p className="mt-4 text-sm text-slate-500">Loading scorecard…</p>}
      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

      {!busy && !error && !card && leaderId === "" && (
        <p className="mt-4 text-sm text-slate-500">Pick a leader to see their scorecard.</p>
      )}

      {card && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ScoreStat
              label="Compliance to schedule"
              value={`${Math.round(card.complianceToSchedule)}%`}
              color={scoreColor(card.complianceToSchedule)}
            />
            <ScoreStat
              label="Rolling engagement"
              value={`${Math.round(card.rollingEngagementScore)}`}
              color={scoreColor(card.rollingEngagementScore)}
            />
          </div>

          {card.complianceTrend && card.complianceTrend.length >= 2 && (
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Compliance trend (6 mo)</p>
                <span className="text-[11px] text-slate-400">
                  {card.complianceTrend[0].period} → {card.complianceTrend[card.complianceTrend.length - 1].period}
                </span>
              </div>
              <Sparkline values={card.complianceTrend.map((t) => t.complianceToSchedule)} width={220} height={44} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <MiniStat label="Scheduled" value={card.scheduledWalks} />
            <MiniStat label="Completed" value={card.completedWalks} />
            <MiniStat label="Hazards" value={card.hazardsIdentified} />
            <MiniStat label="Workers" value={card.workersInteracted} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <MiniStat label="Observations" value={card.observationsRaised} />
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Recent walks</p>
            {card.recentWalks.length === 0 ? (
              <p className="text-sm text-slate-500">No recent walks.</p>
            ) : (
              <div className="space-y-1.5">
                {card.recentWalks.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="text-slate-700">
                        {fmtDate(r.completedDate ?? r.scheduledDate)}
                      </span>
                      {r.areaVisited && (
                        <span className="text-slate-400"> · {r.areaVisited}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">
                        {r.hazardsIdentified}h · {r.workersInteracted}w
                      </span>
                      <StatusChip status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-lg font-bold" style={{ color: PALETTE.navy }}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}
