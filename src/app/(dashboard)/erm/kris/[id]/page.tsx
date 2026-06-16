import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KriDetailView } from "./detail-view";
import type { KriDetail } from "@/app/(dashboard)/erm/lib-p2";

export const dynamic = "force-dynamic";

export default async function KriDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let kri: KriDetail | null = null;
  let error: string | null = null;
  try {
    kri = await backendFetch<KriDetail>(`/api/erm/kris/${id}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load KRI";
  }

  return (
    <div>
      <PageHeader
        title={kri ? kri.name : "KRI"}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "KRIs", href: "/erm/kris" },
          { label: kri?.kriCode ?? "Detail" },
        ]}
      />
      {error || !kri ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "KRI not found."}
        </div>
      ) : (
        <KriDetailView kri={kri} />
      )}
    </div>
  );
}
