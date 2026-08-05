import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { ReportsView } from "./reports-view";
import type {
  BuildingRegisterResponse,
  CertificationRegisterResponse,
  FactoryProfileListResponse,
  SocialComplianceRegisterResponse,
} from "../lib";

export const dynamic = "force-dynamic";

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await backendFetch<T>(path);
  } catch {
    return fallback;
  }
}

export default async function FacilitiesReportsPage() {
  await requirePermission("FACILITY.EXPORT");

  let profiles: FactoryProfileListResponse | null = null;
  let error: string | null = null;
  try {
    profiles = await backendFetch<FactoryProfileListResponse>("/api/factory/profiles");
  } catch (e: any) {
    error = e?.message ?? "Failed to load facilities";
  }

  // The three register datasets power the new group exports + show live row
  // counts on each card. Fetched in parallel; a failure degrades that one card.
  const emptyRollup = {
    factoryCount: 0, totalWorkforce: 0, permanentCount: 0, contractCount: 0, apprenticeTraineeCount: 0,
    maleCount: 0, femaleCount: 0, otherGenderCount: 0, migrantWorkerCount: 0, differentlyAbledCount: 0,
    contractPct: 0, femalePct: 0, migrantPct: 0, flagCounts: {}, childLabourFlagCount: 0,
    overtimeFlagCount: 0, wageFlagCount: 0, foaFlagCount: 0,
  };
  const [social, buildings, certs] = await Promise.all([
    safe<SocialComplianceRegisterResponse>("/api/factory/social-compliance/register", { items: [], rollup: emptyRollup }),
    safe<BuildingRegisterResponse>("/api/factory/buildings/register", { items: [], buildingCount: 0, totalAreaSqm: 0 }),
    safe<CertificationRegisterResponse>("/api/factory/certifications/register", { items: [], certCount: 0, expiringWithin90Days: 0, expiredCount: 0 }),
  ]);

  return (
    <div>
      <PageHeader
        title="Facilities Reports"
        breadcrumbs={[{ label: "Facilities", href: "/facilities" }, { label: "Reports" }]}
        description="Canned exports of the factory estate — download as CSV (opens in Excel)."
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <ReportsView factories={profiles!.items} social={social} buildings={buildings} certs={certs} />
      )}
    </div>
  );
}
