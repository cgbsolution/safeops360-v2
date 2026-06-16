import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { ManualCapaForm } from "./manual-capa-form";

export const dynamic = "force-dynamic";

export default async function NewManualCapaPage() {
  await requirePermission("CAPA.CREATE");

  const [sourceTypes, subCategories] = await Promise.all([
    backendFetch<{ id: string; code: string; name: string; categoryId: string }[]>(
      "/api/capa/source-types"
    ),
    backendFetch<{ id: string; code: string; name: string; description: string | null }[]>(
      "/api/capa/sub-categories"
    )
  ]);

  // For owner picker, we re-use the HIRA wizard's user list. In a real
  // refactor we'd add a generic /api/users endpoint; for now we accept the
  // small overlap and source the same shape.
  const { plants } = await backendFetch<{
    plants: { id: string; code: string; name: string }[];
    users: { id: string; name: string; email: string; plantId: string | null }[];
  }>("/api/hira/wizard/study-options").catch(() => ({ plants: [], users: [] }));

  const users = await backendFetch<{
    plants: { id: string; code: string; name: string }[];
    users: { id: string; name: string; email: string; plantId: string | null }[];
  }>("/api/hira/wizard/study-options").catch(() => ({ plants: [], users: [] }));

  return (
    <div>
      <PageHeader
        title="New CAPA — Manual"
        description="Create a CAPA without a specific source module reference. Use this when raising a CAPA from a meeting decision, ad-hoc observation, or other context not yet captured as a source record."
        breadcrumbs={[{ label: "CAPA", href: "/capa" }, { label: "New" }, { label: "Manual" }]}
      />
      <ManualCapaForm
        sourceTypes={sourceTypes}
        subCategories={subCategories}
        plants={plants}
        users={users.users}
      />
    </div>
  );
}
