"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PALETTE, scoreColor, cultureGet, cultureSend, type PlantOption } from "../lib";
import { EmptyState } from "../ui";
import { formatUserRefText, type UserDirectory } from "@/lib/users/user-ref";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ── Types (mirror the /recognition backend contract) ─────────────────────────
export type IndividualEntry = {
  userId: string;
  points: number;
  badges: string[];
  streakWeeks: number;
  rank: number;
  // §Fix 1 integrity gate — set when this observer's points are frozen pending /
  // upheld integrity review. `frozenPoints` is the would-be total (restored on
  // dismissal); `points` is the effective (0) total used for ranking.
  integrityStatus?: string;
  frozenPoints?: number;
  pointsFrozen?: boolean;
};

export type MostImprovedEntry = {
  userId: string;
  delta: number;
  points: number;
};

export type Leaderboard = {
  plantId: string;
  period: string;
  individual: IndividualEntry[];
  mostImproved: MostImprovedEntry[];
};

export type StreakDetail = {
  userId: string;
  currentStreakWeeks: number;
  totalPoints: number;
  badges: string[];
  history: { period: string; category: string; points: number; badge: string | null }[];
};

// Medal accent for the top three ranks; everyone else is neutral.
function rankAccent(rank: number): { color: string; bg: string; label: string } {
  if (rank === 1) return { color: PALETTE.gold, bg: "#FBF4E4", label: "🥇" };
  if (rank === 2) return { color: "#8A94A6", bg: "#F1F3F7", label: "🥈" };
  if (rank === 3) return { color: "#B87333", bg: "#F7EEE6", label: "🥉" };
  return { color: PALETTE.navy, bg: "#F1F5F9", label: `#${rank}` };
}

function Badges({ badges }: { badges: string[] }) {
  const list = Array.isArray(badges) ? badges.filter(Boolean) : [];
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((b, i) => (
        <span
          key={`${b}-${i}`}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: "#FBF4E4", color: PALETTE.gold, border: `1px solid ${PALETTE.gold}` }}
        >
          {b}
        </span>
      ))}
    </div>
  );
}

function Streak({ weeks }: { weeks: number }) {
  if (!weeks || weeks < 2) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-orange-600" title={`${weeks}-week streak`}>
      🔥 {weeks}w
    </span>
  );
}

// §Fix 1 — a top-ranked person under integrity review is shown with this badge and
// frozen points rather than being silently dropped from the board.
function IntegrityBadge({ entry }: { entry: IndividualEntry }) {
  if (!entry.pointsFrozen) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: "#FBEAEA", color: "#B4232A", border: "1px solid #E7B4B7" }}
      title="This observer's quality points are frozen while a BBS integrity flag is under review. They will be restored automatically if the flag is dismissed."
    >
      ⚠ Under integrity review
    </span>
  );
}

/** Points display that struck-through-freezes gated observers (§Fix 1). */
function Points({ entry, size = "sm" }: { entry: IndividualEntry; size?: "sm" | "lg" }) {
  const big = size === "lg";
  if (entry.pointsFrozen) {
    return (
      <span className={big ? "text-2xl font-bold" : "text-sm font-bold"} style={{ color: "#B4232A" }}>
        0
        <span className="ml-1 text-[10px] font-medium text-slate-400 line-through">
          {(entry.frozenPoints ?? 0).toLocaleString()}
        </span>
        <span className={`ml-1 font-medium text-slate-400 ${big ? "text-xs" : "text-[10px]"}`}>frozen</span>
      </span>
    );
  }
  return (
    <span className={big ? "text-2xl font-bold" : "text-sm font-bold"} style={{ color: PALETTE.navy }}>
      {entry.points.toLocaleString()}
      <span className={`ml-1 font-medium text-slate-400 ${big ? "text-xs" : "text-[10px]"}`}>pts</span>
    </span>
  );
}

function FormulaCard() {
  return (
    <Card
      className="rounded-xl border p-4 text-sm shadow-none"
      style={{ borderColor: PALETTE.gold, background: "#FBF7EC" }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg" style={{ color: PALETTE.gold }}>
          ◆
        </span>
        <p className="font-semibold" style={{ color: PALETTE.navy }}>
          How points are earned
        </p>
      </div>
      <ul className="space-y-1.5 text-[13px] text-slate-700">
        <li>
          <span className="font-semibold">Quality contribution</span> — your per-observer-capped, severity-weighted BBS
          points, multiplied by closure-loop completion (linked ×1.0, verified ×1.5). Raw submission counts earn nothing.
        </li>
        <li>
          <span className="font-semibold">Observation streak</span> — 5 pts per consecutive week with a quality-verified
          observation (🔥 On Fire at 6+ weeks).
        </li>
        <li>
          <span className="font-semibold">Leadership-walk compliance</span> — for leaders at ≥80% walk compliance:
          compliance ÷ 2 + hazards found × 2.
        </li>
      </ul>
      <p className="mt-2 text-[11px] text-slate-500">
        Points from any observation under an unresolved BBS integrity flag are frozen until a reviewer clears it — so
        Recognition can never contradict the BBS Quality integrity status.
      </p>
    </Card>
  );
}

export function RecognitionView({
  plantId,
  plants,
  period,
  board,
  userDir,
}: {
  plantId: string;
  plants: PlantOption[];
  period: string;
  board: Leaderboard;
  userDir: UserDirectory;
}) {
  const router = useRouter();

  const individual = React.useMemo(
    () => (Array.isArray(board?.individual) ? [...board.individual].sort((a, b) => a.rank - b.rank) : []),
    [board]
  );
  const mostImproved = Array.isArray(board?.mostImproved) ? board.mostImproved : [];

  const siteName = plants.find((p) => p.id === plantId)?.name ?? plantId;

  // Award trigger (may 403 for non-privileged users).
  const [awarding, setAwarding] = React.useState(false);
  const [awardMsg, setAwardMsg] = React.useState<string | null>(null);
  const [awardErr, setAwardErr] = React.useState<string | null>(null);

  async function runAward() {
    setAwarding(true);
    setAwardMsg(null);
    setAwardErr(null);
    try {
      await cultureSend(`/recognition/award`, "POST", { plantId, period });
      setAwardMsg("Awards recalculated for this period.");
      router.refresh();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Failed to trigger awards";
      const forbidden = /403|permission|forbidden|not allowed|privileg/i.test(raw);
      setAwardErr(forbidden ? "You don't have permission to trigger awards." : raw);
    } finally {
      setAwarding(false);
    }
  }

  // Streak drill-down (fetched on demand).
  const [openUserId, setOpenUserId] = React.useState<string | null>(null);
  const [streak, setStreak] = React.useState<StreakDetail | null>(null);
  const [streakLoading, setStreakLoading] = React.useState(false);
  const [streakErr, setStreakErr] = React.useState<string | null>(null);

  async function openStreak(userId: string) {
    if (openUserId === userId) {
      setOpenUserId(null);
      setStreak(null);
      setStreakErr(null);
      return;
    }
    setOpenUserId(userId);
    setStreak(null);
    setStreakErr(null);
    setStreakLoading(true);
    try {
      const data = await cultureGet<StreakDetail>(`/recognition/streaks/${userId}`);
      setStreak(data);
    } catch (e) {
      setStreakErr(e instanceof Error ? e.message : "Failed to load streak history");
    } finally {
      setStreakLoading(false);
    }
  }

  const podium = individual.slice(0, 3);
  const rest = individual.slice(3);

  return (
    <div className="space-y-5">
      {/* Framing note + refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-3xl text-sm text-slate-600">
          <span className="font-semibold" style={{ color: PALETTE.navy }}>Quality-weighted recognition.</span>{" "}
          Points reward BBS observation quality, verified closure-loop completions and leadership-walk compliance —
          never raw submission counts. Only top performers and most-improved are surfaced; there is deliberately{" "}
          <span className="font-medium">no bottom-of-leaderboard call-out</span>.
        </p>
        <div className="shrink-0 text-right">
          <Button
            type="button"
            onClick={runAward}
            disabled={awarding}
            className="text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: PALETTE.navy }}
          >
            {awarding ? "Refreshing…" : "Refresh awards"}
          </Button>
          <p className="mt-1 text-[11px] text-slate-400">
            {siteName} · {period}
          </p>
        </div>
      </div>
      {awardMsg && <p className="text-xs font-medium text-emerald-600">{awardMsg}</p>}
      {awardErr && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{awardErr}</p>
      )}

      <FormulaCard />

      {individual.length === 0 ? (
        <EmptyState
          title="No recognition awarded yet this period"
          hint="Run a recalculation on the Culture Maturity page, or use “Refresh awards” above to compute this period's leaderboard."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.5fr,1fr]">
          {/* Leaderboard column */}
          <div className="space-y-5">
            {/* Podium */}
            {podium.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                {podium.map((e) => {
                  const acc = rankAccent(e.rank);
                  const open = openUserId === e.userId;
                  return (
                    <button
                      key={e.userId}
                      onClick={() => openStreak(e.userId)}
                      className={`rounded-xl border bg-white p-5 text-left transition hover:shadow-md ${
                        open ? "ring-2" : ""
                      }`}
                      style={{ borderColor: acc.color, boxShadow: open ? `0 0 0 2px ${acc.color}` : undefined }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-2xl leading-none">{acc.label}</span>
                        <Streak weeks={e.streakWeeks} />
                      </div>
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {formatUserRefText(userDir, e.userId)}
                      </p>
                      <p className="mt-1">
                        <Points entry={e} size="lg" />
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <IntegrityBadge entry={e} />
                        <Badges badges={e.badges} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Ranked remainder */}
            {rest.length > 0 && (
              <Card className="rounded-xl border bg-white p-5 shadow-none">
                <p className="mb-3 text-sm font-semibold" style={{ color: PALETTE.navy }}>
                  Leaderboard
                </p>
                <div className="space-y-1.5">
                  {rest.map((e) => {
                    const acc = rankAccent(e.rank);
                    const open = openUserId === e.userId;
                    return (
                      <Button
                        key={e.userId}
                        type="button"
                        variant="ghost"
                        onClick={() => openStreak(e.userId)}
                        className={`justify-start h-auto flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                          open ? "border-primary-400 bg-primary-50/40" : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{ background: acc.bg, color: acc.color }}
                        >
                          {e.rank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {formatUserRefText(userDir, e.userId)}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <IntegrityBadge entry={e} />
                            <Badges badges={e.badges} />
                          </div>
                        </div>
                        <Streak weeks={e.streakWeeks} />
                        <span className="shrink-0 text-right">
                          <Points entry={e} />
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* Side column: most improved + streak detail */}
          <div className="space-y-5">
            {/* Most improved */}
            <Card className="rounded-xl border bg-white p-5 shadow-none" style={{ borderColor: PALETTE.gold }}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg" style={{ color: PALETTE.gold }}>▲</span>
                <p className="text-sm font-semibold" style={{ color: PALETTE.navy }}>
                  Most Improved
                </p>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                Celebrating upward movement — this is where smaller and newer sites shine.
              </p>
              {mostImproved.length === 0 ? (
                <p className="text-xs text-slate-400">No movement recorded this period yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {mostImproved.map((e) => {
                    const open = openUserId === e.userId;
                    return (
                      <Button
                        key={e.userId}
                        type="button"
                        variant="ghost"
                        onClick={() => openStreak(e.userId)}
                        className={`h-auto flex w-full items-center justify-between gap-3 rounded-lg border p-2.5 text-left transition ${
                          open ? "border-primary-400 bg-primary-50/40" : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                          {formatUserRefText(userDir, e.userId)}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold" style={{ color: PALETTE.gold }}>
                          ▲ +{e.delta.toLocaleString()}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Streak detail */}
            <StreakPanel
              open={Boolean(openUserId)}
              name={openUserId ? formatUserRefText(userDir, openUserId) : ""}
              loading={streakLoading}
              error={streakErr}
              streak={streak}
              onClose={() => {
                setOpenUserId(null);
                setStreak(null);
                setStreakErr(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StreakPanel({
  open,
  name,
  loading,
  error,
  streak,
  onClose,
}: {
  open: boolean;
  name: string;
  loading: boolean;
  error: string | null;
  streak: StreakDetail | null;
  onClose: () => void;
}) {
  if (!open) {
    return (
      <Card className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500 shadow-none">
        Select a person to see their streak, points and recognition history.
      </Card>
    );
  }

  const history = Array.isArray(streak?.history) ? streak!.history : [];

  return (
    <Card className="rounded-xl border bg-white p-5 shadow-none">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-slate-800">{name || "—"}</p>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-auto w-auto shrink-0 p-1 text-xs text-slate-400 hover:text-slate-600">
          ✕
        </Button>
      </div>

      {loading && <p className="text-xs text-slate-500">Loading streak…</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}

      {!loading && !error && streak && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-lg font-bold text-orange-600">🔥 {streak.currentStreakWeeks ?? 0}w</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Current streak</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-lg font-bold" style={{ color: PALETTE.navy }}>
                {(streak.totalPoints ?? 0).toLocaleString()}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Total points</p>
            </div>
          </div>

          {Array.isArray(streak.badges) && streak.badges.filter(Boolean).length > 0 && (
            <div className="mb-4">
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">Badges</p>
              <Badges badges={streak.badges} />
            </div>
          )}

          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">History</p>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400">No recognition history yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {history.map((h, i) => (
                <li
                  key={`${h.period}-${i}`}
                  className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 text-xs last:border-0"
                >
                  <span className="min-w-0 truncate text-slate-600">
                    <span className="font-medium text-slate-800">{h.period}</span>
                    {h.category ? <span className="text-slate-400"> · {h.category}</span> : null}
                    {h.badge ? (
                      <span className="ml-1 font-semibold" style={{ color: PALETTE.gold }}>
                        ◆ {h.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-semibold" style={{ color: scoreColor(h.points) }}>
                    +{(h.points ?? 0).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
