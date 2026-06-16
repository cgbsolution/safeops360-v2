import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Can } from "@/components/auth/can";
import { requirePermission } from "@/lib/auth/server";
import { ChecklistsTable, type ChecklistRow } from "./checklists-table";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";

export const dynamic = "force-dynamic";

export default async function ChecklistTemplatesPage(props: {
  searchParams: Promise<{ filter?: string; type?: string }>;
}) {
  await requirePermission("CHECKLIST_TEMPLATE.READ");
  const sp = await props.searchParams;
  const filter = sp.filter ?? "approved";

  const where: any = {};
  if (filter === "approved") where.approvalStatus = "APPROVED";
  else if (filter === "draft") where.approvalStatus = "DRAFT";
  else if (filter === "review") where.approvalStatus = "UNDER_REVIEW";
  else if (filter === "retired") where.approvalStatus = "RETIRED";
  if (sp.type) where.inspectionTypeId = sp.type;

  const [templates, counts] = await Promise.all([
    prisma.checklistTemplate.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        version: true,
        inspectionTypeId: true,
        approvalStatus: true,
        inspectionType: { select: { code: true, name: true, isStatutory: true } },
        _count: { select: { items: true, inspections: true } }
      }
    }),
    prisma.checklistTemplate.groupBy({ by: ["approvalStatus"], _count: true })
  ]);
  const cnt = (s: string) => counts.find((c) => c.approvalStatus === s)?._count ?? 0;

  const rows: ChecklistRow[] = templates.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    description: t.description ?? null,
    inspectionTypeId: t.inspectionTypeId,
    inspectionTypeName: t.inspectionType.name,
    inspectionTypeIsStatutory: t.inspectionType.isStatutory,
    version: t.version,
    itemsCount: t._count.items,
    inspectionsCount: t._count.inspections,
    approvalStatus: t.approvalStatus
  }));

  return (
    <div>
      <PageHeader
        title="Checklist Templates"
        description="Versioned, approval-gated inspection checklists. Items support typed responses (Pass/Fail, numeric thresholds, photo capture, signatures)."
        breadcrumbs={[{ label: "Inspections", href: "/inspections" }, { label: "Checklists" }]}
        action={
          <Can permission="CHECKLIST_TEMPLATE.CREATE">
            <Button asChild>
              <Link href="/inspections/checklists/new">
                <Plus size={16} /> New template
              </Link>
            </Button>
          </Can>
        }
      />

      <FilterTabsList label="Status" className="mb-4">
        <FilterTab href="/inspections/checklists?filter=approved" active={filter === "approved"} label="Approved" count={cnt("APPROVED")} tone="emerald" />
        <FilterTab href="/inspections/checklists?filter=review" active={filter === "review"} label="Under Review" count={cnt("UNDER_REVIEW")} tone="amber" />
        <FilterTab href="/inspections/checklists?filter=draft" active={filter === "draft"} label="Draft" count={cnt("DRAFT")} tone="slate" />
        <FilterTab href="/inspections/checklists?filter=retired" active={filter === "retired"} label="Retired" count={cnt("RETIRED")} tone="slate" />
        <FilterTab href="/inspections/checklists?filter=all" active={filter === "all"} label="All" count={cnt("DRAFT") + cnt("UNDER_REVIEW") + cnt("APPROVED") + cnt("RETIRED")} />
      </FilterTabsList>

      <ChecklistsTable data={rows} />
    </div>
  );
}

