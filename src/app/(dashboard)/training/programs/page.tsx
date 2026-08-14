import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus, ShieldAlert } from "lucide-react";
import { Can } from "@/components/auth/can";
import { ProgramsTable, type ProgramRow } from "./programs-table";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";

export const dynamic = "force-dynamic";

type Filter = "all" | "approved" | "draft" | "review" | "retired";

// A programme as /api/training/programs returns it. The endpoint owns the
// filtering (approval state, category, free-text search) so the register and
// its chips are computed from the same query.
type ProgramListItem = {
  id: string;
  code: string;
  programCode: string | null;
  name: string;
  programName: string | null;
  isStatutory: boolean;
  statutoryReference: string | null;
  category: string | null;
  validityMonths: number | null;
  certificateValidityMonths: number | null;
  isMandatoryForRoles: string[] | null;
  isMandatoryForPermitTypes: string[] | null;
  blocksPtwIfMissing: boolean;
  blocksRoleAssignmentIfMissing: boolean;
  blocksContractorOnboardingIfMissing: boolean;
  approvalStatus: string;
};

export default async function TrainingProgramsPage(props: {
  searchParams: Promise<{ filter?: Filter; q?: string; category?: string }>;
}) {
  const searchParams = await props.searchParams;
  const filter = (searchParams.filter ?? "approved") as Filter;
  const q = (searchParams.q ?? "").trim();
  const categoryFilter = searchParams.category ?? "";

  const APPROVAL_BY_FILTER: Record<Filter, string | undefined> = {
    all: undefined,
    approved: "APPROVED",
    draft: "DRAFT",
    review: "UNDER_REVIEW",
    retired: "RETIRED"
  };

  const register = await backendFetch<{
    items: ProgramListItem[];
    approvalCounts: Record<string, number>;
    statutoryApproved: number;
  }>("/api/training/programs", {
    query: {
      // The register must show drafts and retired programmes too — the chips
      // are how you reach them — so the endpoint's default "workable set only"
      // narrowing is switched off here.
      active_only: false,
      approval_status: APPROVAL_BY_FILTER[filter],
      category: categoryFilter || undefined,
      q: q || undefined
    }
  }).catch(() => ({
    items: [] as ProgramListItem[],
    approvalCounts: {} as Record<string, number>,
    statutoryApproved: 0
  }));

  const programs = register.items;
  const cnt = (s: string) => register.approvalCounts[s] ?? 0;
  const statutoryCount = register.statutoryApproved;

  const rows: ProgramRow[] = programs.map((p) => ({
    id: p.id,
    code: p.programCode ?? p.code,
    name: p.programName ?? p.name,
    isStatutory: p.isStatutory,
    statutoryReference: p.statutoryReference ?? null,
    category: p.category ?? null,
    validityMonths: p.certificateValidityMonths ?? p.validityMonths ?? null,
    mandatoryFor: [
      ...(p.isMandatoryForRoles ?? []).slice(0, 2).map((r) => `Role: ${r}`),
      ...(p.isMandatoryForPermitTypes ?? []).slice(0, 2).map((t) => `PTW: ${t}`)
    ],
    gates: [
      p.blocksPtwIfMissing ? "PTW" : null,
      p.blocksRoleAssignmentIfMissing ? "Role" : null,
      p.blocksContractorOnboardingIfMissing ? "Contractor" : null
    ].filter((g): g is string => Boolean(g)),
    approvalStatus: p.approvalStatus
  }));

  return (
    <div>
      <PageHeader
        title="Training Programs"
        description="Master catalogue of all training curricula. Approval-gated; statutory programs marked."
        breadcrumbs={[{ label: "Training", href: "/training" }, { label: "Programs" }]}
        action={
          <Can permission="TRAINING.CREATE">
            <Button asChild>
              <Link href="/training/programs/new">
                <Plus size={16} /> New Program
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabsList label="Status">
          <FilterTab
            href="/training/programs?filter=all"
            active={filter === "all"}
            label="All"
            count={cnt("DRAFT") + cnt("UNDER_REVIEW") + cnt("APPROVED") + cnt("RETIRED")}
          />
          <FilterTab href="/training/programs?filter=approved" active={filter === "approved"} label="Approved" count={cnt("APPROVED")} tone="emerald" />
          <FilterTab href="/training/programs?filter=review" active={filter === "review"} label="Under Review" count={cnt("UNDER_REVIEW")} tone="amber" />
          <FilterTab href="/training/programs?filter=draft" active={filter === "draft"} label="Draft" count={cnt("DRAFT")} tone="slate" />
          <FilterTab href="/training/programs?filter=retired" active={filter === "retired"} label="Retired" count={cnt("RETIRED")} tone="slate" />
        </FilterTabsList>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <ShieldAlert size={12} className="text-rose-600" />
          {statutoryCount} statutory program{statutoryCount === 1 ? "" : "s"} active
        </div>
      </div>

      <ProgramsTable data={rows} />
    </div>
  );
}

