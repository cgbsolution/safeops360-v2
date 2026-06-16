"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, ExternalLink } from "lucide-react";
import type { WizardSubmission } from "./wizard-types";
import type { KpiResult } from "@/lib/manhours/kpi-engine";
import { KPI_CODES, type KpiCode } from "@/lib/manhours/kpi-registry";

/**
 * KPI tile grid rendered above the wizard's stepper for LOCKED
 * submissions. Reads from the immutable snapshot — never recomputes —
 * and links each tile to the drill-down page so reviewers can audit
 * any number end-to-end without leaving the period.
 */
export function LockedKpiPanel({ submission }: { submission: WizardSubmission }) {
  if (!submission.kpiSnapshot) return null;

  const snap = submission.kpiSnapshot as {
    capturedAt?: string;
    kpis?: Record<string, KpiResult>;
  };
  if (!snap.kpis) return null;

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Camera size={16} className="text-emerald-700" />
            KPI snapshot
          </CardTitle>
          <CardDescription>
            Captured at lock{snap.capturedAt ? ` · ${new Date(snap.capturedAt).toLocaleString("en-IN")}` : ""}.
            These values are immutable — drill into any tile for the source records and audit trail.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {KPI_CODES.map((code) => {
            const kpi = snap.kpis![code];
            if (!kpi) return null;
            return (
              <KpiTile
                key={code}
                kpi={kpi}
                href={drillDownHref(submission, code)}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function KpiTile({ kpi, href }: { kpi: KpiResult; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md border bg-white p-3 transition hover:shadow-sm hover:border-primary-300 group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 leading-tight">{kpi.kpiName}</div>
        <ExternalLink size={10} className="text-slate-300 group-hover:text-primary-500 flex-shrink-0 mt-0.5" />
      </div>
      <div
        className="mt-1 text-xl font-bold tabular-nums"
        style={{ color: kpi.bandColor }}
      >
        {kpi.formattedValue}
      </div>
      <div className="mt-1 flex items-center gap-1">
        {kpi.band && (
          <Badge style={{ backgroundColor: kpi.bandColor, color: "white" }} className="text-[9px] px-1.5 py-0">
            {kpi.band.replace(/_/g, " ")}
          </Badge>
        )}
        <span className="text-[10px] text-slate-500 font-mono">{kpi.kpiCode}</span>
      </div>
    </Link>
  );
}

function drillDownHref(submission: WizardSubmission, code: KpiCode): string {
  const params = new URLSearchParams({
    code,
    plantId: submission.plantId,
    year: String(submission.reportingYear),
    month: String(submission.reportingMonth),
    // Snapshot path — the drill-down page hits findKpiSnapshot first
    // and serves the immutable cached value for LOCKED periods.
    preferSnapshot: "true"
  });
  return `/manhours/kpi?${params.toString()}`;
}
