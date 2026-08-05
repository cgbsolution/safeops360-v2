"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { EvidenceAttachment } from "@/components/evidence/EvidenceAttachment";
import { SEVERITY_CHIP, FINDING_STATUS_CHIP, fmtDate, labelize, type Finding } from "../../lib-cams";

const RCA_METHODS = ["5_WHY", "FISHBONE", "FAULT_TREE", "BOWTIE", "TAP_ROOT", "CAUSE_MAP", "EIGHT_D", "NONE_REQUIRED"];
const STATUSES = ["OPEN", "CAPA_RAISED", "IN_REMEDIATION", "VERIFICATION", "CLOSED", "ACCEPTED_RISK"];

// Shared evidence-attachment categories for an audit finding (mirror the
// backend evidence_registry `cams_finding` entry).
const FINDING_EVIDENCE_CATEGORIES = [
  { value: "FINDING_EVIDENCE", label: "Finding evidence" },
  { value: "CLOSURE_EVIDENCE", label: "Closure evidence" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "LICENSE", label: "License" },
  { value: "REPORT", label: "Report" },
  { value: "OTHER", label: "Other" },
];

export function FindingDetailView({ finding, canManage }: { finding: Finding; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rcaMethod, setRcaMethod] = useState(finding.rootCauseMethod ?? "");
  const [rcaSummary, setRcaSummary] = useState(finding.rootCauseSummary ?? "");
  const [verificationNote, setVerificationNote] = useState(finding.verificationNote ?? "");

  async function patch(body: Record<string, unknown>, tag: string) {
    setBusy(tag); setErr(null);
    const res = await fetch(`/api/cams/findings/${finding.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.detail || j.error || `Failed (${res.status})`); return; }
    router.refresh();
  }
  async function raiseCapa() {
    setBusy("capa"); setErr(null);
    const res = await fetch(`/api/cams/findings/${finding.id}/raise-capa`, { method: "POST" });
    setBusy(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.detail || j.error || `Failed (${res.status})`); return; }
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={"rounded border px-2 py-0.5 text-xs " + (SEVERITY_CHIP[finding.severity] ?? "")}>{labelize(finding.severity)}</span>
            <span className={"rounded border px-2 py-0.5 text-xs " + (FINDING_STATUS_CHIP[finding.status] ?? "")}>{labelize(finding.status)}</span>
            {finding.standardClauseRef && <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{finding.standardClauseRef}</span>}
            {finding.isRepeatFinding && <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Repeat finding</span>}
          </div>
          <p className="mt-3 text-sm font-medium text-slate-800">{finding.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{finding.description || "—"}</p>
          {finding.capaRequired && !finding.capaId && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">This is a {labelize(finding.severity)} finding — a CAPA must be raised before it (and the engagement) can be closed.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Root cause</h3>
          {err && <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
          <div className="space-y-2">
            <Select disabled={!canManage} value={rcaMethod} onChange={(e) => setRcaMethod(e.target.value)}>
              <option value="">— RCA method —</option>
              {RCA_METHODS.map((m) => <option key={m} value={m}>{labelize(m)}</option>)}
            </Select>
            <Textarea disabled={!canManage} value={rcaSummary} onChange={(e) => setRcaSummary(e.target.value)} rows={3} placeholder="Root cause summary" />
            {canManage && (
              <Button disabled={busy === "rca"} onClick={() => patch({ rootCauseMethod: rcaMethod || null, rootCauseSummary: rcaSummary }, "rca")} variant="outline">
                {busy === "rca" ? "Saving…" : "Save RCA"}
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Verification & closure</h3>
          <Textarea disabled={!canManage} value={verificationNote} onChange={(e) => setVerificationNote(e.target.value)} rows={2} className="mb-2" placeholder="Verification evidence / note" />
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy === "verify"} onClick={() => patch({ status: "VERIFICATION", verificationNote }, "verify")} variant="outline" className="border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100">Move to verification</Button>
              <Button disabled={busy === "close"} onClick={() => patch({ status: "CLOSED", verificationNote }, "close")} variant="success">Close finding</Button>
              <Button disabled={busy === "accept"} onClick={() => patch({ status: "ACCEPTED_RISK" }, "accept")} variant="outline" className="text-slate-600">Accept as risk</Button>
            </div>
          )}
        </div>

        <EvidenceAttachment
          entityType="cams_finding"
          entityId={finding.id}
          categories={FINDING_EVIDENCE_CATEGORIES}
          canManage={canManage}
          title="Evidence & documents"
          help="Attach the source document that substantiates this finding or its closure — license, certificate, report, photo."
        />
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">CAPA (AUDIT source)</h3>
          {finding.capaNumber ? (
            <Link href="/capa" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100">
              {finding.capaNumber} · {labelize(finding.capaState ?? "")}
            </Link>
          ) : canManage ? (
            <Button disabled={busy === "capa"} onClick={raiseCapa} className="inline-flex items-center gap-1.5">
              {busy === "capa" ? <Loader2 size={14} className="animate-spin" /> : <ShieldPlus size={14} />} Raise CAPA
            </Button>
          ) : <p className="text-slate-500">No CAPA raised.</p>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Details</h3>
          <dl className="space-y-1.5">
            <Row label="Engagement" value={<Link href={`/cams/engagements/${finding.engagementId}`} className="text-primary-700 hover:underline">{finding.engagementCode}</Link>} />
            <Row label="Owner" value={finding.ownerName ?? "—"} />
            <Row label="Site" value={finding.siteName ?? "—"} />
            <Row label="Area / asset" value={finding.areaOrAssetRef ?? "—"} />
            <Row label="Due" value={fmtDate(finding.dueDate)} />
            <Row label="Age" value={`${finding.ageDays} days`} />
            <Row label="Raised" value={fmtDate(finding.createdAt)} />
          </dl>
        </div>

        {canManage && finding.status !== "CLOSED" && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Status</h3>
            <Select value={finding.status} onChange={(e) => patch({ status: e.target.value }, "status")}>
              {STATUSES.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-right text-slate-700">{value}</dd>
    </div>
  );
}
