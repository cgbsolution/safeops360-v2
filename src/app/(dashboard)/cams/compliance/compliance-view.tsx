"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, X, ShieldCheck } from "lucide-react";
import {
  OBLIGATION_STATUS_CHIP, LINK_TYPE_CHIP, fmtDate, labelize,
  type ComplianceTracker, type ObligationCoverageRow,
} from "../lib-cams";

type Ref = { id: string; code: string; title: string };

export function ComplianceView({
  tracker, engagements, findings, canLink,
}: {
  tracker: ComplianceTracker;
  engagements: Ref[];
  findings: Ref[];
  canLink: boolean;
}) {
  const [linkFor, setLinkFor] = useState<ObligationCoverageRow | null>(null);
  const pct = tracker.verifiedPct;
  const gaugeColor = pct >= 90 ? "#2E8B57" : pct >= 75 ? "#E6A817" : "#C0392B";

  return (
    <div>
      {/* Assurance KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Obligations</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{tracker.totalObligations}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Verified by Audit</div>
          <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: gaugeColor }}>{tracker.verifiedByAuditCount}<span className="text-base text-slate-400">/{tracker.totalObligations}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: gaugeColor }} /></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assurance</div>
          <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: gaugeColor }}>{pct}%</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Open Non-Conformances</div>
          <div className={"mt-1 text-2xl font-bold tabular-nums " + (tracker.openNcCount ? "text-rose-700" : "text-emerald-700")}>{tracker.openNcCount}</div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <ShieldCheck size={16} className="text-emerald-600" />
        <span><strong>{tracker.verifiedByAuditCount} of {tracker.totalObligations}</strong> statutory obligations verified by an audit in the last 12 months; <strong className={tracker.openNcCount ? "text-rose-700" : ""}>{tracker.openNcCount}</strong> with an open non-conformance.</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95">
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2.5">Obligation</th>
              <th className="px-3 py-2.5">Regulator</th>
              <th className="px-3 py-2.5">Site</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Valid Until</th>
              <th className="px-3 py-2.5">Verified by Audit</th>
              <th className="px-3 py-2.5">Links</th>
              {canLink && <th className="px-3 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {tracker.rows.length === 0 ? (
              <tr><td colSpan={canLink ? 8 : 7} className="px-3 py-10 text-center text-sm text-slate-400">No obligations register present (integrated-mode enrichment).</td></tr>
            ) : (
              tracker.rows.map((o) => (
                <tr key={o.obligationId} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                  <td className="max-w-[260px] px-3 py-2.5">
                    <Link href={`/erm/compliance/${o.obligationId}`} className="group block" title="Open obligation">
                      <div className="font-medium text-slate-800 group-hover:text-primary-700 group-hover:underline">{o.obligationCode}</div>
                      <div className="text-xs text-slate-500">{o.title}</div>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{o.regulatorName || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{o.siteName ?? "Corporate"}</td>
                  <td className="px-3 py-2.5"><span className={"rounded border px-2 py-0.5 text-[11px] " + (OBLIGATION_STATUS_CHIP[o.status] ?? "")}>{labelize(o.status)}</span></td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">{fmtDate(o.validUntil)}</td>
                  <td className="px-3 py-2.5">
                    {o.verifiedByAudit ? (
                      <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">
                        <ShieldCheck size={12} /> {o.lastVerifyingEngagementCode ?? "Yes"}
                      </span>
                    ) : (
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">Not verified</span>
                    )}
                    {o.openNcCount > 0 && <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">{o.openNcCount} open NC</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {o.links.length === 0 ? <span className="text-xs text-slate-300">—</span> : o.links.map((l) => (
                        <span key={l.id} className={"rounded border px-1.5 py-0.5 text-[10px] " + (LINK_TYPE_CHIP[l.linkType] ?? "")} title={l.notes}>
                          {l.linkType[0] + l.linkType.slice(1).toLowerCase()}: {l.engagementCode ?? l.findingCode ?? "—"}
                        </span>
                      ))}
                    </div>
                  </td>
                  {canLink && (
                    <td className="px-3 py-2.5">
                      <button onClick={() => setLinkFor(o)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"><Link2 size={12} /> Link</button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {linkFor && <LinkModal obligation={linkFor} engagements={engagements} findings={findings} onClose={() => setLinkFor(null)} />}
    </div>
  );
}

function LinkModal({ obligation, engagements, findings, onClose }: { obligation: ObligationCoverageRow; engagements: Ref[]; findings: Ref[]; onClose: () => void }) {
  const router = useRouter();
  const [linkType, setLinkType] = useState<"VERIFIES" | "BREACHES" | "EVIDENCES">("VERIFIES");
  const [targetId, setTargetId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const useEngagement = linkType === "VERIFIES";
  const options = useEngagement ? engagements : findings;

  async function submit() {
    if (!targetId) { setErr(useEngagement ? "Select an engagement." : "Select a finding."); return; }
    setBusy(true); setErr(null);
    const body: Record<string, unknown> = { obligationId: obligation.obligationId, linkType, notes };
    if (useEngagement) body.engagementId = targetId; else body.findingId = targetId;
    const res = await fetch("/api/cams/compliance/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.detail || j.error || `Failed (${res.status})`); return; }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Link audit to obligation</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <p className="mb-4 text-xs text-slate-500">{obligation.obligationCode} — {obligation.title}</p>
        {err && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Link type</label>
            <div className="flex gap-2">
              {(["VERIFIES", "BREACHES", "EVIDENCES"] as const).map((t) => (
                <button key={t} onClick={() => { setLinkType(t); setTargetId(""); }}
                  className={"rounded-full border px-3 py-1 text-xs " + (linkType === t ? "border-primary-700 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-600")}>
                  {labelize(t)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{useEngagement ? "An audit engagement that verifies this obligation." : "A finding that breaches / evidences non-compliance."}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{useEngagement ? "Engagement" : "Finding"}</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
              <option value="">— select —</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.title}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
          </div>
          <button disabled={busy || !targetId} onClick={submit} className="w-full rounded-lg bg-primary-700 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50">
            {busy ? "Linking…" : "Create link"}
          </button>
        </div>
      </div>
    </div>
  );
}
