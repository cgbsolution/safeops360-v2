import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { CertificationsRegisterView } from "./certifications-register-view";
import type { CertificationRegisterResponse } from "../lib";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function CertificationsRegisterPage() {
  await requirePermission("FACILITY.READ");

  let data: CertificationRegisterResponse | null = null;
  let error: string | null = null;
  try {
    // Fetch the full (tenant-scoped) register; state / cert-type / expiry-band
    // filters are applied client-side so the export and deep-links mirror the
    // on-screen view. Rows already arrive sorted by days-to-expiry ascending.
    data = await backendFetch<CertificationRegisterResponse>("/api/factory/certifications/register");
  } catch (e: any) {
    error = e?.message ?? "Failed to load the certifications register";
  }

  return (
    <div>
      <PageHeader
        title="Certifications Register"
        breadcrumbs={[{ label: "Facilities", href: "/facilities" }, { label: "Certifications" }]}
        description="Every facility certification across the group — ISO 9001 / 14001 / 45001, SA8000, WRAP, BSCI, OEKO-TEX, SMETA and more — with real-time expiry status, days-to-expiry and the renewals coming due."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <CertificationsRegisterView data={data!} />
      )}
    </div>
  );
}
