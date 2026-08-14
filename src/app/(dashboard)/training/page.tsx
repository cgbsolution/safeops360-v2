import Link from "next/link";
import { Suspense } from "react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, GraduationCap } from "lucide-react";
import { daysBetween } from "@/lib/utils";
import { Can } from "@/components/auth/can";
import { TrainingRecordsTable, type TrainingRow, type TrainingClass } from "./training-records-table";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { TrainingAnalyticsStrip } from "@/components/training/analytics-strip";

export const dynamic = "force-dynamic";

export default async function TrainingPage(props: {
  searchParams: Promise<{ filter?: TrainingClass; programId?: string; q?: string }>;
}) {
  const searchParams = await props.searchParams;
  const filter = (searchParams.filter ?? "all") as TrainingClass;
  const programIdFilter = searchParams.programId;
  const q = (searchParams.q ?? "").trim();
  const now = new Date();

  // Both reads are independent — run in parallel.
  // Both reads are independent — run in parallel. Records arrive with the
  // employee and programme nested, and scoped to what the caller may read.
  const [recordsRes, programsRes] = await Promise.all([
    backendFetch<{ items: any[] }>("/api/training").catch(() => ({ items: [] as any[] })),
    backendFetch<{ items: any[] }>("/api/training/programs", {
      // The register lists every programme, not only the workable set.
      query: { active_only: false }
    }).catch(() => ({ items: [] as any[] }))
  ]);
  const allRecords = recordsRes.items;
  const programs = programsRes.items;

  // Latest record per (employee, program) — basis for compliance counts
  const latestByPair = new Map<string, typeof allRecords[number]>();
  for (const r of allRecords) {
    const key = `${r.employeeId}::${r.programId}`;
    const prev = latestByPair.get(key);
    if (!prev || r.date > prev.date) latestByPair.set(key, r);
  }
  const latest = Array.from(latestByPair.values());

  const validCount = latest.filter((r) => r.validUntil > now && r.passed).length;
  const expiredCount = latest.filter((r) => r.validUntil <= now).length;
  const expiringCount = latest.filter((r) => {
    if (r.validUntil <= now) return false;
    if (!r.passed) return false;
    const days = daysBetween(now, r.validUntil);
    return days > 0 && days <= 30;
  }).length;
  const failedCount = latest.filter((r) => !r.passed).length;

  function classify(r: typeof allRecords[number]): Exclude<TrainingClass, "all"> {
    if (!r.passed) return "failed";
    if (r.validUntil <= now) return "expired";
    const days = daysBetween(now, r.validUntil);
    if (days > 0 && days <= 30) return "expiring";
    return "valid";
  }

  const visible = allRecords
    .filter((r) => {
      if (programIdFilter && r.programId !== programIdFilter) return false;
      if (filter !== "all" && classify(r) !== filter) return false;
      if (q) {
        const hay = `${r.employee.name} ${r.employee.department ?? ""} ${r.program.name} ${r.program.code}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 100);

  const rows: TrainingRow[] = visible.map((r) => ({
    id: r.id,
    employeeName: r.employee.name,
    employeeDept: r.employee.department ?? null,
    programName: r.program.name,
    programCode: r.program.code,
    date: r.date.toISOString(),
    passed: r.passed,
    score: r.score,
    validUntil: r.validUntil.toISOString(),
    klass: classify(r),
    daysToExpiry: daysBetween(now, r.validUntil)
  }));

  function chipHref(next: Partial<{ filter: TrainingClass; programId: string; q: string }>): string {
    const sp = new URLSearchParams();
    const merged = { filter, programId: programIdFilter, q, ...next };
    if (merged.filter && merged.filter !== "all") sp.set("filter", merged.filter);
    if (merged.programId) sp.set("programId", merged.programId);
    if (merged.q) sp.set("q", merged.q);
    const s = sp.toString();
    return s ? `/training?${s}` : "/training";
  }

  return (
    <div>
      <PageHeader
        title="Training Management"
        description="Safety training programs, attendance, certification, and validity tracking"
        action={
          <Can permission="TRAINING.CREATE">
            <Button asChild>
              <Link href="/training/new">
                <Plus size={16} /> Schedule Training
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 pb-2 sm:gap-2">
        <HubLink href="/training" label="Records" active />
        <HubLink href="/training/programs" label="Programs" />
        <HubLink href="/training/schedules" label="Schedules" />
        <HubLink href="/training/certificates" label="Certificates" />
        <HubLink href="/training/my-certifications" label="My Certifications" />
        <HubLink href="/training/analytics" label="Analytics" />
      </div>

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <TrainingAnalyticsStrip />
        </Suspense>
      </div>

      <FilterTabsList label="Filter" className="mb-2">
        <FilterTab href={chipHref({ filter: "all" })} label="All" count={allRecords.length} active={filter === "all"} />
        <FilterTab href={chipHref({ filter: "valid" })} label="Valid" count={validCount} active={filter === "valid"} tone="emerald" />
        <FilterTab href={chipHref({ filter: "expiring" })} label="Expiring 30d" count={expiringCount} active={filter === "expiring"} tone="amber" />
        <FilterTab href={chipHref({ filter: "expired" })} label="Expired" count={expiredCount} active={filter === "expired"} tone="rose" />
        <FilterTab href={chipHref({ filter: "failed" })} label="Failed" count={failedCount} active={filter === "failed"} tone="rose" />
      </FilterTabsList>

      <form className="mb-4 flex flex-wrap gap-2" action="/training" method="GET">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search employee / program / department…"
          className="h-9 min-w-[220px] flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <select
          name="programId"
          defaultValue={programIdFilter ?? ""}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All programs</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline">Apply</Button>
        {(programIdFilter || q || filter !== "all") && (
          <Button asChild size="sm" variant="outline">
            <Link href="/training">Clear</Link>
          </Button>
        )}
      </form>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            {filter === "all" ? "Recent Training Records" : `Filtered Records — ${filter}`}
          </h2>
          <TrainingRecordsTable data={rows} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Training Programs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {programs.map((p) => (
              <Link
                key={p.id}
                href={`/training/programs/${p.id}`}
                className="-mx-1 block cursor-pointer rounded border-b px-1 pb-2 last:border-0 last:pb-0 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <span className="truncate">{p.name}</span>
                      {p.mandatory && <Badge className="bg-rose-100 text-rose-800 border-rose-200">Mandatory</Badge>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.code} · {p.durationHours}h · {p.validityMonths}m validity · pass ≥ {p.passingScore}
                    </div>
                  </div>
                  <GraduationCap size={16} className="mt-1 flex-shrink-0 text-primary-600" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HubLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-primary-700 text-white" : "text-slate-600 hover:bg-slate-50 hover:text-primary-700"
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
