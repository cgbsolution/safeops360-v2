import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KriAdminView } from "./admin-view";
import type { KriListResponse, MetricCatalogEntry } from "@/app/(dashboard)/erm/lib-p2";
import type { RiskListResponse } from "@/app/(dashboard)/erm/lib";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

type CategoryLite = { id: string; code: string; name: string };
type RiskLite = { id: string; riskCode: string; title: string };

export default async function KriAdminPage() {
  let kris: KriListResponse = { items: [], total: 0, statusCounts: {}, breachesOpen: 0 };
  let catalogue: MetricCatalogEntry[] = [];
  let categories: CategoryLite[] = [];
  let risks: RiskLite[] = [];
  let error: string | null = null;

  try {
    const [kriRes, catRes, catalogueRes, riskRes] = await Promise.all([
      backendFetch<KriListResponse>("/api/erm/kris"),
      backendFetch<CategoryLite[]>("/api/erm/categories"),
      backendFetch<MetricCatalogEntry[]>("/api/erm/metric-catalogue"),
      backendFetch<RiskListResponse>("/api/erm/risks"),
    ]);
    kris = kriRes;
    categories = (catRes as any[]).map((c) => ({ id: c.id, code: c.code, name: c.name }));
    catalogue = catalogueRes;
    risks = (riskRes.items ?? []).map((r) => ({ id: r.id, riskCode: r.riskCode, title: r.title }));
  } catch (e: any) {
    error = e?.message ?? "Failed to load KRI admin data";
  }

  return (
    <div>
      <PageHeader
        title="KRI Administration"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "KRIs", href: "/erm/kris" },
          { label: "Admin" },
        ]}
        description="Define and maintain Key Risk Indicators — thresholds, direction, feed source and linked enterprise risks."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}.</Alert>
      ) : (
        <KriAdminView kris={kris.items} categories={categories} catalogue={catalogue} risks={risks} />
      )}
    </div>
  );
}
