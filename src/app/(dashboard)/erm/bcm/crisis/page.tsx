import Link from "next/link";
import { Plus, Printer } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import { CRISIS_STATUS_CHIP, SEVERITY_LABEL, type CrisisListItem } from "@/app/(dashboard)/erm/lib-p3";

export const dynamic = "force-dynamic";

function fmtDuration(mins: number | null): string {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function StatusChip({ status }: { status: string }) {
  const cls = CRISIS_STATUS_CHIP[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={"inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium " + cls}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default async function CrisisHistoryPage() {
  let crises: CrisisListItem[] = [];
  let error: string | null = null;
  try {
    crises = await backendFetch<CrisisListItem[]>("/api/erm/bcm/crisis");
  } catch (e: any) {
    error = e?.message ?? "Failed to load the crisis history.";
  }

  return (
    <div>
      <PageHeader
        title="Crisis History"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "Business Continuity", href: "/erm/bcm" }, { label: "Crisis" }]}
        description="Every crisis activation — live and historical — with duration, log volume and post-crisis review status. Each record links to its workspace, where the full timestamped log can be printed."
        action={
          <Button asChild variant="destructive">
            <Link href="/erm/bcm/crisis/activate">
              <Plus size={16} className="mr-1.5" /> Activate crisis
            </Link>
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : crises.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No crisis has been activated yet. Use <b>Activate crisis</b> to declare one.
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {crises.map((c) => (
              <Link
                key={c.id}
                href={`/erm/bcm/crisis/${c.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-slate-500">{c.crisisCode}</div>
                    <div className="truncate text-base font-semibold text-slate-900">{c.title}</div>
                  </div>
                  <StatusChip status={c.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span>{c.siteName ?? "Corporate"}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">{SEVERITY_LABEL[c.severityLevel] ?? `Sev ${c.severityLevel}`}</span>
                  <span>Activated {fmtDate(c.activatedAt)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Duration {fmtDuration(c.durationMinutes)} · {c.logEntryCount} log entries</span>
                  <span>Review {c.postCrisisReviewDone ? <span className="text-emerald-600">✓</span> : <span className="text-slate-400">✗</span>}</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary-700">
                  <Printer size={12} /> Open workspace to print log
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Crisis</th>
                  <th className="px-3 py-2">Site</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Activated</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Log</th>
                  <th className="px-3 py-2">Review</th>
                  <th className="px-3 py-2">Print log</th>
                </tr>
              </thead>
              <tbody>
                {crises.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link href={`/erm/bcm/crisis/${c.id}`} className="font-medium text-primary-700 hover:underline">
                        {c.crisisCode}
                      </Link>
                      <div className="max-w-[280px] truncate text-xs text-slate-600">{c.title}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.siteName ?? "Corporate"}</td>
                    <td className="px-3 py-2 text-xs">{SEVERITY_LABEL[c.severityLevel] ?? `Sev ${c.severityLevel}`}</td>
                    <td className="px-3 py-2"><StatusChip status={c.status} /></td>
                    <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(c.activatedAt)}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{fmtDuration(c.durationMinutes)}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{c.logEntryCount}</td>
                    <td className="px-3 py-2 text-center">{c.postCrisisReviewDone ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">✗</span>}</td>
                    <td className="px-3 py-2">
                      <Link href={`/erm/bcm/crisis/${c.id}`} className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline">
                        <Printer size={12} /> Open log (PDF)
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
