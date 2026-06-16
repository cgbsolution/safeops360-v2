"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { Deficiency } from "@/app/(dashboard)/erm/lib-t3";

const NEXT_STATUS: Record<string, string[]> = {
  OPEN: ["REMEDIATION_ACTIVE"],
  REMEDIATION_ACTIVE: ["RETESTING"],
  RETESTING: ["CLOSED"],
  CLOSED: [],
};
const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  REMEDIATION_ACTIVE: "Start remediation",
  RETESTING: "Move to retesting",
  CLOSED: "Close",
};

// Inline actions for a single deficiency row: raise-capa, advance status, report (CRO).
export function DeficiencyRowActions({ def, canReport = true }: { def: Deficiency; canReport?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Request failed (${res.status}).`);
        setBusy(false);
        return false;
      }
      setBusy(false);
      router.refresh();
      return true;
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
      setBusy(false);
      return false;
    }
  }

  const advances = NEXT_STATUS[def.status] ?? [];

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {!def.remediationCapaId && (
          <button
            onClick={() => call(`/api/erm/controls/deficiencies/${def.id}/raise-capa`, "POST")}
            disabled={busy}
            className="rounded-md border border-primary-300 bg-white px-2 py-1 text-[11px] font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50"
          >
            Raise CAPA
          </button>
        )}
        {advances.map((s) => (
          <button
            key={s}
            onClick={() => call(`/api/erm/controls/deficiencies/${def.id}?status=${s}`, "PATCH")}
            disabled={busy}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {STATUS_LABEL[s] ?? s}
          </button>
        ))}
        {canReport && !def.reportedToAuditCommittee && (
          <button
            onClick={() => setReportOpen(true)}
            disabled={busy}
            className="rounded-md border border-rose-300 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            Report to AC
          </button>
        )}
      </div>
      {error && <span className="max-w-[260px] text-right text-[10px] text-rose-600">{error}</span>}
      {reportOpen && (
        <ReportModal
          onClose={() => setReportOpen(false)}
          onSubmit={async (ref) => {
            const ok = await call(`/api/erm/controls/deficiencies/${def.id}/report`, "POST", { auditCommitteeReference: ref });
            if (ok) setReportOpen(false);
          }}
          busy={busy}
        />
      )}
    </div>
  );
}

function ReportModal({ onClose, onSubmit, busy }: { onClose: () => void; onSubmit: (ref: string) => void; busy: boolean }) {
  const [ref, setRef] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Report to Audit Committee</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Audit Committee reference</label>
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="e.g. AC-2026-Q2-07"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
        <p className="mt-2 text-[11px] text-slate-400">CRO-only action. The deficiency is marked as reported on submit.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button
            onClick={() => onSubmit(ref.trim())}
            disabled={busy || ref.trim().length < 1}
            className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
          >
            {busy ? "Reporting…" : "Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
