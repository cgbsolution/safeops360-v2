import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { SocialRegisterView } from "./social-register-view";
import type { SocialComplianceRegisterResponse } from "../lib";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function SocialComplianceRegisterPage() {
  await requirePermission("FACILITY.READ");

  let data: SocialComplianceRegisterResponse | null = null;
  let error: string | null = null;
  try {
    // Fetch the full (tenant-scoped) register; state filtering + the exception
    // lens are applied client-side so the export mirrors the on-screen view.
    data = await backendFetch<SocialComplianceRegisterResponse>("/api/factory/social-compliance/register");
  } catch (e: any) {
    error = e?.message ?? "Failed to load the social-compliance register";
  }

  return (
    <div>
      <PageHeader
        title="Workforce & Social-Compliance Register"
        breadcrumbs={[{ label: "Facilities", href: "/facilities" }, { label: "Workforce & SA8000" }]}
        description="Every worker across the estate in one register — employment split, gender, migrant, youngest-worker age, wages, working hours, freedom of association, grievance and SA8000 training — with the flags a buyer audit (SA8000 / WRAP / BSCI / SMETA) would raise."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <SocialRegisterView data={data!} />
      )}
    </div>
  );
}
