import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { PolicyDetail } from "@/app/(dashboard)/erm/lib-t3";
import { PolicyDetailView } from "./policy-detail-view";

export const dynamic = "force-dynamic";

export default async function PolicyDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let d: PolicyDetail | null = null;
  let error: string | null = null;
  try {
    d = await backendFetch<PolicyDetail>(`/api/erm/insurance/policies/${id}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load policy";
  }

  if (error || !d) {
    return (
      <div>
        <PageHeader
          title="Insurance Policy"
          breadcrumbs={[
            { label: "Enterprise Risk", href: "/erm" },
            { label: "Insurance & Transfer", href: "/erm/insurance" },
            { label: "Policies", href: "/erm/insurance/policies" },
            { label: "Not found" },
          ]}
        />
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Policy not found."} Ensure the ERM Tier 3 seed has been run, and you are logged in with an insurance role.{" "}
          <Link href="/erm/insurance/policies" className="font-medium underline">Back to policies</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${d.policyCode} · ${d.policyName}`}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Insurance & Transfer", href: "/erm/insurance" },
          { label: "Policies", href: "/erm/insurance/policies" },
          { label: d.policyCode },
        ]}
      />
      <PolicyDetailView detail={d} />
    </div>
  );
}
