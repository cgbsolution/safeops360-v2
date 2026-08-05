import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { FLRAForm } from "../flra-form";
import { HiraSuggestionsPanel } from "@/components/hira/hira-suggestions-panel";
import { PanelBoundary } from "@/components/ui/panel-boundary";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function NewFLRAPage(props: { searchParams: Promise<{ permitId?: string }> }) {
  const searchParams = await props.searchParams;
  await requirePermission("FLRA.CREATE");
  const plants = await prisma.plant.findMany({ orderBy: { name: "asc" } });
  const permit = searchParams.permitId
    ? await prisma.permit.findUnique({
        where: { id: searchParams.permitId },
        include: {
          plant: true,
          receiver: { select: { id: true, name: true } },
          workCrew: { select: { userId: true, user: { select: { id: true, name: true } } } },
          flras: { where: { status: { in: ["IN_PROGRESS", "COMPLETED"] } }, select: { id: true, status: true } }
        }
      })
    : null;

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
