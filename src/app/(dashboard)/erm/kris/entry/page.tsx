import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KriEntryGrid } from "./entry-grid";
import type { KriListResponse } from "@/app/(dashboard)/erm/lib-p2";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

const fallback: KriListResponse = { items: [], total: 0, statusCounts: {}, breachesOpen: 0 };

export default async function KriEntryPage() {
  let data = fallback;
  let error: string | null = null;
  try {
    data = await backendFetch<KriListResponse>("/api/erm/kris", { query: { feedType: "MANUAL" } });
  } catch (e: any) {
    error = e?.message ?? "Failed to load manual KRIs";
  }

  return (
    <div>
      <PageHeader
        title="KRI Data Entry"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "KRIs", href: "/erm/kris" },
          { label: "Data Entry" },
        ]}
        description="Monthly entry grid for manually-fed indicators. Type values across the last few periods; status previews update live against each KRI's thresholds."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}.</Alert>
      ) : (
        <KriEntryGrid items={data.items} />
      )}
    </div>
  );
}
