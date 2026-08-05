"use client";

// Bridges an inspection finding into the UNIVERSAL CAPA register (source
// INSPECTION_FINDING) via the FastAPI endpoint — so the finding is tracked with
// SLA, escalation, audit chain and the unified CAPA dashboards, not just the
// lightweight per-finding InspectionFindingCapa. Idempotent server-side.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { readApiError } from "@/lib/client-errors";
import { Loader2, ShieldCheck, ExternalLink } from "lucide-react";

type RegisterCapa = { id: string; capaNumber: string; state: string; severity: string };

export function RegisterCapaPanel({ findingId }: { findingId: string }) {
  const [capas, setCapas] = useState<RegisterCapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/inspection-findings/${findingId}/register-capas`);
      if (res.ok) {
        const data = await res.json();
        setCapas(Array.isArray(data.capas) ? data.capas : []);
      }
    } catch {
      /* non-fatal — the raise button still works */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findingId]);

  async function raise() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/inspection-findings/${findingId}/spawn-capa`, { method: "POST" });
      if (!res.ok) {
        setError(await readApiError(res, "Failed to raise CAPA"));
        return;
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading register status…</p>;
  }

  return (
    <div className="space-y-3">
      {capas.length === 0 ? (
        <>
          <p className="text-sm text-slate-600">
            Track this finding in the enterprise CAPA register (SLA, escalation and audit trail),
            alongside incident and observation CAPAs.
          </p>
          <Button onClick={raise} disabled={busy}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Raising…</> : <><ShieldCheck size={14} /> Raise CAPA in register</>}
          </Button>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Tracked in the enterprise CAPA register:</p>
          {capas.map((c) => (
            <Link
              key={c.id}
              href={`/capa/${c.id}`}
              className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm hover:bg-emerald-100"
            >
              <span className="font-medium text-emerald-900">{c.capaNumber}</span>
              <span className="flex items-center gap-2 text-emerald-700">
                {c.severity} · {c.state} <ExternalLink size={13} />
              </span>
            </Link>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
