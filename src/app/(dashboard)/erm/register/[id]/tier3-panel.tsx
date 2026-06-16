"use client";

// E-04 — Controls + Risk Transfer + linked-vendor context on the risk detail.
// Self-contained: fetches /api/erm/risks/{id}/tier3-context client-side and
// degrades to nothing if the viewer lacks Tier-3 access or no data exists.
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ShieldCheck, Umbrella, Handshake } from "lucide-react";
import {
  RATING_CHIP,
  STRENGTH_CHIP,
  GAP_TYPE_CHIP,
  RISK_BAND_CHIP,
  ESG_BAND_CHIP,
} from "@/app/(dashboard)/erm/lib-t3";

type Ctx = {
  controls: { controlCode: string; name: string; mitigationStrength: string; operatingRating: string | null }[];
  hasPrimaryControl: boolean;
  primaryControlDeficient: boolean;
  policies: { policyCode: string; policyName: string; status: string }[];
  coverageVerdict: string;
  vendors: { vendorCode: string; legalName: string; currentRiskBand: string | null; currentEsgBand: string | null }[];
};

const VERDICT_LABEL: Record<string, string> = {
  FULLY_COVERED: "Fully covered", PARTIALLY_COVERED: "Partially covered", UNCOVERED: "Uncovered",
  UNINSURABLE_ACCEPTED: "Uninsurable — accepted", NOT_ASSESSED: "Not assessed",
};

export function Tier3RiskPanel({ riskId }: { riskId: string }) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/erm/risks/${riskId}/tier3-context`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) { setCtx(d); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [riskId]);

  if (!loaded || !ctx) return null;
  const hasAny = ctx.controls.length > 0 || ctx.policies.length > 0 || ctx.vendors.length > 0 || ctx.coverageVerdict !== "NOT_ASSESSED";
  if (!hasAny) return null;

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900"><ShieldCheck size={15} className="text-slate-400" /> Mitigating Controls</h2>
        {ctx.controls.length === 0 ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"><AlertTriangle size={12} className="mr-1 inline" /> No control is mapped to this risk.</p>
        ) : (
          <>
            {!ctx.hasPrimaryControl && <p className="mb-2 rounded-md bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700">No PRIMARY control — coverage gap</p>}
            {ctx.primaryControlDeficient && <p className="mb-2 rounded-md bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700">Primary control DEFICIENT — recommend residual re-assessment</p>}
            <ul className="space-y-2">
              {ctx.controls.map((c) => (
                <li key={c.controlCode} className="flex items-center justify-between gap-2">
                  <Link href="/erm/controls" className="truncate text-sm text-primary-700 hover:underline">{c.controlCode} · {c.name}</Link>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className={"rounded border px-1.5 py-0.5 text-[10px] " + (STRENGTH_CHIP[c.mitigationStrength] ?? "")}>{c.mitigationStrength[0]}</span>
                    <span className={"rounded border px-1.5 py-0.5 text-[10px] " + (RATING_CHIP[c.operatingRating ?? "NOT_ASSESSED"] ?? "")}>{(c.operatingRating ?? "—").replace(/_/g, " ")}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Risk Transfer */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Umbrella size={15} className="text-slate-400" /> Risk Transfer</h2>
        <div className="mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Coverage verdict</span>
          <div><span className={"mt-1 inline-block rounded border px-2 py-0.5 text-[11px] " + (GAP_TYPE_CHIP[ctx.coverageVerdict] ?? "bg-slate-100 text-slate-600 border-slate-200")}>{VERDICT_LABEL[ctx.coverageVerdict] ?? ctx.coverageVerdict}</span></div>
        </div>
        {ctx.policies.length === 0 ? (
          <p className="text-xs text-slate-400">No policy currently transfers this risk.</p>
        ) : (
          <ul className="space-y-1.5">
            {ctx.policies.map((p) => (
              <li key={p.policyCode} className="flex items-center justify-between gap-2 text-sm">
                <Link href="/erm/insurance/policies" className="truncate text-primary-700 hover:underline">{p.policyCode} · {p.policyName}</Link>
                <span className="shrink-0 text-[10px] text-slate-500">{p.status.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Linked vendors */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Handshake size={15} className="text-slate-400" /> Linked Vendors</h2>
        {ctx.vendors.length === 0 ? (
          <p className="text-xs text-slate-400">No vendor linked to this risk.</p>
        ) : (
          <ul className="space-y-2">
            {ctx.vendors.map((v) => (
              <li key={v.vendorCode} className="flex items-center justify-between gap-2">
                <Link href="/erm/vendors/register" className="truncate text-sm text-primary-700 hover:underline">{v.vendorCode} · {v.legalName}</Link>
                <span className="flex shrink-0 items-center gap-1">
                  {v.currentRiskBand && <span className={"rounded border px-1.5 py-0.5 text-[10px] " + (RISK_BAND_CHIP[v.currentRiskBand] ?? "")}>{v.currentRiskBand}</span>}
                  {v.currentEsgBand && <span className={"rounded border px-1.5 py-0.5 text-[10px] " + (ESG_BAND_CHIP[v.currentEsgBand] ?? "")}>{v.currentEsgBand}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
