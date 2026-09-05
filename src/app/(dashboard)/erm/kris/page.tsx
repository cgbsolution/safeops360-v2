import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KriDashboardView } from "./dashboard-view";
import type { KriListResponse } from "@/app/(dashboard)/erm/lib-p2";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

const fallback: KriListResponse = {
  items: [],
  total: 0,
  statusCounts: {},
  breachesOpen: 0,
};

export default async function KriDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const filters = {
    category: get("category"),
    status: get("status"),
    feedType: get("feedType"),
    owner: get("owner"),
  };

  let data = fallback;
  let error: string | null = null;
  try {
    data = await backendFetch<KriListResponse>("/api/erm/kris", {
      query: {
        category: filters.category,
        status: filters.status,
        feedType: filters.feedType,
        owner: filters.owner,
      },
    });
  } catch (e: any) {
    error = e?.message ?? "Failed to load KRIs";
  }

  return (
    <div>
      <PageHeader
        title="Key Risk Indicators"
        breadcrumbs={[{ label: "Enterprise Risk", href: "/erm" }, { label: "KRIs" }]}
        description="Leading-indicator dashboard — early-warning signals across the enterprise risk landscape, grouped by category and traffic-lit against thresholds."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Phase 2 seed has been run and you are logged in with an ERM role.
        </Alert>
      ) : (
        <KriDashboardView data={data} filters={filters} />
      )}
    </div>
  );
}
