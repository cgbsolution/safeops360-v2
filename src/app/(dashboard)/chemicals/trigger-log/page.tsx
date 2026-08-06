// Screen 6 — MOC Trigger Log (§7 #6).
//
// This screen is the point of the module's reliability work. The platform's
// previous generation of automatic triggers could fail with the outcome
// recorded nowhere a person would look, which is how one of them managed to
// fire zero times across twenty-two production closures without anyone
// noticing. Putting FIRED / FAILED / SKIPPED on a screen someone can open is
// what converts "we believe it works" into "here is the evidence".
//
// SKIPPED is shown, not hidden. A trigger that evaluated and decided not to act
// is a different fact from one that crashed, and collapsing them is the exact
// ambiguity that made the original defect invisible.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { TriggerLogEntry } from "@/lib/chemicals/types";
import { fmtQty, prettyLabel } from "@/lib/chemicals/types";
import { EmptyState, ErrorState, Kpi, StatusChip, SubNav, TILE } from "../_components";

export const dynamic = "force-dynamic";

type LogResponse = {
  counts: { FIRED: number; FAILED: number; SKIPPED: number };
  entries: TriggerLogEntry[];
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "FIRED", label: "Fired" },
  { value: "FAILED", label: "Failed" },
  { value: "SKIPPED", label: "Skipped" },
];

export default async function TriggerLogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; plantId?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.status) qs.set("status", sp.status);
  if (sp.plantId) qs.set("plantId", sp.plantId);

  let d: LogResponse | null = null;
  let error: string | null = null;
  try {
    d = await backendFetch<LogResponse>(`/api/chemicals/moc-trigger-log?${qs.toString()}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load the trigger log";
  }

  const total = d ? d.counts.FIRED + d.counts.FAILED + d.counts.SKIPPED : 0;
  const successRate = d && d.counts.FIRED + d.counts.FAILED > 0
    ? Math.round((100 * d.counts.FIRED) / (d.counts.FIRED + d.counts.FAILED))
    : null;

  return (
    <div>
      <PageHeader
        title="MOC Trigger Log"
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Chemical & Hazmat", href: "/chemicals" },
          { label: "MOC trigger log" },
        ]}
        description="Every automatic change-request evaluation, with its outcome. A failed trigger notifies the HSE Manager and appears here — it never fails quietly."
      />
      <SubNav current="/chemicals/trigger-log" />

      {error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Fired" value={d?.counts.FIRED ?? 0} tone="good" sub="MOC raised" />
            <Kpi
              label="Failed"
              value={d?.counts.FAILED ?? 0}
              tone={(d?.counts.FAILED ?? 0) ? "critical" : "good"}
              sub="needs manual action"
            />
            <Kpi label="Skipped" value={d?.counts.SKIPPED ?? 0} sub="evaluated, no action needed" />
            <Kpi
              label="Attempt success rate"
              value={successRate === null ? "—" : `${successRate}%`}
              tone={successRate !== null && successRate < 100 ? "warn" : "good"}
              sub="fired ÷ (fired + failed)"
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-1">
            {FILTERS.map((f) => {
              const active = (sp.status ?? "") === f.value;
              const href = f.value ? `/chemicals/trigger-log?status=${f.value}` : "/chemicals/trigger-log";
              return (
                <Link
                  key={f.label}
                  href={href}
                  className={
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition " +
                    (active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50")
                  }
                >
                  {f.label}
                </Link>
              );
            })}
          </div>

          {!d || d.entries.length === 0 ? (
            <EmptyState
              title={total === 0 ? "No trigger evaluations recorded yet" : "No entries match this filter"}
              hint={
                total === 0
                  ? "A row appears here the first time a receipt or transfer takes a site across a regulatory threshold — including if the change request could not be created."
                  : undefined
              }
            />
          ) : (
            <div className={TILE + " overflow-x-auto p-0"}>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">When</th>
                    <th className="px-4 py-2.5 font-semibold">Trigger</th>
                    <th className="px-4 py-2.5 font-semibold">Schedule</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Observed / limit</th>
                    <th className="px-4 py-2.5 font-semibold">Outcome</th>
                    <th className="px-4 py-2.5 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.entries.map((e) => (
                    <tr key={e.id} className={e.status === "FAILED" ? "bg-rose-50/40" : "hover:bg-slate-50"}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {new Date(e.triggeredAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{prettyLabel(e.triggerType)}</td>
                      <td className="px-4 py-2.5 text-slate-700">{e.scheduleReference ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                        {e.observedQuantity === null ? (
                          "—"
                        ) : (
                          <>
                            {fmtQty(e.observedQuantity, e.unit)}
                            <span className="text-slate-400"> / {fmtQty(e.thresholdQuantity, e.unit)}</span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2.5"><StatusChip status={e.status} /></td>
                      <td className="px-4 py-2.5">
                        {e.status === "FAILED" ? (
                          <div>
                            <div className="text-xs font-medium text-rose-700">
                              {e.failureReason ?? "No reason recorded"}
                            </div>
                            <div className="mt-0.5 text-[11px] text-rose-500">
                              The change request was NOT created — raise it manually.
                              {e.acknowledgedAt
                                ? ` Acknowledged ${new Date(e.acknowledgedAt).toLocaleString()}.`
                                : " Not yet acknowledged."}
                            </div>
                          </div>
                        ) : e.mocId ? (
                          <Link href={`/moc/${e.mocId}`} className="text-xs font-medium text-slate-700 hover:underline">
                            {e.mocNumber ?? "Open change request"} →
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-500">{e.reason ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                A FAILED row always carries a reason — that is a database constraint, not a
                convention, so a failure cannot be written without one.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
