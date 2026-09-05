import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { PlanDetail } from "@/app/(dashboard)/erm/lib-p3";
import { PlanDetailView } from "./plan-detail-view";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let d: PlanDetail | null = null;
  let error: string | null = null;
  try {
    d = await backendFetch<PlanDetail>(`/api/erm/bcm/plans/${id}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load plan";
  }

  if (error || !d) {
    return (
      <div>
        <PageHeader
          title="Continuity Plan"
          breadcrumbs={[
            { label: "Enterprise Risk", href: "/erm" },
            { label: "Business Continuity", href: "/erm/bcm" },
            { label: "Plans", href: "/erm/bcm/plans" },
            { label: "Not found" },
          ]}
        />
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Plan not found."}{" "}
          <Link href="/erm/bcm/plans" className="font-medium underline">Back to plans</Link>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${d.planCode} · ${d.title}`}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity", href: "/erm/bcm" },
          { label: "Plans", href: "/erm/bcm/plans" },
          { label: d.planCode },
        ]}
      />
      <PlanDetailView detail={d} />
    </div>
  );
}
