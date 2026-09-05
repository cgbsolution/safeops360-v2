import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Wrench, AlertTriangle, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/server";
import { Can } from "@/components/auth/can";
import { EquipmentTable, type EquipmentRow } from "./equipment-table";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";

export const dynamic = "force-dynamic";

export default async function EquipmentMasterPage(props: {
  searchParams: Promise<{ q?: string; plant?: string; criticality?: string; due?: string }>;
}) {
  await requirePermission("EQUIPMENT_MASTER.READ");
  const sp = await props.searchParams;
  const where: any = { active: true };
  if (sp.q) {
    where.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { code: { contains: sp.q, mode: "insensitive" } },
      { serialNumber: { contains: sp.q, mode: "insensitive" } }
    ];
  }
  if (sp.plant) where.plantId = sp.plant;
  if (sp.criticality) where.criticality = sp.criticality;
  if (sp.due === "overdue") where.nextInspectionDue = { lt: new Date() };
  if (sp.due === "soon") {
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    where.nextInspectionDue = { gte: new Date(), lt: soon };
  }

  const soonCutoff = new Date();
  soonCutoff.setDate(soonCutoff.getDate() + 7);

  const [equipment, plants, overdueCount, soonCount] = await Promise.all([
    prisma.equipment.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        make: true,
        modelNumber: true,
        category: true,
        criticality: true,
        nextInspectionDue: true,
        plant: { select: { name: true, code: true } },
        inspectionTypes: {
          where: { isActive: true },
          select: { id: true, inspectionType: { select: { name: true, isStatutory: true } } }
        }
      },
      orderBy: [{ criticality: "asc" }, { name: "asc" }],
      take: 200
    }),
    prisma.plant.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.equipment.count({ where: { active: true, nextInspectionDue: { lt: new Date() } } }),
    prisma.equipment.count({ where: { active: true, nextInspectionDue: { gte: new Date(), lt: soonCutoff } } })
  ]);

  const now = new Date();
  const rows: EquipmentRow[] = equipment.map((eq) => ({
    id: eq.id,
    code: eq.code,
    name: eq.name,
    make: eq.make ?? null,
    modelNumber: eq.modelNumber ?? null,
    hasStatutory: eq.inspectionTypes.some((l) => l.inspectionType.isStatutory),
    plantCode: eq.plant.code,
    category: eq.category,
    criticality: eq.criticality ?? null,
    inspectionTypes: eq.inspectionTypes.map((l) => ({
      id: l.id,
      name: l.inspectionType.name,
      isStatutory: l.inspectionType.isStatutory
    })),
    nextInspectionDue: eq.nextInspectionDue ? eq.nextInspectionDue.toISOString() : null,
    isOverdue: !!(eq.nextInspectionDue && eq.nextInspectionDue < now)
  }));

  return (
    <div>
      <PageHeader
        title="Equipment Master"
        description="Cement plant equipment registry. Each item carries criticality, statutory tags, and one or more inspection regimens."
        breadcrumbs={[{ label: "Inspections", href: "/inspections" }, { label: "Equipment" }]}
        action={
          <Can permission="EQUIPMENT_MASTER.CREATE">
            <Button asChild>
              <Link href="/inspections/equipment/new">
                <Plus size={16} /> Add Equipment
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard tone="rose" icon={<AlertTriangle size={18} />} label="Overdue" value={overdueCount} href="/inspections/equipment?due=overdue" />
        <SummaryCard tone="amber" icon={<Wrench size={18} />} label="Due in 7 days" value={soonCount} href="/inspections/equipment?due=soon" />
        <SummaryCard tone="emerald" icon={<Wrench size={18} />} label="Total active" value={equipment.length} href="/inspections/equipment" />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <form className="flex gap-2" action="/inspections/equipment">
          <Input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search by name, code, serial…"
            className="w-64 rounded-md border border-slate-200 px-3 py-2 text-sm" />
          <SelectField name="plant" defaultValue={sp.plant ?? ""} className="rounded-md border border-slate-200 px-2 py-2 text-sm"
            placeholder="All plants"
            options={plants.map((p) => ({ value: String(p.id), label: `${p.name}` }))}
          />
          <SelectField name="criticality" defaultValue={sp.criticality ?? ""} className="rounded-md border border-slate-200 px-2 py-2 text-sm"
            placeholder="Any criticality"
            options={[
            { value: "A", label: "A — Critical" },
            { value: "B", label: "B — High" },
            { value: "C", label: "C — Medium" },
            { value: "D", label: "D — Low" }
          ]}
          />
          <Button type="submit" variant="ghost">Filter</Button>
        </form>
      </div>

      <EquipmentTable data={rows} />
    </div>
  );
}

function SummaryCard({
  tone,
  icon,
  label,
  value,
  href
}: {
  tone: "rose" | "amber" | "emerald";
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
}) {
  const toneClasses: Record<string, string> = {
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900"
  };
  return (
    <Link href={href} className={["block rounded-md border p-4", toneClasses[tone]].join(" ")}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </Link>
  );
}
