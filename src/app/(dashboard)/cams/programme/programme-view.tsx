"use client";

import { useMemo, useState } from "react";
import type { Programme, ProgrammeCell } from "../lib-cams";

const STATUS_CHIP: Record<string, string> = {
  DONE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PLANNED: "bg-sky-100 text-sky-800 border-sky-200",
  GAP: "bg-rose-100 text-rose-700 border-rose-200",
};

function Kpi({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone || "text-slate-900"}`}>{value}</div>
    </div>
  );
}

export function ProgrammeView({ p }: { p: Programme }) {
  const [standard, setStandard] = useState<string>("");

  const cell = useMemo(() => {
    const m = new Map<string, ProgrammeCell>();
    for (const c of p.matrix) m.set(`${c.auditTypeId}|${c.siteId ?? ""}`, c);
    return m;
  }, [p.matrix]);

  const types = standard
    ? p.auditTypes.filter((t) => t.standardRefs.includes(standard))
    : p.auditTypes;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Coverage" value={`${p.coveragePct}%`} tone={p.coveragePct >= 80 ? "text-emerald-700" : p.coveragePct >= 50 ? "text-amber-600" : "text-rose-700"} />
        <Kpi label="Covered cells" value={`${p.coveredCount}/${p.cellCount}`} />
        <Kpi label="Gap flags" value={p.gaps.length} tone={p.gaps.length ? "text-rose-700" : "text-emerald-700"} />
        <Kpi label="Sites in scope" value={p.sites.length} />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">Standard:</span>
        <select
          value={standard}
          onChange={(e) => setStandard(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All standards</option>
          {p.standards.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {/* Coverage matrix: rows = audit types/standards, columns = sites */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Audit type</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Standards</th>
              {p.sites.map((s) => (
                <th key={s.siteId} className="px-4 py-3 text-center font-semibold text-slate-700">{s.siteName ?? s.siteId}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.auditTypeId} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {t.standardRefs.map((s) => (
                      <span key={s} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">{s.replace("_", " ")}</span>
                    ))}
                  </div>
                </td>
                {p.sites.map((s) => {
                  const c = cell.get(`${t.auditTypeId}|${s.siteId ?? ""}`);
                  const status = c?.status ?? "GAP";
                  return (
                    <td key={s.siteId} className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_CHIP[status]}`}>
                        {status === "DONE" ? `Done · ${c?.done}` : status === "PLANNED" ? `Planned · ${c?.planned}` : "Gap"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {p.gaps.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="mb-2 text-sm font-semibold text-rose-800">Un-audited scope — {p.gaps.length} gap{p.gaps.length === 1 ? "" : "s"}</div>
          <ul className="space-y-1 text-sm text-rose-700">
            {p.gaps.map((g, i) => (
              <li key={i}>• <span className="font-medium">{g.auditTypeName}</span> at {g.siteName ?? g.siteId} — no audit done or planned</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
