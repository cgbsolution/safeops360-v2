import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { PlantSwitcher } from "@/components/plant-switcher";
import { resolvePlantContext } from "@/lib/plant-context";
import { AnalyticsStripSkeleton } from "@/components/dashboard/analytics-strip";
import { PpeAnalyticsStrip } from "@/components/ppe/analytics-strip";
import { PpeTabs } from "./ppe-tabs";

export const dynamic = "force-dynamic";

// ─── Shared types (consumed by ppe-tabs.tsx + item detail page) ───
export type DashboardData = {
  cards: {
    itemsInService: number;
    inspectionOverdue: number;
    approachingServiceLife: number;
    complianceGaps: number;
    activeRecalls: number;
    underRepairQuarantine: number;
    overdueReturns: number;
  };
  compliance: { totalPeople: number; compliant: number; gaps: number; criticalGaps: number };
  totalItems: number;
};
export type Item = {
  id: string;
  itemNumber: string;
  serialNumber: string;
  ppeTypeCode: string;
  ppeTypeName: string;
  manufacturer: string;
  status: string;
  condition: string;
  currentHolderUserId: string | null;
  serviceLifeEndDate: string | null;
  serviceLifeRemainingDays: number;
  serviceLifeExceeded: boolean;
  nextInspectionDueDate: string | null;
  inspectionStatus: string;
  inspectionOverdueDays: number | null;
  storageLocation: string | null;
  validity: "pass" | "warn" | "block";
  validityReason: string;
};
export type Issuance = {
  id: string;
  issuanceNumber: string;
  ppeTypeName: string;
  serialNumber: string;
  issuedToName: string;
  issuedToDepartment: string;
  issuedByName: string;
  issuedAt: string | null;
  expectedReturnDate: string | null;
  purpose: string;
  status: string;
  overdueReturn: boolean;
  returnedAt: string | null;
};
export type DueRow = {
  id: string;
  itemNumber: string;
  ppeTypeName: string;
  serialNumber: string;
  currentHolderUserId: string | null;
  nextInspectionDueDate: string | null;
  daysUntilDue: number;
  overdueDays: number | null;
};
export type InspectionsDue = {
  counts: { overdue: number; this_week: number; this_month: number; upcoming: number };
  buckets: { overdue: DueRow[]; this_week: DueRow[]; this_month: DueRow[]; upcoming: DueRow[] };
};
export type ReqRow = {
  ppeTypeCode: string;
  ppeTypeName: string;
  requirementLevel: string;
  held: boolean;
  itemNumber?: string | null;
  serialNumber?: string | null;
  status: "pass" | "warn" | "block" | "recommended";
  reason: string;
};
export type Person = {
  userId: string;
  name: string;
  role: string;
  department: string;
  overall: "compliant" | "gaps" | "critical";
  requirements: ReqRow[];
};
export type PeopleCompliance = {
  summary: { totalPeople: number; compliant: number; gaps: number; criticalGaps: number };
  people: Person[];
};
// Issue-PPE recipient — every person at the plant, NOT just those with a
// requirement profile (People Compliance can be empty while issuing must work).
export type Recipient = {
  userId: string;
  name: string;
  role: string;
  department: string;
};
export type CatalogType = {
  id: string;
  code: string;
  name: string;
  category: string;
  subcategory: string;
  serviceLifeYears: number;
  tracksIndividualItems: boolean;
  requiresCompetencyToUse: string | null;
  enablesPermitTypes: string[];
  statutoryProvisionRequired: boolean;
  itemsInService: number;
  itemsOverdue: number;
};

const empty = <T,>(v: T) => () => v;

export default async function PpePage(props: { searchParams: Promise<{ plantId?: string; tab?: string }> }) {
  const sp = await props.searchParams;
  const { plantId, plants } = await resolvePlantContext(sp.plantId);

  if (!plantId) {
    return (
      <div>
        <PageHeader title="PPE Management" description="The authoritative record of personal protective equipment — issued, inspected, certified." />
        <div className="rounded-xl border bg-white p-8 text-sm text-slate-600">Select a plant to view PPE.</div>
      </div>
    );
  }

  const q = { query: { plantId } };
  const [dashboard, items, issuances, due, people, catalog, plantUsers] = await Promise.all([
    backendFetch<DashboardData>("/api/ppe/dashboard", q).catch(empty<DashboardData | null>(null)),
    backendFetch<{ items: Item[] }>("/api/ppe/items", q).catch(empty({ items: [] as Item[] })),
    backendFetch<{ issuances: Issuance[] }>("/api/ppe/issuances", q).catch(empty({ issuances: [] as Issuance[] })),
    backendFetch<InspectionsDue>("/api/ppe/inspections/due", q).catch(empty<InspectionsDue | null>(null)),
    backendFetch<PeopleCompliance>("/api/ppe/people-compliance", q).catch(empty<PeopleCompliance | null>(null)),
    backendFetch<{ types: CatalogType[] }>("/api/ppe/catalog", q).catch(empty({ types: [] as CatalogType[] })),
    prisma.user.findMany({
      where: { plantId },
      select: { id: true, name: true, role: true, department: true },
      orderBy: { name: "asc" },
    }).catch(empty([] as { id: string; name: string; role: string; department: string | null }[])),
  ]);
  const recipients: Recipient[] = plantUsers.map((u) => ({
    userId: u.id,
    name: u.name,
    role: u.role,
    department: u.department ?? "—",
  }));

  return (
    <div>
      <PageHeader
        title="PPE Management"
        breadcrumbs={[{ label: "Assets & Inspection" }, { label: "PPE Management" }]}
        description="Every harness, SCBA, and gas detector — who holds it, whether it is serviceable, and whether each person has the right PPE for the hazard."
        action={<PlantSwitcher plants={plants} currentPlantId={plantId} />}
      />
      <div className="mb-6">
        <Suspense fallback={<AnalyticsStripSkeleton />}>
          <PpeAnalyticsStrip plantId={plantId} />
        </Suspense>
      </div>
      <PpeTabs
        plantId={plantId}
        initialTab={sp.tab}
        dashboard={dashboard}
        items={items.items}
        issuances={issuances.issuances}
        due={due}
        people={people}
        catalog={catalog.types}
        recipients={recipients}
      />
    </div>
  );
}
