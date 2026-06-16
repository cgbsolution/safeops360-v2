import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { Can } from "@/components/auth/can";
import { requirePermission } from "@/lib/auth/server";
import { InspectionTypesTable, type InspectionTypeRow } from "./types-table";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";

export const dynamic = "force-dynamic";

const CATEGORY_BADGE: Record<string, string> = {
  ROUTINE: "bg-slate-100 text-slate-700 border-slate-200",
  STATUTORY: "bg-rose-50 text-rose-700 border-rose-200",
  PRE_OPERATIONAL: "bg-blue-50 text-blue-700 border-blue-200",
  POST_INCIDENT: "bg-amber-50 text-amber-700 border-amber-200",
  CONDITION_BASED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  THIRD_PARTY: "bg-violet-50 text-violet-700 border-violet-200",
  FOCUSED: "bg-orange-50 text-orange-700 border-orange-200"
};

export default async function InspectionTypesPage(props: {
  searchParams: Promise<{ filter?: string; category?: string }>;
}) {
  await requirePermission("INSPECTION_TYPE.READ");
  const sp = await props.searchParams;
  const filter = sp.filter ?? "active";
  const category = sp.category ?? "";

  const where: any = {};
  if (filter === "active") where.isActive = true;
  else if (filter === "inactive") where.isActive = false;
  if (category) where.category = category;

  const [types, counts] = await Promise.all([
    prisma.inspectionType.findMany({
      where,
      orderBy: [{ isStatutory: "desc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        isStatutory: true,
        statutoryReference: true,
        requiresCertifiedInspector: true,
        category: true,
        defaultFrequency: true,
        statutoryFormType: true,
        defaultChecklistTemplate: { select: { id: true, name: true, version: true } },
        _count: { select: { checklistTemplates: true, equipmentLinks: true, inspections: true } }
      }
    }),
    prisma.inspectionType.groupBy({ by: ["category"], _count: true })
  ]);

  const rows: InspectionTypeRow[] = types.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    isStatutory: t.isStatutory,
    statutoryReference: t.statutoryReference ?? null,
    requiresCertifiedInspector: t.requiresCertifiedInspector,
    category: t.category,
    defaultFrequency: t.defaultFrequency,
    defaultTemplateId: t.defaultChecklistTemplate?.id ?? null,
    defaultTemplateName: t.defaultChecklistTemplate?.name ?? null,
    defaultTemplateVersion: t.defaultChecklistTemplate?.version ?? null,
    draftTemplatesCount: t._count.checklistTemplates,
    equipmentLinksCount: t._count.equipmentLinks,
    inspectionsCount: t._count.inspections,
    statutoryFormType: t.statutoryFormType ?? null
  }));

  return (
    <div>
      <PageHeader
        title="Inspection Types"
        description="Master catalogue of inspection regimens — routine, statutory, pre-operational, condition-based, and post-incident."
        breadcrumbs={[{ label: "Inspections", href: "/inspections" }, { label: "Types" }]}
        action={
          <Can permission="INSPECTION_TYPE.CREATE">
            <Button asChild>
              <Link href="/inspections/types/new">
                <Plus size={16} /> New Type
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabsList label="Status">
          <FilterTab href="/inspections/types?filter=active" active={filter === "active"} label="Active" tone="emerald" />
          <FilterTab href="/inspections/types?filter=all" active={filter === "all"} label="All" />
          <FilterTab href="/inspections/types?filter=inactive" active={filter === "inactive"} label="Retired" tone="slate" />
        </FilterTabsList>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-600">
          {counts.map((c) => (
            <Badge key={c.category} className={CATEGORY_BADGE[c.category] ?? "bg-slate-100"}>
              {c.category}: {c._count}
            </Badge>
          ))}
        </div>
      </div>

      <InspectionTypesTable data={rows} />
    </div>
  );
}

