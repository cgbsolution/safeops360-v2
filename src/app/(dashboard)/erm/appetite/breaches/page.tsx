import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { BreachesView } from "./breaches-view";
import type { AppetiteBreach } from "@/app/(dashboard)/erm/lib-p2";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function AppetiteBreachesPage() {
  let breaches: AppetiteBreach[] = [];
  let error: string | null = null;
  try {
    breaches = await backendFetch<AppetiteBreach[]>("/api/erm/appetite/breaches");
  } catch (e: any) {
    error = e?.message ?? "Failed to load appetite breaches";
  }

  return (
    <div>
      <PageHeader
        title="Appetite Breach Management"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Appetite", href: "/erm/appetite" },
          { label: "Breaches" },
        ]}
        description="Tolerance breaches awaiting a committee decision. The CRO can review, mandate treatment, temporarily accept, or resolve each breach."
      />
      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</Alert>
      ) : (
        <BreachesView breaches={breaches} />
      )}
    </div>
  );
}
