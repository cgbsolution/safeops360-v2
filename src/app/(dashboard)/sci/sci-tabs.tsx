"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Sparkles, TrendingUp, Award, Building2 } from "lucide-react";
import type { MyScore, Leaderboard } from "./page";

const MODULE_COLOR: Record<string, string> = {
  SAFETY_OBS: "bg-emerald-500",
  NEAR_MISS: "bg-amber-500",
  FLRA: "bg-sky-500",
  PTW: "bg-indigo-500",
  INCIDENT: "bg-rose-500",
  TRAINING: "bg-violet-500",
  INSPECTION: "bg-teal-500",
  CAPA: "bg-orange-500",
  HIRA: "bg-blue-500"
};

const MEDAL = ["🥇", "🥈", "🥉"];

export function SciTabs({ myScore, leaderboard }: { myScore: MyScore; leaderboard: Leaderboard }) {
  const [tab, setTab] = useState<"me" | "board">("me");

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
        <TabBtn active={tab === "me"} onClick={() => setTab("me")} icon={<Sparkles size={14} />}>My Score</TabBtn>
        <TabBtn active={tab === "board"} onClick={() => setTab("board")} icon={<Trophy size={14} />}>Leaderboard</TabBtn>
      </div>

      {tab === "me" ? <MyScoreView s={myScore} /> : <LeaderboardView b={leaderboard} />}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition",
        active ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-100"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function MyScoreView({ s }: { s: MyScore }) {
  const maxPts = Math.max(1, ...s.breakdown.map((b) => b.points));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-1">
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 p-6 text-white shadow-md">
          <div className="text-xs uppercase tracking-widest text-white/70">Your Safety Culture score</div>
          <div className="mt-1 text-5xl font-extrabold tabular-nums">{s.totalPoints.toLocaleString()}</div>
          <div className="mt-1 text-sm text-white/80">points · {s.recent.length > 0 ? `${s.breakdown.reduce((a, b) => a + b.count, 0)} verified actions` : "no activity yet"}</div>
          <div className="mt-4 flex items-center gap-3">
            <div className="rounded-lg bg-white/15 px-3 py-2 ring-1 ring-white/20">
              <div className="text-[10px] uppercase tracking-wider text-white/70">Rank</div>
              <div className="text-lg font-bold">{s.rank ? `#${s.rank}` : "—"}<span className="text-xs font-normal text-white/70"> / {s.totalContributors}</span></div>
            </div>
            <div className="rounded-lg bg-white/15 px-3 py-2 ring-1 ring-white/20">
              <div className="text-[10px] uppercase tracking-wider text-white/70">Sources</div>
              <div className="text-lg font-bold">{s.breakdown.length}</div>
            </div>
          </div>
        </div>

        {s.insights.length > 0 && (
          <div className="mt-4 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/40 p-4">
            <div className="text-sm font-semibold text-violet-900 mb-2 flex items-center gap-1.5"><Sparkles size={14} className="text-violet-600" /> Insights for you</div>
            <ul className="space-y-1.5">
              {s.insights.map((ins, i) => (
                <li key={i} className="text-xs text-violet-900 flex gap-1.5"><span className="text-violet-400">•</span>{ins}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><TrendingUp size={14} className="text-violet-600" /> Points by source</div>
          {s.breakdown.length === 0 ? (
            <div className="text-xs text-slate-400">No verified actions scored yet.</div>
          ) : (
            <div className="space-y-2.5">
              {s.breakdown.map((b) => (
                <div key={b.module}>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">{b.label} <span className="text-slate-400">×{b.count}</span></span>
                    <span className="font-semibold text-slate-800">{b.points}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={cn("h-full rounded-full", MODULE_COLOR[b.module] ?? "bg-slate-400")} style={{ width: `${(b.points / maxPts) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-4 py-3 border-b text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Award size={14} className="text-violet-600" /> Recent verified contributions</div>
          {s.recent.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No contributions yet. Earn points by closing observations, reporting near misses, signing FLRAs, and more.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">Event</th>
                  <th className="text-left px-4 py-2">Source</th>
                  <th className="text-left px-4 py-2">Period</th>
                  <th className="text-right px-4 py-2">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.recent.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-700">{r.eventType}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                        <span className={cn("h-2 w-2 rounded-full", MODULE_COLOR[r.module] ?? "bg-slate-400")} />
                        {r.moduleLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{r.scoringPeriod}</td>
                    <td className="px-4 py-2 text-right">
                      <span className="font-semibold text-slate-900">+{r.finalPoints}</span>
                      {r.multiplier !== 1 && <span className="ml-1 text-[10px] text-violet-600">({r.basePoints}×{r.multiplier})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderboardView({ b }: { b: Leaderboard }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center gap-4 text-sm text-slate-600">
          <span><span className="font-semibold text-slate-900">{b.totalContributors}</span> contributors</span>
          <span className="text-slate-300">·</span>
          <span><span className="font-semibold text-slate-900">{b.totalPoints.toLocaleString()}</span> total points</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 w-16">Rank</th>
                <th className="text-left px-4 py-2">Worker</th>
                <th className="text-left px-4 py-2">Department</th>
                <th className="text-right px-4 py-2">Actions</th>
                <th className="text-right px-4 py-2">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {b.individuals.map((p) => (
                <tr key={p.userId} className={cn(p.isMe ? "bg-violet-50" : "hover:bg-slate-50")}>
                  <td className="px-4 py-2 font-semibold text-slate-700">
                    {p.rank <= 3 ? <span className="text-lg">{MEDAL[p.rank - 1]}</span> : `#${p.rank}`}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-medium text-slate-900">{p.name}</span>
                    {p.isMe && <span className="ml-2 rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-medium text-white">You</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{p.department ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{p.contributions}</td>
                  <td className="px-4 py-2 text-right font-bold text-slate-900 tabular-nums">{p.points.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5"><Building2 size={14} className="text-violet-600" /> Department ranking</div>
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {b.departments.length === 0 ? (
            <div className="p-4 text-xs text-slate-400">No data yet.</div>
          ) : (
            b.departments.map((d) => (
              <div key={d.department} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{d.rank}</span>
                  <div>
                    <div className="text-sm font-medium text-slate-800">{d.department}</div>
                    <div className="text-[10px] text-slate-400">{d.people} people</div>
                  </div>
                </div>
                <div className="text-sm font-bold text-slate-900 tabular-nums">{d.points.toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
