import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KpiTile } from "@/components/erm/shared";
import {
  PLAN_STATUS_CHIP,
  PLAN_HEALTH_CHIP,
  type PlanListResponse,
} from "@/app/(dashboard)/erm/lib-p3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import { NewPlanButton } from "./new-plan-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const PLAN_TYPE_LABEL: Record<string, string> = {
  BUSINESS_CONTINUITY: "Business Continuity",
  DISASTER_RECOVERY_IT: "IT DR",
  CRISIS_MANAGEMENT: "Crisis Mgmt",
  EMERGENCY_RESPONSE_LINK: "Emergency Response",
};
const STATUS_FILTERS = ["DRAFT", "IN_REVIEW", "APPROVED", "REVIEW_DUE", "RETIRED"] as const;

export default async function PlansPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const statusRaw = sp.status;
  const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;

  let data: PlanListResponse = { items: [], total: 0, statusCounts: {} };
  let error: string | null = null;
  try {
    data = await backendFetch<PlanListResponse>("/api/erm/bcm/plans", { query: { status: status ?? undefined } });
  } catch (e: any) {
    error = e?.message ?? "Failed to load continuity plans";
  }

  const counts = data.statusCounts ?? {};
  const atRisk = data.items.filter((p) => p.healthChip === "AT_RISK" || p.healthChip === "STALE").length;

  const statusChip = (s: string) => {
    const next = new URLSearchParams();
    if (status !== s) next.set("status", s);
    const active = status === s;
    return (
      <Link
        key={s}
        href={`/erm/bcm/plans${next.toString() ? `?${next.toString()}` : ""}`}
        className={
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
          (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
        }
      >
        {s.replace(/_/g, " ")} <span className="tabular-nums opacity-70">{counts[s] ?? 0}</span>
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="Continuity Plans"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity", href: "/erm/bcm" },
          { label: "Plans" },
        ]}
        description="The plan repository — business-continuity, IT-DR, crisis-management and emergency-response plans, with versioning, approval and exercise-driven health."
        action={<NewPlanButton />}
      />

      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Phase 3 (BCM) seed has been run and you are logged in with a BCM role.
        </Alert>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile label="Plans" value={data.total} />
            <KpiTile label="Approved" value={counts.APPROVED ?? 0} tone="good" href="/erm/bcm/plans?status=APPROVED" />
            <KpiTile label="In Review" value={counts.IN_REVIEW ?? 0} tone="warn" href="/erm/bcm/plans?status=IN_REVIEW" />
            <KpiTile label="Stale / At-risk (shown)" value={atRisk} tone={atRisk > 0 ? "high" : "good"} />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
            {STATUS_FILTERS.map(statusChip)}
            <span className="ml-auto text-xs text-slate-500">{data.items.length} shown</span>
          </div>

          <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
            <Table className="w-full min-w-[980px] text-sm">
              <TableHeader className="bg-slate-50/95">
                <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <TableHead className="px-3 py-2.5">Code</TableHead>
                  <TableHead className="px-3 py-2.5">Title</TableHead>
                  <TableHead className="px-3 py-2.5">Type</TableHead>
                  <TableHead className="px-3 py-2.5">Site</TableHead>
                  <TableHead className="px-3 py-2.5">Owner</TableHead>
                  <TableHead className="px-3 py-2.5 text-center">Processes</TableHead>
                  <TableHead className="px-3 py-2.5 text-center">Ver</TableHead>
                  <TableHead className="px-3 py-2.5">Status</TableHead>
                  <TableHead className="px-3 py-2.5">Health</TableHead>
                  <TableHead className="px-3 py-2.5">Last exercised</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="px-3 py-10 text-center text-sm text-slate-400">
                      No plans match the current filter. Use “New Plan” to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((p) => (
                    <TableRow key={p.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <TableCell className="px-3 py-2.5">
                        <Link href={`/erm/bcm/plans/${p.id}`} className="font-medium text-primary-700 hover:underline">{p.planCode}</Link>
                      </TableCell>
                      <TableCell className="max-w-[260px] px-3 py-2.5 text-slate-800">{p.title}</TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-600">{PLAN_TYPE_LABEL[p.planType] ?? p.planType.replace(/_/g, " ")}</TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-600">{p.siteName ?? "—"}</TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-600">{p.ownerName ?? "—"}</TableCell>
                      <TableCell className="px-3 py-2.5 text-center text-xs tabular-nums text-slate-600">{p.coveredProcessCount}</TableCell>
                      <TableCell className="px-3 py-2.5 text-center text-xs tabular-nums text-slate-500">v{p.version}</TableCell>
                      <TableCell className="px-3 py-2.5">
                        <span className={"rounded border px-2 py-0.5 text-[11px] " + (PLAN_STATUS_CHIP[p.status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                          {p.status.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <span className={"rounded border px-2 py-0.5 text-[11px] " + (PLAN_HEALTH_CHIP[p.healthChip] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                          {p.healthChip}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-500">
                        {p.lastExercisedAt ? fmtDate(p.lastExercisedAt) : <span className="text-rose-500">never</span>}
                        {p.exerciseOverdue && <span className="ml-1 text-[10px] font-semibold text-amber-600">overdue</span>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
