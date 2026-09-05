import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { ScoringConfig, VendorDetail } from "@/app/(dashboard)/erm/lib-t3";
import { VendorProfileView } from "./vendor-profile-view";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function VendorDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  let vendor: VendorDetail | null = null;
  let scoringConfig: ScoringConfig[] = [];
  let error: string | null = null;
  try {
    vendor = await backendFetch<VendorDetail>(`/api/erm/vendors/${id}`);
    scoringConfig = await backendFetch<ScoringConfig[]>("/api/erm/vendors/scoring-config").catch(() => []);
  } catch (e: any) {
    error = e?.message ?? "Failed to load vendor";
  }

  if (error || !vendor) {
    return (
      <div>
        <PageHeader
          title="Vendor"
          breadcrumbs={[
            { label: "Enterprise Risk", href: "/erm" },
            { label: "Vendor Risk", href: "/erm/vendors" },
            { label: "Register", href: "/erm/vendors/register" },
          ]}
        />
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Vendor not found"}. Ensure the ERM Tier 3 seed has been run, and you are logged in with a vendor role.{" "}
          <Link href="/erm/vendors/register" className="underline">
            Back to register
          </Link>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={vendor.legalName}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Vendor Risk", href: "/erm/vendors" },
          { label: "Register", href: "/erm/vendors/register" },
          { label: vendor.vendorCode },
        ]}
        description={`${vendor.category} · ${vendor.vendorCode}`}
      />
      <VendorProfileView vendor={vendor} scoringConfig={scoringConfig} />
    </div>
  );
}
