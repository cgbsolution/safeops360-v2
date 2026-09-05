"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Repeat, X, ChevronRight } from "lucide-react";
import { DOMAIN_COLOR, DOMAIN_LABEL, ORIGIN_LABEL, type CauseAnalyticsResponse, type CauseDetail } from "../lib";
import { RISK_BAND_CHIP } from "@/app/(dashboard)/erm/lib-t3";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Metric = "riskReach" | "occurrences";

function DomainDots({ domains }: { domains: string[] }) {
  return (
    <span className="inline-flex items-center gap-1" title={domains.map((d) => DOMAIN_LABEL[d] ?? d).join(", ")}>
      {domains.map((d) => (
        <span key={d} className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white" style={{ backgroundColor: DOMAIN_COLOR[d] ?? "#94a3b8" }} />
      ))}
    </span>
  );
}

export function AnalyticsView({ data, domain }: { data: CauseAnalyticsResponse; domain?: string | null }) {
  const [metric, setMetric] = useState<Metric>("riskReach");
  const [openCause, setOpenCause] = useState<{ id: string; name: string } | null>(null);
  const causes = [...data.causes].sort((a, b) => b[metric] - a[metric]).slice(0, 15);
  const maxCause = Math.max(1, ...causes.map((c) => c[metric]));
  const cats = [...data.categories].sort((a, b) => b.domainSpread - a.domainSpread || b.riskReach - a.riskReach);
  const maxCat = Math.max(1, ...cats.map((c) => c.riskReach));
  const crossDomain = cats.filter((c) => c.domainSpread >= 2);

  return (
    <div className="space-y-6">
      {/* Enterprise-category rollup — the board view */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Enterprise cause categories — the board view</h2>
          <span className="text-[11px] text-slate-400">{data.note}</span>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          The ~7 enterprise categories every domain-specific cause rolls up to. A category lighting up across
          multiple <em>domains</em> is the cross-domain headline only a register spanning all risk types can produce.
        </p>
        <div className="space-y-2.5">
          {cats.map((c) => (
            <div key={c.enterpriseCategoryId} className="grid grid-cols-[180px_1fr_auto] items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: c.colorHex }} />
                <span className="truncate text-xs font-medium text-slate-700" title={c.categoryName}>{c.categoryName}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                  <div className="h-full rounded" style={{ width: `${(c.riskReach / maxCat) * 100}%`, backgroundColor: c.colorHex }} />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-slate-600">{c.riskReach} risk{c.riskReach === 1 ? "" : "s"}</span>
              </div>
              <div className="flex items-center gap-2">
                <DomainDots domains={c.domains} />
                <Badge variant="neutral" className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{c.domainSpread} domain{c.domainSpread === 1 ? "" : "s"}</Badge>
              </div>
            </div>
          ))}
        </div>
        {crossDomain.length > 0 && (
          <Alert variant="warning" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Cross-domain insight:</strong>{" "}
            {crossDomain.slice(0, 1).map((c) => (
              <span key={c.enterpriseCategoryId}>
                <strong>{c.categoryName}</strong> contributes to {c.riskReach} risk{c.riskReach === 1 ? "" : "s"} across{" "}
                {c.domains.map((d) => DOMAIN_LABEL[d] ?? d).join(", ")} — one enterprise cause spanning {c.domainSpread} risk domains.
              </span>
            ))}
          </Alert>
        )}
      </section>

      {/* Pareto of causes — toggle occurrence ⇄ risk-reach */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Top root causes (Pareto)</h2>
          <Card className="flex rounded-lg border border-slate-200 p-0.5 text-xs shadow-none">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMetric("riskReach")}
              className={cn(
                "h-auto rounded px-2.5 py-1 font-medium",
                metric === "riskReach" ? "bg-slate-900 text-white" : "text-slate-600"
              )}
            >by risk reach</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMetric("occurrences")}
              className={cn(
                "h-auto rounded px-2.5 py-1 font-medium",
                metric === "occurrences" ? "bg-slate-900 text-white" : "text-slate-600"
              )}
            >by frequency</Button>
          </Card>
        </div>
        <div className="space-y-2">
          {causes.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No approved RCAs yet.</p>}
          {causes.map((c) => (
            <Button
              key={c.subCauseId}
              type="button"
              variant="ghost"
              onClick={() => setOpenCause({ id: c.subCauseId, name: c.subCauseName })}
              className="justify-start grid h-auto w-full cursor-pointer grid-cols-[230px_1fr_auto] items-center gap-3 px-1.5 py-1 text-left hover:bg-slate-50"
              title="View underlying risks & citing RCAs"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="truncate text-xs font-medium text-slate-700" title={c.subCauseName}>{c.subCauseName}</span>
                {c.isRecurringDriver && (
                  <Badge variant="danger" title="Recurring systemic driver" className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                    <Repeat size={10} /> recurring
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                  <div className="h-full rounded bg-indigo-500" style={{ width: `${(c[metric] / maxCause) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs tabular-nums text-slate-600">{c[metric]}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{c.categoryCode}</span>
                <DomainDots domains={c.domains} />
                <ChevronRight size={14} className="text-slate-300" />
              </div>
            </Button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          <strong>Risk reach</strong> = distinct risks a cause drives (the “combination” metric). Coloured dots = the distinct risk domains it touches.
          Click any cause to drill into the underlying risks and citing RCAs.
        </p>
      </section>

      {/* Recurring drivers callout */}
      {data.causes.some((c) => c.isRecurringDriver) && (
        <section className="rounded-xl border border-rose-200 bg-rose-50/60 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-800">
            <AlertTriangle size={16} /> Recurring systemic drivers
          </div>
          <p className="mb-3 text-xs text-rose-900/80">
            Causes that keep showing up <em>and</em> keep driving risk (reach ≥ 2, frequency ≥ {data.recurringDriverThreshold}).
            Fixing these retires the most exposure.
          </p>
          <div className="flex flex-wrap gap-2">
            {data.causes.filter((c) => c.isRecurringDriver).map((c) => (
              <Alert variant="destructive" key={c.subCauseId} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs">
                <div className="font-medium text-slate-800">{c.subCauseName}</div>
                <div className="text-slate-500">reach {c.riskReach} · {c.occurrences} citation{c.occurrences === 1 ? "" : "s"} · {c.domainSpread} domain{c.domainSpread === 1 ? "" : "s"}</div>
              </Alert>
            ))}
          </div>
        </section>
      )}

      {openCause && (
        <CauseDrawer
          subCauseId={openCause.id}
          subCauseName={openCause.name}
          domain={domain ?? null}
          onClose={() => setOpenCause(null)}
        />
      )}
    </div>
  );
}

function CauseDrawer({
  subCauseId,
  subCauseName,
  domain,
  onClose,
}: {
  subCauseId: string;
  subCauseName: string;
  domain: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<CauseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
    fetch(`/api/erm/rca/analytics/cause/${subCauseId}${qs}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.detail || j.error || `Failed to load cause (${res.status})`);
        }
        return res.json() as Promise<CauseDetail>;
      })
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message ?? "Failed to load cause");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subCauseId, domain]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cause drill-down</div>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-800">
                {detail?.subCauseName ?? subCauseName}
              </h3>
              {detail && (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{detail.subCauseCode}</span>
                  <span className="truncate" title={detail.categoryName}>{detail.categoryName}</span>
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              <X size={18} />
            </Button>
          </div>
          {detail && (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="violet" className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                {detail.riskReach} risk{detail.riskReach === 1 ? "" : "s"}
              </Badge>
              <Badge variant="neutral" className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {detail.occurrences} citation{detail.occurrences === 1 ? "" : "s"}
              </Badge>
              <Badge variant="neutral" className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                <DomainDots domains={detail.domains} />
                {detail.domainSpread} domain{detail.domainSpread === 1 ? "" : "s"}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex-1 px-6 py-4">
          {loading && <p className="py-8 text-center text-sm text-slate-400">Loading…</p>}
          {error && (
            <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</Alert>
          )}
          {detail && !loading && (
            <div className="space-y-6">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Underlying risks ({detail.risks.length})
                </div>
                {detail.risks.length === 0 ? (
                  <p className="text-xs text-slate-400">No linked risks.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.risks.map((r) => (
                      <li key={r.riskId}>
                        <Link
                          href={`/erm/register/${r.riskId}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-slate-400 hover:bg-slate-50"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">{r.riskCode}</span>
                            <span className="truncate text-xs text-slate-700" title={r.riskTitle}>{r.riskTitle}</span>
                          </span>
                          {r.residualBand && (
                            <span className={"shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold " + (RISK_BAND_CHIP[r.residualBand] ?? "border-slate-200 bg-slate-100 text-slate-600")}>
                              {r.residualBand}{r.residualScore != null ? ` · ${r.residualScore}` : ""}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Citing RCAs ({detail.rcas.length})
                </div>
                {detail.rcas.length === 0 ? (
                  <p className="text-xs text-slate-400">No citing RCAs.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.rcas.map((a) => (
                      <li key={a.rcaId}>
                        <Link
                          href={`/erm/rca/${a.rcaId}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-slate-400 hover:bg-slate-50"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">{a.rcaCode}</span>
                            <span className="truncate text-xs text-slate-700" title={a.title}>{a.title}</span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: DOMAIN_COLOR[a.primaryDomain] ?? "#94a3b8" }} />
                            {ORIGIN_LABEL[a.originType]}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
