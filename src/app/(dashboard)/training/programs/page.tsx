import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus, ShieldAlert } from "lucide-react";
import { Can } from "@/components/auth/can";
import { ProgramsTable, type ProgramRow } from "./programs-table";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";

export const dynamic = "force-dynamic";

type Filter = "all" | "approved" | "draft" | "review" | "retired";

export default async function TrainingProgramsPage(props: {
  searchParams: Promise<{ filter?: Filter; q?: string; category?: string }>;
}) {
  const searchParams = await props.searchParams;
  const filter = (searchParams.filter ?? "approved") as Filter;
  const q = (searchParams.q ?? "").trim();
  const categoryFilter = searchParams.category ?? "";

  const where: any = {};
  if (filter === "approved") where.approvalStatus = "APPROVED";
  else if (filter === "draft") where.approvalStatus = "DRAFT";
  else if (filter === "review") where.approvalStatus = "UNDER_REVIEW";
  else if (filter === "retired") where.approvalStatus = "RETIRED";
  if (categoryFilter) where.category = categoryFilter;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { programName: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { programCode: { contains: q, mode: "insensitive" } }
    ];
  }

  const [programs, counts, statutoryCount] = await Promise.all([
    prisma.trainingProgram.findMany({
      where,
      orderBy: [{ isStatutory: "desc" }, { name: "asc" }]
    }),
    prisma.trainingProgram.groupBy({ by: ["approvalStatus"], _count: true }),
    prisma.trainingProgram.count({ where: { isStatutory: true, approvalStatus: "APPROVED" } })
  ]);
  const cnt = (s: string) => counts.find((c) => c.approvalStatus === s)?._count ?? 0;

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

