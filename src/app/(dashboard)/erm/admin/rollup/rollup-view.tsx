"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Eye, Plus, Pencil, X, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { BandBadge } from "@/components/erm/shared";
import { fmtDate, type RollupRule } from "@/app/(dashboard)/erm/lib";

const SOURCE_MODULES = ["HIRA", "EAI", "QUALITY_NCR"] as const;
const MIN_BANDS = ["", "HIGH", "CRITICAL"] as const;
const AGG_MODES = ["GROUPED", "ONE_TO_ONE"] as const;
const SCORING_MODES = ["MAX", "WEIGHTED_AVERAGE"] as const;

type RuleForm = {
  name: string;
  sourceModules: string[];
  minRiskBand: string;
  siteIds: string;
  aggregationMode: string;
  scoringMode: string;
  targetSubCategoryCode: string;
  isActive: boolean;
};

type PreviewEntry = {
  id: string;
  sourceModule: string;
  plantId: string;
  activityDescription: string;
  residualBand: string | null;
  residualScore: number | null;
};

function ruleToForm(r?: RollupRule): RuleForm {
  return {
    name: r?.name ?? "",
    sourceModules: r?.filterCriteria?.sourceModules ?? [],
    minRiskBand: r?.filterCriteria?.minRiskBand ?? "",
    siteIds: (r?.filterCriteria?.siteIds ?? []).join(", "),
    aggregationMode: r?.aggregationMode ?? "GROUPED",
    scoringMode: r?.scoringMode ?? "MAX",
    targetSubCategoryCode: r?.targetSubCategoryCode ?? "",
    isActive: r?.isActive ?? true,
  };
}

function formToBody(f: RuleForm) {
  const filterCriteria: { siteIds?: string[]; minRiskBand?: string; sourceModules?: string[] } = {};
  const siteIds = f.siteIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (siteIds.length) filterCriteria.siteIds = siteIds;
  if (f.minRiskBand) filterCriteria.minRiskBand = f.minRiskBand;
  if (f.sourceModules.length) filterCriteria.sourceModules = f.sourceModules;
  return {
    name: f.name,
    filterCriteria,
    aggregationMode: f.aggregationMode,
    scoringMode: f.scoringMode,
    targetSubCategoryCode: f.targetSubCategoryCode,
    isActive: f.isActive,
  };
}

export function RollupAdminView({ rules }: { rules: RollupRule[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<null | { tone: "ok" | "err"; text: string }>(null);
  const [editor, setEditor] = useState<null | { rule?: RollupRule }>(null);
  const [preview, setPreview] = useState<null | { matched: number; entries: PreviewEntry[]; ruleName: string }>(null);

  async function runNow(rule: RollupRule) {
    setBusyId(rule.id);
    setBanner(null);
    try {
      const res = await fetch(`/api/erm/rollup-rules/${rule.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ tone: "err", text: j.detail || j.error || `Run failed (${res.status})` });
        return;
      }
      setBanner({
        tone: "ok",
        text: `"${rule.name}" run complete — ${j.matched} matched · ${j.created} created · ${j.updated} updated · ${j.unlinked} unlinked.`,
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {banner && (
        <div
          className={
            "flex items-start gap-2 rounded-xl border p-3 text-sm " +
            (banner.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800")
          }
        >
          {banner.tone === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          <span className="flex-1">{banner.text}</span>
          <button onClick={() => setBanner(null)} className="text-current opacity-60 hover:opacity-100">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {rules.length} rule{rules.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={() => setEditor({})}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800"
        >
          <Plus size={16} /> New Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
          No rollup rules yet. Create one to auto-aggregate operational entries into enterprise risks.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rules.map((rule) => {
            const fc = rule.filterCriteria ?? {};
            const s = rule.lastRunSummary;
            return (
              <div key={rule.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{rule.name}</h3>
                      {!rule.isActive && (
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      → {rule.targetCategoryCode ? `${rule.targetCategoryCode} / ` : ""}
                      <span className="font-mono font-medium text-slate-700">{rule.targetSubCategoryCode}</span>
                    </p>
                  </div>
                  <span className="rounded bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700 ring-1 ring-cyan-200">
                    {rule.linkedEntryCount} linked
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(fc.sourceModules ?? []).length ? (
                    fc.sourceModules!.map((m) => (
                      <span key={m} className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {m}
                      </span>
                    ))
                  ) : (
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-400">all modules</span>
                  )}
                  {fc.minRiskBand && (
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      ≥ {fc.minRiskBand}
                    </span>
                  )}
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                    {rule.aggregationMode === "GROUPED" ? "Grouped" : "One-to-one"}
                  </span>
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                    Score: {rule.scoringMode === "MAX" ? "Max" : "Weighted avg"}
                  </span>
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                    {(fc.siteIds ?? []).length ? `${fc.siteIds!.length} site(s)` : "all sites"}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                  <Clock size={12} />
                  {rule.lastRunAt ? (
                    <span>
                      Last run {fmtDate(rule.lastRunAt)}
                      {s && (
                        <span className="ml-1 text-slate-400">
                          · {s.matched ?? 0} matched · {s.created ?? 0} created · {s.updated ?? 0} updated · {s.unlinked ?? 0} unlinked
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400">Never run</span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => runNow(rule)}
                    disabled={busyId === rule.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800 disabled:opacity-50"
                  >
                    <Play size={13} /> {busyId === rule.id ? "Running…" : "Run Now"}
                  </button>
                  <button
                    onClick={() => setEditor({ rule })}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-primary-500"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editor && (
        <RuleEditor
          rule={editor.rule}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            router.refresh();
          }}
          onPreview={(p) => setPreview(p)}
        />
      )}

      {preview && <PreviewPanel preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function PreviewPanel({
  preview,
  onClose,
}: {
  preview: { matched: number; entries: PreviewEntry[]; ruleName: string };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Preview — {preview.ruleName || "unsaved rule"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          {preview.matched} operational entr{preview.matched === 1 ? "y" : "ies"} match this rule. Nothing is created
          until you run it.
        </p>
        {preview.entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No matching entries.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-1.5">Module</th>
                <th className="px-2 py-1.5">Activity</th>
                <th className="px-2 py-1.5">Site</th>
                <th className="px-2 py-1.5">Residual</th>
              </tr>
            </thead>
            <tbody>
              {preview.entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="px-2 py-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium">{e.sourceModule}</span>
                  </td>
                  <td className="max-w-[360px] px-2 py-1.5 text-slate-700">{e.activityDescription}</td>
                  <td className="px-2 py-1.5 text-xs text-slate-500">{e.plantId}</td>
                  <td className="px-2 py-1.5">
                    <BandBadge band={e.residualBand} score={e.residualScore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleEditor({
  rule,
  onClose,
  onSaved,
  onPreview,
}: {
  rule?: RollupRule;
  onClose: () => void;
  onSaved: () => void;
  onPreview: (p: { matched: number; entries: PreviewEntry[]; ruleName: string }) => void;
}) {
  const [f, setF] = useState<RuleForm>(() => ruleToForm(rule));
  const [busy, setBusy] = useState(false);
  const valid = f.name.trim() && f.targetSubCategoryCode.trim();

  function toggleModule(m: string) {
    setF((p) => ({
      ...p,
      sourceModules: p.sourceModules.includes(m) ? p.sourceModules.filter((x) => x !== m) : [...p.sourceModules, m],
    }));
  }

  async function doPreview() {
    setBusy(true);
    try {
      const res = await fetch(`/api/erm/rollup-rules/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formToBody(f)),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j.detail || j.error || `Preview failed (${res.status})`);
        return;
      }
      onPreview({ matched: j.matched ?? 0, entries: j.entries ?? [], ruleName: f.name });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(rule ? `/api/erm/rollup-rules/${rule.id}` : `/api/erm/rollup-rules`, {
        method: rule ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formToBody(f)),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.detail || j.error || `Save failed (${res.status})`);
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{rule ? `Edit ${rule.name}` : "New rollup rule"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Rule name (required)</label>
            <input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="HSE high-risk activities → enterprise HSE risk"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Source modules</label>
            <div className="flex flex-wrap gap-2">
              {SOURCE_MODULES.map((m) => (
                <label
                  key={m}
                  className={
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium " +
                    (f.sourceModules.includes(m) ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600")
                  }
                >
                  <input
                    type="checkbox"
                    checked={f.sourceModules.includes(m)}
                    onChange={() => toggleModule(m)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-primary-700 focus:ring-primary-500"
                  />
                  {m}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Leave all unchecked to match every module.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Minimum residual band</label>
              <select
                value={f.minRiskBand}
                onChange={(e) => setF({ ...f, minRiskBand: e.target.value })}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              >
                {MIN_BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b === "" ? "Any (no minimum)" : b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Target sub-category code (required)</label>
              <input
                value={f.targetSubCategoryCode}
                onChange={(e) => setF({ ...f, targetSubCategoryCode: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm font-mono"
                placeholder="OPS-HSE"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Aggregation mode</label>
              <div className="grid grid-cols-2 gap-1.5">
                {AGG_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setF({ ...f, aggregationMode: m })}
                    className={
                      "rounded-lg border px-2 py-2 text-xs font-medium " +
                      (f.aggregationMode === m ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600")
                    }
                  >
                    {m === "GROUPED" ? "Grouped" : "One-to-one"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Scoring mode</label>
              <div className="grid grid-cols-2 gap-1.5">
                {SCORING_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setF({ ...f, scoringMode: m })}
                    className={
                      "rounded-lg border px-2 py-2 text-xs font-medium " +
                      (f.scoringMode === m ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600")
                    }
                  >
                    {m === "MAX" ? "Max" : "Weighted avg"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Site IDs (optional, comma-separated)</label>
            <input
              value={f.siteIds}
              onChange={(e) => setF({ ...f, siteIds: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="leave empty = all sites"
            />
          </div>

          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={f.isActive}
              onChange={(e) => setF({ ...f, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-primary-700 focus:ring-primary-500"
            />
            Active
          </label>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              onClick={doPreview}
              disabled={busy || !f.targetSubCategoryCode.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-primary-500 disabled:opacity-50"
            >
              <Eye size={15} /> Preview matches
            </button>
            <button
              onClick={save}
              disabled={busy || !valid}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
            >
              {busy ? "Saving…" : rule ? "Save changes" : "Create rule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
