"use client";

// RCA-03 — "Contributing Root Causes" panel + "Open RCA on this risk" (Path B).
// Self-contained: fetches its own data so it can be dropped onto the existing
// risk-detail page with a single line. Degrades gracefully when no RCAs link.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, GitBranch } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { usePermission } from "@/components/auth/can";
import { parseApiError } from "@/lib/api-error";
import { fmtDate, METHOD_LABEL, type ContributingCause } from "@/app/(dashboard)/erm/rca/lib";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select-field";

export function RcaRiskPanel({ riskId, riskCode, riskTitle }: { riskId: string; riskCode: string; riskTitle: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const canCreate = usePermission("RCA.CREATE");
  const [causes, setCauses] = useState<ContributingCause[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/erm/rca/analytics/risk/${riskId}/contributing-causes`)
      .then((r) => (r.ok ? r.json() : { causes: [] }))
      .then((d) => active && setCauses(d.causes ?? []))
      .catch(() => active && setCauses([]));
    return () => { active = false; };
  }, [riskId]);

  return (
    <Card className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-none">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">Contributing Root Causes</h3>
        </div>
        {canCreate && (
          <Button variant="outline" onClick={() => setOpen(true)} className="gap-1.5 rounded-lg px-2.5 py-1.5 text-xs">
            <Plus size={14} /> Open RCA on this risk
          </Button>
        )}
      </div>

      {causes === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : causes.length === 0 ? (
        <p className="text-sm text-slate-500">No approved RCAs feed this risk yet. Open one to start building its causal picture.</p>
      ) : (
        <div className="space-y-2">
          {causes.map((c) => (
            <Card key={c.subCauseId} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 shadow-none">
              <div>
                <span className="text-sm font-medium text-slate-700">{c.subCauseName}</span>
                <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{c.categoryCode}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="tabular-nums">{c.count}× · last {fmtDate(c.latestOccurrence)}</span>
                <span className="flex gap-1">
                  {c.rcaCodes.slice(0, 4).map((code) => <span key={code} className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">{code}</span>)}
                </span>
              </div>
            </Card>
          ))}
          <p className="pt-1 text-[11px] text-slate-400">Computed from approved RCA records · <Link href="/erm/rca/analytics" className="underline">enterprise analytics</Link></p>
        </div>
      )}

      {open && <OpenRcaModal riskId={riskId} riskCode={riskCode} riskTitle={riskTitle} onClose={() => setOpen(false)} onDone={(id: string) => router.push(`/erm/rca/${id}`)} toast={toast} />}
    </Card>
  );
}

function OpenRcaModal({ riskId, riskCode, riskTitle, onClose, onDone, toast }: any) {
  const [title, setTitle] = useState(`RCA — ${riskCode} ${riskTitle}`.slice(0, 140));
  const [methodology, setMethodology] = useState("FIVE_WHY");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/erm/rca/risk-rcas`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceRiskId: riskId, title, methodology }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const rca = await res.json();
      toast({ title: "RCA opened on this risk", variant: "success" });
      onDone(rca.id);
    } catch (e: any) {
      toast({ title: "Failed to open RCA", description: e?.message, variant: "error" });
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-[480px] max-w-full rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Open RCA on this risk</h2>
          <Button variant="ghost" onClick={onClose}>✕</Button>
        </div>
        <div className="space-y-3 p-4">
          <div><Label className="text-xs font-semibold text-slate-600">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" /></div>
          <div><Label className="text-xs font-semibold text-slate-600">Methodology</Label>
            <SelectField value={methodology} onChange={setMethodology} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              options={Object.entries(METHOD_LABEL).map(([v, l]) => ({ value: v, label: String(l) }))}
            />
          </div>
          <p className="text-xs text-slate-400">No incident required — this opens a risk-derived RCA you tag against the cross-domain cause taxonomy.</p>
          <Button onClick={submit} disabled={busy || !title} className="w-full rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Opening…" : "Open RCA"}</Button>
        </div>
      </div>
    </div>
  );
}
