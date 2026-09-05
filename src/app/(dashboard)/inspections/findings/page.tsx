import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { AlertTriangle } from "lucide-react";
import { requirePermission } from "@/lib/auth/server";
import { FindingsTable, type FindingRow } from "./findings-table";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function FindingsPage(props: {
  searchParams: Promise<{ status?: string; severity?: string; mine?: string }>;
}) {
  await requirePermission("INSPECTION_FINDING.READ");
  const sp = await props.searchParams;

  const where: any = {};
  if (sp.status) where.status = sp.status;
  if (sp.severity) where.severity = sp.severity;

  const [findings, counts] = await Promise.all([
    prisma.inspectionFinding.findMany({
      where,
      select: {
        id: true,
        findingNumber: true,
        title: true,
        isCritical: true,
        inspectionId: true,
        severity: true,
        dueDate: true,
        status: true,
        inspection: { select: { number: true, plantId: true, plant: { select: { code: true } } } },
        owner: { select: { name: true } },
        _count: { select: { capas: true } }
      },
      orderBy: [{ severity: "desc" }, { dueDate: "asc" }],
      take: 200
    }),
    prisma.inspectionFinding.groupBy({ by: ["status"], _count: true })
  ]);
  const cnt = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  const now = new Date();
  const isClosedStatus = (s: string) => ["CLOSED", "VERIFIED", "DUPLICATE"].includes(s);
  const overdue = findings.filter((f) => f.dueDate && f.dueDate < now && !isClosedStatus(f.status));

  const rows: FindingRow[] = findings.map((f) => ({
    id: f.id,
    findingNumber: f.findingNumber,
    title: f.title,
    isCritical: f.isCritical,
    inspectionId: f.inspectionId,
    inspectionNumber: f.inspection.number ?? "—",
    severity: f.severity,
    plantCode: f.inspection.plant.code,
    ownerName: f.owner?.name ?? null,
    dueDate: f.dueDate ? f.dueDate.toISOString() : null,
    isOverdue: !!(f.dueDate && f.dueDate < now && !isClosedStatus(f.status)),
    capasCount: f._count.capas,
    status: f.status
  }));

  return (
    <div>
      <PageHeader
        title="Inspection Findings"
        description="All open and recently closed findings spawned from inspection results. Use status / severity to filter."
        breadcrumbs={[{ label: "Inspections", href: "/inspections" }, { label: "Findings" }]}
      />

      <FilterTabsList label="Status" className="mb-4">
        <FilterTab href="/inspections/findings" active={!sp.status} label="All" count={findings.length} />
        <FilterTab href="/inspections/findings?status=OPEN" active={sp.status === "OPEN"} label="Open" count={cnt("OPEN")} tone="rose" />
        <FilterTab href="/inspections/findings?status=IN_PROGRESS" active={sp.status === "IN_PROGRESS"} label="In Progress" count={cnt("IN_PROGRESS")} tone="blue" />
        <FilterTab href="/inspections/findings?status=DEFERRED" active={sp.status === "DEFERRED"} label="Deferred" count={cnt("DEFERRED")} tone="slate" />
        <FilterTab href="/inspections/findings?status=CLOSED" active={sp.status === "CLOSED"} label="Closed" count={cnt("CLOSED")} tone="emerald" />
      </FilterTabsList>

      {overdue.length > 0 && (
        <Alert variant="destructive" className="mb-3 flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm">
          <AlertTriangle size={16} className="text-rose-600" />
          <strong>{overdue.length}</strong> finding{overdue.length === 1 ? "" : "s"} overdue. Action owners should respond today.
        </Alert>
      )}

      <FindingsTable data={rows} />
    </div>
  );
}

