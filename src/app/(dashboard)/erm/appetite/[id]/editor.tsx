"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Lock, CheckCircle2, History } from "lucide-react";
import {
  APPETITE_LEVEL_CHIP,
  GAUGE_CHIP,
  type AppetiteStatement,
  type AppetiteDashRow,
} from "@/app/(dashboard)/erm/lib-p2";
import { fmtDate } from "@/app/(dashboard)/erm/lib";

const APPETITE_LEVELS = ["AVERSE", "MINIMAL", "CAUTIOUS", "OPEN", "SEEKING"] as const;

const BAND_TYPES = [
  "MAX_RESIDUAL_SCORE",
  "MAX_CRITICAL_COUNT",
  "MAX_HIGH_PLUS_COUNT",
  "MAX_RED_KRI_COUNT",
] as const;

const BAND_LABEL: Record<string, string> = {
  MAX_RESIDUAL_SCORE: "Max residual score",
  MAX_CRITICAL_COUNT: "Max critical risks",
  MAX_HIGH_PLUS_COUNT: "Max high+ risks",
  MAX_RED_KRI_COUNT: "Max red KRIs",
};

type BandRow = { bandType: string; thresholdValue: number };

export function AppetiteEditor({
  statement,
  versions,
  dashRow,
}: {
  statement: AppetiteStatement;
  versions: AppetiteStatement[];
  dashRow: AppetiteDashRow | null;
}) {
  const router = useRouter();
  const readOnly = statement.status === "SUPERSEDED";
  const isDraft = statement.status === "DRAFT";
  const isPending = statement.status === "PENDING_APPROVAL";

  const [statementText, setStatementText] = useState(statement.statementText);
  const [appetiteLevel, setAppetiteLevel] = useState(statement.appetiteLevel);
  const [bands, setBands] = useState<BandRow[]>(
    statement.toleranceBands.map((b) => ({ bandType: b.bandType, thresholdValue: b.thresholdValue })),
  );
  const [approvalReference, setApprovalReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Live observed value for a band type, from the dashboard gauges.
  function observedFor(bandType: string): number | null {
    const g = dashRow?.gauges.find((x) => x.bandType === bandType);
    return g ? g.observedValue : null;
  }
  function stateFor(bandType: string): string | null {
    const g = dashRow?.gauges.find((x) => x.bandType === bandType);
    return g ? g.state : null;
  }

  function addBand() {
    const used = new Set(bands.map((b) => b.bandType));
    const next = BAND_TYPES.find((t) => !used.has(t)) ?? BAND_TYPES[0];
    setBands((p) => [...p, { bandType: next, thresholdValue: 0 }]);
  }
  function removeBand(i: number) {
    setBands((p) => p.filter((_, idx) => idx !== i));
  }
  function updateBand(i: number, patch: Partial<BandRow>) {
    setBands((p) => p.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  async function call(path: string, body: any, method: "POST" | "PATCH" = "POST") {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.detail || j.error || `Failed (${res.status})`);
        return null;
      }
      return j;
    } finally {
      setBusy(false);
    }
  }

  function upsertBody() {
    return {
      categoryId: statement.categoryId,
      statementText,
      appetiteLevel,
      toleranceBands: bands.map((b) => ({ bandType: b.bandType, thresholdValue: Number(b.thresholdValue) })),
    };
  }

  async function save() {
    // PATCH on an ACTIVE statement returns a NEW draft version → navigate to it.
    const j = await call(`/api/erm/appetite/statements/${statement.id}`, upsertBody(), "PATCH");
    if (!j) return;
    const newId = j?.id;
    if (newId && newId !== statement.id) {
      router.push(`/erm/appetite/${newId}`);
    } else {
      router.refresh();
    }
  }

  async function submit() {
    const j = await call(`/api/erm/appetite/statements/${statement.id}/submit`, {});
    if (j) router.refresh();
  }

  async function approve() {
    if (!approvalReference.trim()) {
      setErr("Enter an approval reference (e.g. board resolution number).");
      return;
    }
    const j = await call(`/api/erm/appetite/statements/${statement.id}/approve`, {
      approvalReference: approvalReference.trim(),
    });
    if (j) router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Editor */}
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className="h-4 w-4 rounded"
              style={{ backgroundColor: statement.categoryColor ?? "#64748b" }}
            />
            <h2 className="text-base font-semibold text-slate-900">
              {statement.categoryName ?? statement.categoryCode}
            </h2>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              v{statement.version} · {statement.status.replace(/_/g, " ")}
            </span>
            {readOnly && (
              <span className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                <Lock size={11} /> Read-only (superseded)
              </span>
            )}
          </div>

          {err && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {err}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Statement text</label>
              <textarea
                value={statementText}
                onChange={(e) => setStatementText(e.target.value)}
                rows={4}
                disabled={readOnly}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="The board accepts a CAUTIOUS appetite for…"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Appetite level</label>
              <div className="flex flex-wrap gap-1.5">
                {APPETITE_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setAppetiteLevel(lvl)}
                    className={
                      "rounded border px-2.5 py-1 text-[11px] font-semibold transition-all disabled:opacity-50 " +
                      (appetiteLevel === lvl
                        ? (APPETITE_LEVEL_CHIP[lvl] ?? "bg-slate-100 text-slate-700 border-slate-300") +
                          " ring-2 ring-offset-1 ring-slate-900/20"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")
                    }
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">Tolerance bands</label>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={addBand}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-primary-500"
                  >
                    <Plus size={12} /> Add band
                  </button>
                )}
              </div>
              {bands.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
                  No tolerance bands. Add one to define a breach threshold.
                </p>
              ) : (
                <div className="space-y-2">
                  {bands.map((b, i) => {
                    const observed = observedFor(b.bandType);
                    const state = stateFor(b.bandType);
                    return (
                      <div
                        key={i}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5"
                      >
                        <select
                          value={b.bandType}
                          disabled={readOnly}
                          onChange={(e) => updateBand(i, { bandType: e.target.value })}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                        >
                          {BAND_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {BAND_LABEL[t]}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-500">≤</span>
                          <input
                            type="number"
                            value={b.thresholdValue}
                            disabled={readOnly}
                            onChange={(e) => updateBand(i, { thresholdValue: Number(e.target.value) })}
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums disabled:bg-slate-50"
                          />
                        </div>
                        <div className="ml-auto flex items-center gap-2 text-[11px]">
                          <span className="text-slate-400">live observed</span>
                          <span className="font-semibold tabular-nums text-slate-700">
                            {observed != null ? observed : "—"}
                          </span>
                          {state && (
                            <span
                              className={
                                "rounded border px-1.5 py-0.5 text-[10px] font-semibold " +
                                (GAUGE_CHIP[state] ?? "bg-slate-100 text-slate-600 border-slate-200")
                              }
                            >
                              {state}
                            </span>
                          )}
                        </div>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => removeBand(i)}
                            className="text-slate-400 hover:text-rose-600"
                            title="Remove band"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Workflow actions */}
          {!readOnly && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={save}
                disabled={busy}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-primary-500 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>

              {isDraft && (
                <button
                  onClick={submit}
                  disabled={busy}
                  className="rounded-lg bg-primary-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
                >
                  Submit for approval
                </button>
              )}

              {isPending && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={approvalReference}
                    onChange={(e) => setApprovalReference(e.target.value)}
                    placeholder="Approval reference (board resolution…)"
                    className="w-64 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={approve}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
                    title="CRO only — others will receive a 403"
                  >
                    <CheckCircle2 size={15} /> Approve &amp; activate
                  </button>
                </div>
              )}
            </div>
          )}
          {isDraft && (
            <p className="mt-2 text-[11px] text-slate-400">
              Saving a draft persists changes. Submit to send for CRO approval. Editing an active statement
              spawns a new draft version.
            </p>
          )}
          {isPending && (
            <p className="mt-2 text-[11px] text-slate-400">
              Approval is restricted to the CRO. The button is shown to all; the backend enforces the role.
            </p>
          )}
        </div>
      </div>

      {/* Version history */}
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <History size={15} /> Version history
          </h3>
          <ul className="space-y-2">
            {versions.map((v) => (
              <li
                key={v.id}
                className={
                  "rounded-lg border px-3 py-2 text-sm " +
                  (v.id === statement.id
                    ? "border-primary-300 bg-primary-50/40"
                    : "border-slate-100")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">v{v.version}</span>
                  <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {v.status.replace(/_/g, " ")}
                  </span>
                </div>
                {v.approvalReference && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Ref: <b>{v.approvalReference}</b>
                  </div>
                )}
                {v.approvedByName && (
                  <div className="text-[11px] text-slate-500">
                    Approved by {v.approvedByName}
                    {v.approvedAt ? ` · ${fmtDate(v.approvedAt)}` : ""}
                  </div>
                )}
                {v.effectiveFrom && (
                  <div className="text-[11px] text-slate-400">Effective {fmtDate(v.effectiveFrom)}</div>
                )}
                {v.id !== statement.id && (
                  <a
                    href={`/erm/appetite/${v.id}`}
                    className="mt-1 inline-block text-[11px] font-medium text-primary-700 hover:underline"
                  >
                    Open this version ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
