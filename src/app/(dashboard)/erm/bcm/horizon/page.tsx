import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { HorizonItem } from "@/app/(dashboard)/erm/lib-p3";
import { HorizonBoard } from "./board-view";

export const dynamic = "force-dynamic";

export default async function HorizonWatchlistPage() {
  let items: HorizonItem[] = [];
  let error: string | null = null;
  try {
    items = await backendFetch<HorizonItem[]>("/api/erm/bcm/horizon");
  } catch (e: any) {
    error = e?.message ?? "Failed to load horizon watchlist";
  }

  return (
    <div>
      <PageHeader
        title="Horizon Watchlist"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity", href: "/erm/bcm" },
          { label: "Horizon" },
        ]}
        description="Scan for weak, emerging and strong signals on the horizon. Promote a maturing signal to a scenario or risk, or dismiss it — with a retained audit trail."
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Phase 3 (BCM) seed has been run and you are logged in with a BCM role.
        </div>
      ) : (
        <HorizonBoard items={items} />
      )}
    </div>
  );
}
