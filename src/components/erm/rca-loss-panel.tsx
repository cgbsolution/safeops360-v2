"use client";

// RCA-04 — "Open RCA on this loss" (Path C) + attached RCAs, for the loss-event
// detail drawer. Loss events are the native home for financial/compliance/cyber
// "it went wrong and cost us money" analyses — not just safety.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Microscope } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { usePermission } from "@/components/auth/can";
import { parseApiError } from "@/lib/api-error";
import { METHOD_LABEL, STATUS_CHIP, type RcaListItem } from "@/app/(dashboard)/erm/rca/lib";

export function RcaLossPanel({ lossEventId, eventCode, title }: { lossEventId: string; eventCode: string; title: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const canCreate = usePermission("RCA.CREATE");
  const [items, setItems] = useState<RcaListItem[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/erm/rca?sourceLossEventId=${lossEventId}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => active && setItems(d.items ?? []))
      .catch(() => active && setItems([]));
    return () => { active = false; };
  }, [lossEventId]);

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Microscope size={15} className="text-slate-500" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">Root-Cause Analysis</h4>
        </div>
        {canCreate && (
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-400">
            <Plus size={12} /> Open RCA on this loss
          </button>
        )}
      </div>
      {items === null ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500">No RCA attached yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((r) => (
            <a key={r.id} href={`/erm/rca/${r.id}`} className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-xs ring-1 ring-slate-200 hover:ring-slate-300">
              <span className="font-medium text-primary-700">{r.rcaCode}</span>
              <span className="flex items-center gap-2 text-slate-500">
                <span>{METHOD_LABEL[r.methodology]}</span>
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${STATUS_CHIP[r.status]}`}>{r.status.replace("_", " ")}</span>
              </span>
            </a>
          ))}
        </div>
      )}
      {open && <OpenLossRcaModal lossEventId={lossEventId} eventCode={eventCode} title={title} onClose={() => setOpen(false)} onDone={(id: string) => router.push(`/erm/rca/${id}`)} toast={toast} />}
    </div>
  );
}

function OpenLossRcaModal({ lossEventId, eventCode, title, onClose, onDone, toast }: any) {
  const [rcaTitle, setRcaTitle] = useState(`RCA — ${eventCode} ${title}`.slice(0, 140));
  const [methodology, setMethodology] = useState("FIVE_WHY");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/erm/rca/loss-rcas`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceLossEventId: lossEventId, title: rcaTitle, methodology }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const rca = await res.json();
      toast({ title: "RCA opened on this loss", variant: "success" });
      onDone(rca.id);
    } catch (e: any) {
      toast({ title: "Failed to open RCA", description: e?.message, variant: "error" });
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-[480px] max-w-full rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Open RCA on this loss</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="space-y-3 p-4">
          <div><label className="text-xs font-semibold text-slate-600">Title</label><input value={rcaTitle} onChange={(e) => setRcaTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" /></div>
          <div><label className="text-xs font-semibold text-slate-600">Methodology</label>
            <select value={methodology} onChange={(e) => setMethodology(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm">
              {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <p className="text-xs text-slate-400">The domain is inferred from the loss event's category — the cause picker scopes to it automatically.</p>
          <button onClick={submit} disabled={busy || !rcaTitle} className="w-full rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Opening…" : "Open RCA"}</button>
        </div>
      </div>
    </div>
  );
}
