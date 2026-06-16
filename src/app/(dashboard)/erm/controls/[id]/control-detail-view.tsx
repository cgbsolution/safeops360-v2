"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, ClipboardCheck, Link2, Plus, Trash2, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import {
  RATING_CHIP,
  STRENGTH_CHIP,
  DEF_SEVERITY_CHIP,
  DEF_STATUS_CHIP,
  CONTROL_TYPE_LABEL,
  CONTROL_CATEGORY_LABEL,
  NATURE_LABEL,
  TEST_METHODS,
  type ControlDetail,
  type Mapping,
} from "@/app/(dashboard)/erm/lib-t3";

const STRENGTHS = ["PRIMARY", "SECONDARY", "COMPENSATING"] as const;
const TEST_TYPES = ["DESIGN", "OPERATING"] as const;
const CONCLUSIONS = ["EFFECTIVE", "DEFICIENT", "SIGNIFICANT_DEFICIENCY", "MATERIAL_WEAKNESS"] as const;
const CONCLUSION_GUIDANCE: Record<string, string> = {
  EFFECTIVE: "Control operated as designed; no exceptions of concern.",
  DEFICIENT: "Minor design or operating gap. Auto-creates a deficiency.",
  SIGNIFICANT_DEFICIENCY: "Warrants attention by those responsible for oversight. Requires a CAPA before leaving OPEN.",
  MATERIAL_WEAKNESS: "Reasonable possibility a material misstatement will not be prevented/detected. Requires CAPA + Audit Committee report.",
};
const NEXT_STATUS: Record<string, string[]> = {
  OPEN: ["REMEDIATION_ACTIVE"],
  REMEDIATION_ACTIVE: ["RETESTING"],
  RETESTING: ["CLOSED"],
  CLOSED: [],
};
const STATUS_ACTION_LABEL: Record<string, string> = {
  REMEDIATION_ACTIVE: "Start remediation",
  RETESTING: "Move to retesting",
  CLOSED: "Close",
};

function tidy(token: string) {
  return token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function freqLabel(f: string) {
  return f.charAt(0) + f.slice(1).toLowerCase().replace(/_/g, " ");
}

function RatingBadge({ label, rating }: { label: string; rating: string | null }) {
  const r = rating ?? "NOT_ASSESSED";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className={"rounded border px-2 py-0.5 text-[11px] " + (RATING_CHIP[r] ?? RATING_CHIP.NOT_ASSESSED)}>
        {r === "NOT_ASSESSED" ? "Not assessed" : tidy(r)}
      </span>
    </span>
  );
}

export function ControlDetailView({ detail }: { detail: ControlDetail }) {
  const router = useRouter();
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  async function call(url: string, method: string, body?: unknown, okMsg?: string) {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "err", msg: j.detail || j.error || `Request failed (${res.status}).` });
        setBusy(false);
        return null;
      }
      if (okMsg) setBanner({ kind: "ok", msg: okMsg });
      setBusy(false);
      router.refresh();
      return j;
    } catch (e: any) {
      setBanner({ kind: "err", msg: e?.message ?? "Network error." });
      setBusy(false);
      return null;
    }
  }

  const testPlanLabel = (id: string | null) => {
    if (!id) return "Ad-hoc";
    const p = detail.testPlans.find((tp) => tp.id === id);
    return p ? p.testCycleLabel : id;
  };

  return (
    <div className="space-y-5">
      {banner && (
        <div className={"rounded-lg border px-4 py-2.5 text-sm " + (banner.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")}>
          {banner.msg}
        </div>
      )}

      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{CONTROL_TYPE_LABEL[detail.controlType] ?? detail.controlType}</span>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">{NATURE_LABEL[detail.nature] ?? detail.nature}</span>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">{freqLabel(detail.frequency)}</span>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">{CONTROL_CATEGORY_LABEL[detail.category] ?? detail.category}</span>
            {detail.isKeyControl && <span className="rounded border border-primary-200 bg-primary-100 px-2 py-0.5 text-[11px] font-semibold text-primary-800">KEY CONTROL</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RatingBadge label="Design" rating={detail.currentDesignRating} />
            <RatingBadge label="Operating" rating={detail.currentOperatingRating} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Owner <span className="font-medium text-slate-700">{detail.controlOwnerName ?? "—"}</span></span>
          {detail.processName && <span>Process <span className="font-medium text-slate-700">{detail.processName}</span></span>}
          {detail.siteName && <span>Site <span className="font-medium text-slate-700">{detail.siteName}</span></span>}
          <span>Last test {fmtDate(detail.lastTestDate)}</span>
          <span>
            Next test{" "}
            {detail.testOverdue ? (
              <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-medium text-rose-700">{fmtDate(detail.nextTestDueDate)} · overdue</span>
            ) : (
              <span className="font-medium text-slate-700">{fmtDate(detail.nextTestDueDate)}</span>
            )}
          </span>
        </div>
      </div>

      {/* Overview */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Overview</h2>
        {detail.description && <p className="text-sm text-slate-600">{detail.description}</p>}
        {detail.controlDesignNotes && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Design notes</p>
            <p className="mt-1 text-sm text-slate-600">{detail.controlDesignNotes}</p>
          </div>
        )}
        {detail.assertions.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assertions</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {detail.assertions.map((a) => (
                <span key={a} className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">{a.replace(/_/g, " ")}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mappings */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Mapped risks / processes / obligations <span className="text-slate-400">({detail.mappings.length})</span>
          </h2>
          <button onClick={() => setMapOpen(true)} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Link2 size={13} /> Add mapping
          </button>
        </div>
        {detail.mappings.length === 0 ? (
          <p className="py-3 text-center text-sm text-slate-400">This control mitigates nothing yet — map it to a risk, process or obligation.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {detail.mappings.map((mp) => (
              <li key={mp.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{tidy(mp.targetType)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">
                    {mp.targetCode && <span className="font-mono text-xs font-semibold text-primary-700">{mp.targetCode}</span>}
                    {mp.targetLabel && <span className="ml-2">{mp.targetLabel}</span>}
                    <span className={"ml-2 rounded border px-2 py-0.5 text-[11px] " + (STRENGTH_CHIP[mp.mitigationStrength] ?? "")}>{tidy(mp.mitigationStrength)}</span>
                  </p>
                  {mp.coverageNotes && <p className="mt-0.5 text-xs text-slate-500">{mp.coverageNotes}</p>}
                </div>
                <button onClick={() => call(`/api/erm/controls/mappings/${mp.id}`, "DELETE", undefined, "Mapping removed.")}
                  disabled={busy} className="shrink-0 text-slate-300 hover:text-rose-600" aria-label="Delete mapping">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Test history */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Test history</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setPlanOpen(true)} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <CalendarPlus size={13} /> Schedule test plan
            </button>
            <button onClick={() => setTestOpen(true)} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800 disabled:opacity-50">
              <ClipboardCheck size={13} /> Record test
            </button>
          </div>
        </div>

        {/* Test plans */}
        {detail.testPlans.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Planned cycles</p>
            <ul className="space-y-1.5">
              {detail.testPlans.map((tp) => (
                <li key={tp.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-800">{tp.testCycleLabel}</span>
                  <span>{tidy(tp.testMethod)}</span>
                  <span>n={tp.sampleSizePlanned}</span>
                  <span>{tp.testFrequencyPerYear}×/yr</span>
                  <span>Tester {tp.assignedTesterName ?? "—"}</span>
                  <span className="ml-auto">Scheduled {fmtDate(tp.scheduledDate)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tests table */}
        {detail.tests.length === 0 ? (
          <p className="py-3 text-center text-sm text-slate-400">No tests recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Cycle</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2 text-right">Sample</th>
                  <th className="px-3 py-2 text-right">Exceptions</th>
                  <th className="px-3 py-2">Conclusion</th>
                  <th className="px-3 py-2">Tester</th>
                  <th className="px-3 py-2">Workpaper</th>
                </tr>
              </thead>
              <tbody>
                {detail.tests.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 text-xs text-slate-600">{fmtDate(t.testDate)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{testPlanLabel(t.testPlanId)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{tidy(t.testType)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{tidy(t.method)}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-600">{t.sampleSize}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">
                      {t.exceptionsFound > 0 ? <span className="font-semibold text-rose-700">{t.exceptionsFound}</span> : <span className="text-slate-500">0</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={"rounded border px-2 py-0.5 text-[11px] " + (RATING_CHIP[t.conclusion === "EFFECTIVE" ? "EFFECTIVE" : "DEFICIENT"])}>{tidy(t.conclusion)}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{t.testerName ?? "—"}</td>
                    <td className="max-w-[240px] px-3 py-2 text-xs text-slate-500">{t.workpaperNotes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deficiencies */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Deficiencies <span className="text-slate-400">({detail.deficiencies.length})</span>
        </h2>
        {detail.deficiencies.length === 0 ? (
          <p className="py-3 text-center text-sm text-slate-400">No deficiencies — control is operating effectively.</p>
        ) : (
          <ul className="space-y-3">
            {detail.deficiencies.map((def) => {
              const advances = NEXT_STATUS[def.status] ?? [];
              return (
                <li key={def.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-800">{def.deficiencyCode}</span>
                        <span className={"rounded border px-2 py-0.5 text-[11px] " + (DEF_SEVERITY_CHIP[def.severity] ?? "")}>{tidy(def.severity)}</span>
                        <span className={"rounded border px-2 py-0.5 text-[11px] " + (DEF_STATUS_CHIP[def.status] ?? "")}>{tidy(def.status)}</span>
                        <span className="text-[11px] text-slate-400">{def.ageDays}d old</span>
                      </div>
                      {def.description && <p className="mt-1 text-sm text-slate-600">{def.description}</p>}
                      {def.rootCause && <p className="mt-0.5 text-xs text-slate-500"><span className="font-medium text-slate-600">Root cause:</span> {def.rootCause}</p>}
                      {def.identifiedRiskImpact && <p className="mt-0.5 text-xs text-slate-500"><span className="font-medium text-slate-600">Risk impact:</span> {def.identifiedRiskImpact}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        {def.remediationCapaId ? (
                          <Link href={`/capa/${def.remediationCapaId}`} className="inline-flex items-center gap-1.5 text-primary-700 hover:underline">
                            View remediation CAPA
                            {def.remediationCapaState && <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">{tidy(def.remediationCapaState)}</span>}
                          </Link>
                        ) : (
                          <span className="text-slate-400">No CAPA raised</span>
                        )}
                        {def.reportedToAuditCommittee && (
                          <span className="text-emerald-600" title={def.auditCommitteeReference ?? "Reported"}>✓ Reported to AC</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {!def.remediationCapaId && (
                        <button onClick={() => call(`/api/erm/controls/deficiencies/${def.id}/raise-capa`, "POST", undefined, "CAPA raised.")} disabled={busy}
                          className="rounded-md border border-primary-300 bg-white px-2 py-1 text-[11px] font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50">
                          Raise CAPA
                        </button>
                      )}
                      {advances.map((s) => (
                        <button key={s} onClick={() => call(`/api/erm/controls/deficiencies/${def.id}?status=${s}`, "PATCH", undefined, `Status → ${tidy(s)}.`)} disabled={busy}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          {STATUS_ACTION_LABEL[s] ?? s}
                        </button>
                      ))}
                      {!def.reportedToAuditCommittee && (
                        <ReportButton onReport={(ref) => call(`/api/erm/controls/deficiencies/${def.id}/report`, "POST", { auditCommitteeReference: ref }, "Reported to Audit Committee.")} busy={busy} />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {mapOpen && <AddMappingModal controlId={detail.id} existing={detail.mappings} onClose={() => setMapOpen(false)} onSaved={() => { setMapOpen(false); router.refresh(); }} />}
      {planOpen && <SchedulePlanModal controlId={detail.id} ownerId={detail.controlOwnerId} onClose={() => setPlanOpen(false)} onSaved={() => { setPlanOpen(false); router.refresh(); }} />}
      {testOpen && <RecordTestModal controlId={detail.id} testPlans={detail.testPlans} onClose={() => setTestOpen(false)} onSaved={() => { setTestOpen(false); router.refresh(); }} />}
    </div>
  );
}

// ── Report button (inline reference prompt) ───────────────────────────────────
function ReportButton({ onReport, busy }: { onReport: (ref: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState("");
  return (
    <>
      <button onClick={() => setOpen(true)} disabled={busy}
        className="rounded-md border border-rose-300 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
        Report to AC
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Report to Audit Committee</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Audit Committee reference</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. AC-2026-Q2-07"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            <p className="mt-2 text-[11px] text-slate-400">CRO-only — a 403 here means you lack the CRO role.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => { onReport(ref.trim()); setOpen(false); }} disabled={busy || ref.trim().length < 1}
                className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50">Report</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Add mapping modal ─────────────────────────────────────────────────────────
type TargetOption = { id: string; code: string; label: string };

function AddMappingModal({ controlId, existing, onClose, onSaved }: { controlId: string; existing: Mapping[]; onClose: () => void; onSaved: () => void }) {
  const [targetType, setTargetType] = useState<"risk" | "process" | "obligation">("risk");
  const [targetId, setTargetId] = useState("");
  const [mitigationStrength, setMitigationStrength] = useState<string>("PRIMARY");
  const [coverageNotes, setCoverageNotes] = useState("");
  const [options, setOptions] = useState<TargetOption[]>([]);
  const [optErr, setOptErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch selectable risks/processes for the picker (obligations: text id).
  useEffect(() => {
    setOptions([]);
    setOptErr(null);
    setTargetId("");
    if (targetType === "obligation") return;
    let cancelled = false;
    const url = targetType === "risk" ? "/api/erm/risks" : "/api/erm/bcm/processes";
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        const items: any[] = data?.items ?? data ?? [];
        const mapped: TargetOption[] = items.map((it) =>
          targetType === "risk"
            ? { id: it.id, code: it.riskCode ?? "", label: it.title ?? "" }
            : { id: it.id, code: it.processCode ?? "", label: it.name ?? "" },
        );
        setOptions(mapped);
      })
      .catch((e: Error) => {
        if (!cancelled) setOptErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [targetType]);

  async function submit() {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { mitigationStrength, coverageNotes: coverageNotes.trim() };
    if (targetType === "risk") body.riskId = targetId.trim();
    else if (targetType === "process") body.processId = targetId.trim();
    else body.obligationId = targetId.trim();
    try {
      const res = await fetch(`/api/erm/controls/${controlId}/mappings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.detail || j.error || `Failed (${res.status}).`); setBusy(false); return; }
      onSaved();
    } catch (e: any) { setError(e?.message ?? "Network error."); setBusy(false); }
  }

  const dupPrimary = mitigationStrength === "PRIMARY" && existing.some((m) => m.mitigationStrength === "PRIMARY");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Add mapping</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Target type</label>
              <select value={targetType} onChange={(e) => setTargetType(e.target.value as any)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                <option value="risk">Risk</option>
                <option value="process">Process</option>
                <option value="obligation">Obligation</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Strength</label>
              <select value={mitigationStrength} onChange={(e) => setMitigationStrength(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                {STRENGTHS.map((s) => <option key={s} value={s}>{tidy(s)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{targetType === "risk" ? "Risk" : targetType === "process" ? "Process" : "Obligation ID"}</label>
            {targetType === "obligation" ? (
              <input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="Paste obligation id"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            ) : optErr ? (
              <input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder={`Could not load list — paste ${targetType} id`}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            ) : (
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                <option value="">{options.length ? `Select a ${targetType}…` : "Loading…"}</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} · ` : ""}{o.label}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Coverage notes</label>
            <textarea value={coverageNotes} onChange={(e) => setCoverageNotes(e.target.value)} rows={2} placeholder="How this control mitigates the target."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>

          {dupPrimary && <p className="text-[11px] text-amber-600">A primary mapping already exists — the backend may reject a second primary.</p>}
          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={busy || targetId.trim().length < 1}
            className="inline-flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50">
            <Plus size={14} /> {busy ? "Adding…" : "Add mapping"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Schedule test plan modal (segregation enforced server-side) ───────────────
function SchedulePlanModal({ controlId, ownerId, onClose, onSaved }: { controlId: string; ownerId: string; onClose: () => void; onSaved: () => void }) {
  const [testCycleLabel, setTestCycleLabel] = useState("");
  const [testMethod, setTestMethod] = useState<string>("INSPECTION");
  const [sampleSizePlanned, setSampleSizePlanned] = useState("25");
  const [testFrequencyPerYear, setTestFrequencyPerYear] = useState("1");
  const [assignedTesterId, setAssignedTesterId] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownerIsTester = assignedTesterId != null && assignedTesterId === ownerId;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/erm/controls/${controlId}/test-plans`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          testCycleLabel: testCycleLabel.trim(),
          testMethod,
          sampleSizePlanned: Number(sampleSizePlanned),
          testFrequencyPerYear: Number(testFrequencyPerYear),
          assignedTesterId,
          scheduledDate,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.detail || j.error || `Failed (${res.status}).`); setBusy(false); return; }
      onSaved();
    } catch (e: any) { setError(e?.message ?? "Network error."); setBusy(false); }
  }

  const valid = testCycleLabel.trim() && assignedTesterId && scheduledDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Schedule test plan</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Test cycle label</label>
            <input value={testCycleLabel} onChange={(e) => setTestCycleLabel(e.target.value)} placeholder="e.g. FY26 Q2 interim"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Method</label>
              <select value={testMethod} onChange={(e) => setTestMethod(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                {TEST_METHODS.map((m) => <option key={m} value={m}>{tidy(m)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Sample size</label>
              <input type="number" min={1} value={sampleSizePlanned} onChange={(e) => setSampleSizePlanned(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Times / year</label>
              <input type="number" min={1} value={testFrequencyPerYear} onChange={(e) => setTestFrequencyPerYear(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Assigned tester</label>
              <UserPicker value={assignedTesterId} onChange={(id) => setAssignedTesterId(id)} placeholder="Select tester" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Scheduled date</label>
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>
          {ownerIsTester && <p className="text-[11px] font-medium text-amber-600">Segregation of duties — the tester cannot be the control owner. The backend will reject this.</p>}
          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={busy || !valid}
            className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50">
            {busy ? "Scheduling…" : "Schedule plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Record test modal (T3-05 folded in) ───────────────────────────────────────
function RecordTestModal({ controlId, testPlans, onClose, onSaved }: { controlId: string; testPlans: ControlDetail["testPlans"]; onClose: () => void; onSaved: () => void }) {
  const [testPlanId, setTestPlanId] = useState<string>("");
  const [testType, setTestType] = useState<string>("OPERATING");
  const [testDate, setTestDate] = useState("");
  const [method, setMethod] = useState<string>("INSPECTION");
  const [sampleSize, setSampleSize] = useState("25");
  const [exceptionsFound, setExceptionsFound] = useState("0");
  const [conclusion, setConclusion] = useState<string>("EFFECTIVE");
  const [workpaperNotes, setWorkpaperNotes] = useState("");
  const [evidenceIds, setEvidenceIds] = useState("");
  const [deficiencyDescription, setDeficiencyDescription] = useState("");
  const [deficiencyRootCause, setDeficiencyRootCause] = useState("");
  const [identifiedRiskImpact, setIdentifiedRiskImpact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDeficient = conclusion !== "EFFECTIVE";

  async function submit() {
    setBusy(true);
    setError(null);
    const evidenceAttachmentIds = evidenceIds.split(",").map((s) => s.trim()).filter(Boolean);
    const body: Record<string, unknown> = {
      testPlanId: testPlanId || null,
      testType,
      testDate,
      method,
      sampleSize: Number(sampleSize),
      exceptionsFound: Number(exceptionsFound),
      conclusion,
      workpaperNotes: workpaperNotes.trim(),
      evidenceAttachmentIds,
    };
    if (isDeficient) {
      body.deficiencyDescription = deficiencyDescription.trim() || null;
      body.deficiencyRootCause = deficiencyRootCause.trim() || null;
      body.identifiedRiskImpact = identifiedRiskImpact.trim() || null;
    }
    try {
      const res = await fetch(`/api/erm/controls/${controlId}/tests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.detail || j.error || `Failed (${res.status}).`); setBusy(false); return; }
      onSaved();
    } catch (e: any) { setError(e?.message ?? "Network error."); setBusy(false); }
  }

  const valid = testDate && workpaperNotes.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Record test</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            You are recorded as the tester. Segregation of duties — you cannot record a test for a control you own; the backend will reject it.
          </p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Test plan</label>
              <select value={testPlanId} onChange={(e) => setTestPlanId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                <option value="">Ad-hoc</option>
                {testPlans.map((tp) => <option key={tp.id} value={tp.id}>{tp.testCycleLabel}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Test type</label>
              <select value={testType} onChange={(e) => setTestType(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                {TEST_TYPES.map((t) => <option key={t} value={t}>{tidy(t)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                {TEST_METHODS.map((m) => <option key={m} value={m}>{tidy(m)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Test date</label>
              <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Sample size</label>
              <input type="number" min={0} value={sampleSize} onChange={(e) => setSampleSize(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Exceptions found</label>
              <input type="number" min={0} value={exceptionsFound} onChange={(e) => setExceptionsFound(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Conclusion</label>
            <select value={conclusion} onChange={(e) => setConclusion(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
              {CONCLUSIONS.map((c) => <option key={c} value={c}>{tidy(c)}</option>)}
            </select>
            <p className={"mt-1 text-[11px] " + (isDeficient ? "text-amber-600" : "text-slate-400")}>{CONCLUSION_GUIDANCE[conclusion]}</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Workpaper notes <span className="text-rose-500">*</span></label>
            <textarea value={workpaperNotes} onChange={(e) => setWorkpaperNotes(e.target.value)} rows={3} placeholder="Procedures performed, population, samples tested, results."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Evidence attachment IDs (comma-separated, optional)</label>
            <input value={evidenceIds} onChange={(e) => setEvidenceIds(e.target.value)} placeholder="att-1, att-2"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>

          {isDeficient && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Deficiency detail (a non-effective conclusion auto-creates a deficiency)</p>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Deficiency description</label>
                <textarea value={deficiencyDescription} onChange={(e) => setDeficiencyDescription(e.target.value)} rows={2}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Root cause</label>
                  <textarea value={deficiencyRootCause} onChange={(e) => setDeficiencyRootCause(e.target.value)} rows={2}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Identified risk impact</label>
                  <textarea value={identifiedRiskImpact} onChange={(e) => setIdentifiedRiskImpact(e.target.value)} rows={2}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
              </div>
            </div>
          )}

          {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={busy || !valid}
            className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50">
            {busy ? "Recording…" : "Record test"}
          </button>
        </div>
      </div>
    </div>
  );
}
