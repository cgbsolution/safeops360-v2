import { RISK_BAND_CHIP, ESG_BAND_CHIP } from "@/app/(dashboard)/erm/lib-t3";

/** Single band badge with optional score, in the platform chip style. */
export function VendorBandBadge({
  band,
  score,
  kind,
}: {
  band: string | null | undefined;
  score?: number | null;
  kind: "RISK" | "ESG";
}) {
  if (!band) return <span className="text-xs text-slate-400">—</span>;
  const map = kind === "RISK" ? RISK_BAND_CHIP : ESG_BAND_CHIP;
  const cls = map[band.toUpperCase()] ?? "border-slate-200 bg-slate-100 text-slate-600";
  return (
    <span className={"inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold " + cls}>
      {score != null && <span className="tabular-nums">{score}</span>}
      {band}
    </span>
  );
}

/** The DUAL-LENS signature: Risk band | ESG band side by side. */
export function TwinBadges({
  riskBand,
  riskScore,
  esgBand,
  esgScore,
}: {
  riskBand: string | null | undefined;
  riskScore?: number | null;
  esgBand: string | null | undefined;
  esgScore?: number | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <VendorBandBadge band={riskBand} score={riskScore} kind="RISK" />
      <span className="text-slate-300">|</span>
      <VendorBandBadge band={esgBand} score={esgScore} kind="ESG" />
    </div>
  );
}
