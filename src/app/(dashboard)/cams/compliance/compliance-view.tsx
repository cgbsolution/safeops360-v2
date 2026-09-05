"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, X, ShieldCheck } from "lucide-react";
import {
  OBLIGATION_STATUS_CHIP, LINK_TYPE_CHIP, fmtDate, labelize,
  type ComplianceTracker, type ObligationCoverageRow,
} from "../lib-cams";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

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
  // Null pct is NOT 0 — it means "no denominator" (empty register) or "could
  // not read" (WP-52). Rendering it grey rather than red stops an unknown
  // reading as a catastrophic score.
  const gaugeColor =
    pct == null ? "#94A3B8" : pct >= 90 ? "#2E8B57" : pct >= 75 ? "#E6A817" : "#C0392B";
  const num = (v: number | null | undefined) => (v == null ? "—" : v);

  // The register itself could not be read. Say so, loudly, instead of painting
  // a confident 0% over a broken dependency (F-48).
  if (tracker.available === false) {
    return (
      <Alert variant="warning" className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h3 className="text-sm font-semibold text-amber-900">
          The statutory obligations register could not be read
        </h3>
        <p className="mt-1 max-w-prose text-sm text-amber-800">
          {tracker.unavailableReason ??
            "Statutory Registers is unavailable, so obligation coverage cannot be computed."}
        </p>
        <p className="mt-2 max-w-prose text-xs text-amber-700">
          This is <strong>not</strong> the same as having no obligations, and no assurance
          percentage is shown, because any number here would be misleading.
        </p>
      </Alert>
    );
  }

  return (
    <div>
      {/* Assurance KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Obligations</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{num(tracker.totalObligations)}</div>
        </Card>
        <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Verified by Audit</div>
          <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: gaugeColor }}>{num(tracker.verifiedByAuditCount)}<span className="text-base text-slate-400">/{num(tracker.totalObligations)}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${pct ?? 0}%`, background: gaugeColor }} /></div>
        </Card>
        <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assurance</div>
          <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: gaugeColor }}>{pct == null ? "—" : `${pct}%`}</div>
        </Card>
        <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Open Non-Conformances</div>
          <div className={"mt-1 text-2xl font-bold tabular-nums " + (tracker.openNcCount ? "text-rose-700" : "text-emerald-700")}>{num(tracker.openNcCount)}</div>
        </Card>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <ShieldCheck size={16} className="text-emerald-600" />
        <span><strong>{num(tracker.verifiedByAuditCount)} of {num(tracker.totalObligations)}</strong> statutory obligations verified by an audit in the last 12 months; <strong className={tracker.openNcCount ? "text-rose-700" : ""}>{tracker.openNcCount}</strong> with an open non-conformance.</span>
      </div>

      <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow>
              <TableHead>Obligation</TableHead>
              <TableHead>Regulator</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Verified by Audit</TableHead>
              <TableHead>Links</TableHead>
              {canLink && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tracker.rows.length === 0 ? (
              <TableRow><TableCell colSpan={canLink ? 8 : 7} className="px-3 py-10 text-center text-sm text-slate-400">No obligations register present (integrated-mode enrichment).</TableCell></TableRow>
            ) : (
              tracker.rows.map((o) => (
                <TableRow key={o.obligationId} className="border-t border-slate-100 align-top">
                  <TableCell className="max-w-[260px]">
                    <div className="font-medium text-slate-800">{o.obligationCode}</div>
                    <div className="text-xs text-slate-500">{o.title}</div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">{o.regulatorName || "—"}</TableCell>
                  <TableCell className="text-xs text-slate-600">{o.siteName ?? "Corporate"}</TableCell>
                  <TableCell><span className={"rounded border px-2 py-0.5 text-[11px] " + (OBLIGATION_STATUS_CHIP[o.status] ?? "")}>{labelize(o.status)}</span></TableCell>
                  <TableCell className="text-xs tabular-nums text-slate-500">{fmtDate(o.validUntil)}</TableCell>
                  <TableCell>
                    {o.verifiedByAudit ? (
                      <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">
                        <ShieldCheck size={12} /> {o.lastVerifyingEngagementCode ?? "Yes"}
                      </span>
                    ) : (
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">Not verified</span>
                    )}
                    {o.openNcCount > 0 && <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">{o.openNcCount} open NC</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {o.links.length === 0 ? <span className="text-xs text-slate-300">—</span> : o.links.map((l) => (
                        <span key={l.id} className={"rounded border px-1.5 py-0.5 text-[10px] " + (LINK_TYPE_CHIP[l.linkType] ?? "")} title={l.notes}>
                          {l.linkType[0] + l.linkType.slice(1).toLowerCase()}: {l.engagementCode ?? l.findingCode ?? "—"}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  {canLink && (
                    <TableCell>
                      <Button type="button" variant="outline" size="sm" onClick={() => setLinkFor(o)} className="gap-1"><Link2 size={12} /> Link</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

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
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-700"><X size={18} /></Button>
        </div>
        <p className="mb-4 text-xs text-slate-500">{obligation.obligationCode} — {obligation.title}</p>
        {err && <Alert variant="destructive" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</Alert>}
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Link type</Label>
            <div className="flex gap-2">
              {(["VERIFIES", "BREACHES", "EVIDENCES"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant="ghost"
                  onClick={() => { setLinkType(t); setTargetId(""); }}
                  className={cn(
                    "h-auto rounded-full border px-3 py-1 text-xs",
                    linkType === t ? "border-primary-700 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-600"
                  )}
                >
                  {labelize(t)}
                </Button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{useEngagement ? "An audit engagement that verifies this obligation." : "A finding that breaches / evidences non-compliance."}</p>
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">{useEngagement ? "Engagement" : "Finding"}</Label>
            <SelectField value={targetId} onChange={setTargetId}
              placeholder="— select —"
              options={options.map((o) => ({ value: o.id, label: `${o.code} · ${o.title}` }))}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="button" disabled={busy || !targetId} onClick={submit} className="w-full">
            {busy ? "Linking…" : "Create link"}
          </Button>
        </div>
      </div>
    </div>
  );
}
