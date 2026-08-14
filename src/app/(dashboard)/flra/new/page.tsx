import { PageHeader } from "@/components/page-header";
import { FLRAForm } from "../flra-form";
import { HiraSuggestionsPanel } from "@/components/hira/hira-suggestions-panel";
import { PanelBoundary } from "@/components/ui/panel-boundary";
import { requirePermission } from "@/lib/auth/server";
import { getPlants } from "@/lib/masters/plants";
import { backendFetch } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

export default async function NewFLRAPage(props: { searchParams: Promise<{ permitId?: string }> }) {
  const searchParams = await props.searchParams;
  await requirePermission("FLRA.CREATE");

  // The permit lookup goes through the same endpoint the form's picker uses,
  // so a pre-selected permit and a picked one arrive in identical shape —
  // nested plant / receiver / workCrew / flras included. The backend enforces
  // that the caller is on the permit (receiver, originator, issuer or crew)
  // unless they hold a privileged role.
  const [plants, permitResult] = await Promise.all([
    getPlants(),
    searchParams.permitId
      ? backendFetch<{ items: any[] }>("/api/ptw/eligible-for-flra/list", {
          query: { permitId: searchParams.permitId },
        }).catch(() => ({ items: [] }))
      : Promise.resolve({ items: [] }),
  ]);
  const permit = permitResult.items[0] ?? null;

  return (
    <div>
      <PageHeader
        title="New FLRA"
        description="Step-by-step hazard identification at work location, before starting the task"
        breadcrumbs={[{ label: "FLRA", href: "/flra" }, { label: "New" }]}
      />
      <div className="grid grid-cols-1 xl:grid-cols-[1fr,360px] gap-6">
        <div className="max-w-4xl">
          <FLRAForm plants={plants.map((p) => ({ id: p.id, name: p.name }))} permit={permit} />
        </div>
        {/* HIRA suggestions sidebar — only when we know the plant/area (i.e. a permit is set).
            For standalone FLRAs the user picks plant in the form; we'd need to read the form
            state to show suggestions, which requires deeper integration with flra-form.tsx
            (deferred — the standalone path doesn't yet stream form state up). */}
        {permit ? (
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <PanelBoundary label="HIRA suggestions">
              <HiraSuggestionsPanel
                mode="flra"
                plantId={permit.plantId}
                areaId={permit.areaId}
                activityKeyword={permit.scopeOfWork?.slice(0, 50) ?? null}
              />
            </PanelBoundary>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
