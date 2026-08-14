import Link from "next/link";
import { Suspense } from "react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Archive, FileDown, Plus } from "lucide-react";
import { statusColor, humanize } from "@/lib/utils";
import { Can } from "@/components/auth/can";
import { PtwTable, type PermitRow } from "./ptw-table";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { PtwAnalyticsStrip } from "@/components/ptw/analytics-strip";

export const dynamic = "force-dynamic";

const PERMIT_TYPE_COLORS: Record<string, string> = {
  HOT_WORK: "bg-orange-100 text-orange-800 border-orange-200",
  CONFINED_SPACE: "bg-violet-100 text-violet-800 border-violet-200",
  WORK_AT_HEIGHT: "bg-blue-100 text-blue-800 border-blue-200",
  EXCAVATION: "bg-amber-100 text-amber-800 border-amber-200",
  ELECTRICAL_LOTO: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LIFTING: "bg-teal-100 text-teal-800 border-teal-200",
  GENERAL_COLD: "bg-slate-100 text-slate-800 border-slate-200"
};

const TYPE_OPTIONS = [
  { code: "HOT_WORK", label: "Hot Work" },
  { code: "CONFINED_SPACE", label: "Confined Space" },
  { code: "WORK_AT_HEIGHT", label: "Work at Height" },
  { code: "EXCAVATION", label: "Excavation" },
  { code: "ELECTRICAL_LOTO", label: "Electrical / LOTO" },
  { code: "LIFTING", label: "Lifting Operations" },
  { code: "GENERAL_COLD", label: "Cold Work" }
];

const STATUS_OPTIONS = [
  { code: "DRAFT", label: "Draft" },
  { code: "SUBMITTED", label: "Submitted" },
  { code: "ISSUER_APPROVED", label: "Issuer Approved" },
  { code: "SAFETY_APPROVED", label: "Safety Approved" },
  { code: "PLANT_HEAD_APPROVED", label: "Plant Head Approved" },
  { code: "ACTIVE", label: "Active" },
  { code: "SUSPENDED", label: "Suspended" },
  { code: "EXPIRED", label: "Expired" },
  { code: "CLOSED", label: "Closed" },
  { code: "REJECTED", label: "Rejected" }
];

// Permit row colour preference: physical state (SUSPENDED/EXPIRED) overrides
// workflow status when the permit is in a non-workflow lifecycle state.
function permitWorkflowColor(workflowStatus: string | undefined, permitStatus: string) {
  if (permitStatus === "SUSPENDED") return "bg-amber-100 text-amber-800 border-amber-200";
  if (permitStatus === "EXPIRED") return "bg-rose-100 text-rose-800 border-rose-200";
  if (workflowStatus === "COMPLETED") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (workflowStatus === "REJECTED") return "bg-rose-100 text-rose-800 border-rose-200";
  if (workflowStatus === "IN_PROGRESS") return "bg-blue-100 text-blue-800 border-blue-200";
  return statusColor(permitStatus);
}

// A row of /api/ptw. The backend applies PTW.READ scope (including the crew
// membership path for OWN_RECORDS), filters soft-deleted permits, joins plant
// and area names, and attaches the workflow chip.
type PermitListItem = {
  id: string;
  number: string;
  type: string;
  scopeOfWork: string;
  /** ISO strings over the wire, not Dates. */
  validFrom: string;
  validTo: string;
  status: string;
  plantName: string | null;
  areaName: string | null;
  workflow: { status: string; currentStepName: string | null } | null;
};

type PermitRegister = {
  items: PermitListItem[];
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
};

const EMPTY_PERMIT_REGISTER: PermitRegister = { items: [], statusCounts: {}, typeCounts: {} };

export default async function PTWPage(props: { searchParams: Promise<{ type?: string; status?: string; archived?: string }> }) {
  const searchParams = await props.searchParams;

  // Auto-expiry (validTo passed → EXPIRED) is the ptw_expiry_scan scheduler
  // job on the backend now, so a permit expires on time rather than whenever
  // this page next happens to be opened.

  // Hide soft-deleted permits (governed-entity delete). The backend filters
  // these out of its API reads; the frontend reads via Prisma directly, so we
  // exclude them here in the list + the type/status counts.
  // Archived permits (closed-loop retention flag) are hidden from the default
  // register; ?archived=1 shows only the archived ones.
  const showArchived = searchParams.archived === "1";
  // One register call: rows + tab counts, all scoped backend-side. The type and
  // status filters narrow client-side so the tab counts keep describing the
  // whole accessible register rather than the filtered slice.
  const register = await backendFetch<PermitRegister>("/api/ptw", {
    query: { include_archived: showArchived }
  }).catch(() => EMPTY_PERMIT_REGISTER);

  const items = register.items.filter(
    (p) =>
      (!searchParams.type || p.type === searchParams.type) &&
      (!searchParams.status || p.status === searchParams.status)
  );
  const typeCountMap = register.typeCounts;
  const statusCountMap = register.statusCounts;

  const all = Object.values(statusCountMap).reduce((a, b) => a + b, 0);
  const active = statusCountMap.ACTIVE ?? 0;
  const closed = statusCountMap.CLOSED ?? 0;
  const expired = statusCountMap.EXPIRED ?? 0;
  const suspended = statusCountMap.SUSPENDED ?? 0;

  const rows: PermitRow[] = items.map((p) => {
    const inst = p.workflow;
    const workflowStep = inst ? inst.currentStepName ?? "Completed" : humanize(p.status);
    const workflowColor = permitWorkflowColor(inst?.status, p.status);
    return {
      id: p.id,
      number: p.number,
      type: p.type,
      typeColor: PERMIT_TYPE_COLORS[p.type] ?? "bg-slate-100 text-slate-800 border-slate-200",
      plantName: (p.plantName ?? "").replace(" Integrated Unit", "").replace(" Grinding Unit", ""),
      areaName: p.areaName,
      scopeOfWork: p.scopeOfWork,
      validFrom: p.validFrom,
      validTo: p.validTo,
      workflowStep,
      workflowColor
    };
  });

  return (
    <div>
      <PageHeader
        title="Permit to Work"
        description="High-risk work authorization with structured approvals and FLRA"
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/api/ptw/export/register" target="_blank" rel="noreferrer">
                <FileDown size={14} /> Export Register
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={showArchived ? "/ptw" : "/ptw?archived=1"}>
                <Archive size={14} /> {showArchived ? "Live Permits" : "Archived"}
              </Link>
            </Button>
            <Can permission="PTW.CREATE">
              <Button asChild>
                <Link href="/ptw/new">
                  <Plus size={16} /> New Permit
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      <div className="mb-4">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <PtwAnalyticsStrip />
        </Suspense>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatBox label="Total" value={all} tone="default" />
        <StatBox label="Active" value={active} tone="success" />
        <StatBox label="Suspended" value={suspended} tone="warning" />
        <StatBox label="Closed" value={closed} tone="default" />
        <StatBox label="Expired" value={expired} tone="danger" />
      </div>

      {/* TYPE and STATUS filter tabs hidden — uncomment to restore
      <FilterTabsList label="Type" className="mb-3">
        ...
      </FilterTabsList>
      <FilterTabsList label="Status" className="mb-4">
        ...
      </FilterTabsList>
      */}

      <PtwTable data={rows} />
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: "default" | "success" | "warning" | "danger" }) {
  const colors = {
    default: "bg-primary-50 text-primary-800",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-rose-50 text-rose-800"
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <div className="text-xs uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
