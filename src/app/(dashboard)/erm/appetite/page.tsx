import Link from "next/link";
import { AlertTriangle, ChevronRight, Settings2, FileWarning } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import {
  APPETITE_LEVEL_CHIP,
  GAUGE_CHIP,
  type AppetiteDashRow,
  type AppetiteBreach,
  type BandGauge,
} from "@/app/(dashboard)/erm/lib-p2";

export const dynamic = "force-dynamic";

const BAND_LABEL: Record<string, string> = {
  MAX_RESIDUAL_SCORE: "Max residual score",
  MAX_CRITICAL_COUNT: "Max critical risks",
  MAX_HIGH_PLUS_COUNT: "Max high+ risks",
  MAX_RED_KRI_COUNT: "Max red KRIs",
};

function bandLabel(t: string): string {
  return BAND_LABEL[t] ?? t.replace(/_/g, " ");
}

function GaugeBar({ g }: { g: BandGauge }) {
  const threshold = g.thresholdValue || 1;
  // Scale to the larger of observed / threshold so the marker stays in view.
  const max = Math.max(threshold, g.observedValue) || 1;
  const obsPct = Math.min(100, (g.observedValue / max) * 100);
  const thrPct = Math.min(100, (threshold / max) * 100);
  const barColor =
    g.state === "BREACH" ? "#C0392B" : g.state === "APPROACHING" ? "#E6A817" : "#2E8B57";
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-[11px] font-medium text-slate-600">{bandLabel(g.bandType)}</span>
      <div className="relative h-2.5 flex-1 rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${obsPct}%`, backgroundColor: barColor }}
        />
        {/* threshold marker */}
        <div
          className="absolute inset-y-[-2px] w-0.5 bg-slate-700"
          style={{ left: `${thrPct}%` }}
          title={`Threshold ${g.thresholdValue}`}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-slate-700">
        <b>{g.observedValue}</b> / {g.thresholdValue}
      </span>
      <span
        className={
          "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold " +
          (GAUGE_CHIP[g.state] ?? "bg-slate-100 text-slate-600 border-slate-200")
        }
      >
        {g.state}
      </span>
    </div>
  );
}

function Row({ row }: { row: AppetiteDashRow }) {
  const href = row.statementId
    ? `/erm/appetite/${row.statementId}`
    : `/erm/appetite/new?categoryId=${row.categoryId}`;
  const hasStatement = !!row.statementId;
  return (
    <Link
      href={href}
      className="block rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-1 h-4 w-4 shrink-0 rounded"
            style={{ backgroundColor: row.categoryColor ?? "#64748b" }}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{row.categoryName ?? row.categoryCode ?? "—"}</span>
              {row.appetiteLevel && (
                <span
                  className={
                    "rounded border px-2 py-0.5 text-[11px] font-semibold " +
                    (APPETITE_LEVEL_CHIP[row.appetiteLevel] ?? "bg-slate-100 text-slate-600 border-slate-200")
                  }
                >
                  {row.appetiteLevel}
                </span>
              )}
              {row.status && (
                <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  {row.status.replace(/_/g, " ")}
                </span>
              )}
              {row.openBreaches > 0 && (
                <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                  <AlertTriangle size={11} /> {row.openBreaches} open breach{row.openBreaches === 1 ? "" : "es"}
                </span>
              )}
            </div>
            {hasStatement ? (
              <p className="mt-1 max-w-3xl text-sm text-slate-600">{row.statementExcerpt}</p>
            ) : (
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-amber-700">
                <FileWarning size={13} /> No appetite statement — draft one
              </p>
            )}
          </div>
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-slate-300" />
      </div>

      {row.gauges.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          {row.gauges.map((g, i) => (
            <GaugeBar key={`${g.bandType}-${i}`} g={g} />
          ))}
        </div>
      )}
    </Link>
  );
}

export default async function AppetiteDashboardPage() {
  let rows: AppetiteDashRow[] = [];
  let breaches: AppetiteBreach[] = [];
  let error: string | null = null;
  try {
    [rows, breaches] = await Promise.all([
      backendFetch<AppetiteDashRow[]>("/api/erm/appetite/dashboard"),
      backendFetch<AppetiteBreach[]>("/api/erm/appetite/breaches", {
        query: { openOnly: true },
      }).catch(() => [] as AppetiteBreach[]),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load appetite dashboard";
  }

  const openBreachCount = breaches.length;

  return (
    <div>
      <PageHeader
        title="Risk Appetite"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Appetite" }]}
        description="Board-set appetite statements per category, with live tolerance gauges fed from the residual register and KRIs."
        action={
          <Link
            href="/erm/appetite/statements"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-primary-500"
          >
            <Settings2 size={15} /> Manage statements
          </Link>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Phase 2 seed has been run and you are logged in with an ERM role.
        </div>
      ) : (
        <div className="space-y-4">
          {openBreachCount > 0 && (
            <Link
              href="/erm/appetite/breaches"
              className="flex items-center justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-900 transition-colors hover:bg-rose-100"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle size={18} />
                {openBreachCount} appetite breach{openBreachCount === 1 ? "" : "es"} require committee decision
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium">
                Review breaches <ChevronRight size={14} />
              </span>
            </Link>
          )}

          {rows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
              No risk categories configured.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <Row key={row.categoryId} row={row} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
