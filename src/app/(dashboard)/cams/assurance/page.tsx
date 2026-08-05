import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { AssuranceView } from "./assurance-view";
import type { IndependenceEventsResponse, RegisterResponse } from "../lib-assurance";

export const dynamic = "force-dynamic";

/**
 * Independence Register — impartiality evidence, ISO 19011 §5.4.2.
 *
 * A certification body asks for this as its own artefact, and it answers a
 * different question from the Audit Programme's coverage engine: "was the
 * auditor impartial", not "did we audit everything".
 *
 * It no longer defaults to the signed-in user. The old page resolved
 * `userId = requested || selfId` and rendered one person's two hats, which made
 * the screen a self-lookup — useless to the reader it exists for, who does not
 * know whose name to type. The register is computed for everyone, server-side,
 * and the person picker narrows it.
 */
export default async function AssurancePage() {
  let error: string | null = null;
  await requirePermission("CAMS.READ");

  const [register, events] = await Promise.all([
    backendFetch<RegisterResponse>("/api/assurance/independence/register").catch((e: any) => {
      error = e?.message ?? "Could not load the independence register";
      return null;
    }),
    // Degrades independently: the register is still worth showing if the
    // enforcement log's table has not been created yet.
    backendFetch<IndependenceEventsResponse>("/api/assurance/independence/events").catch(
      () => null,
    ),
  ]);

  return (
    <div>
      <PageHeader
        title="Independence Register"
        description="Who audits, who is audited, and every time the independence guard blocked, warned or was waived — ISO 19011 §5.4.2."
        breadcrumbs={[
          { label: "Audit & Compliance", href: "/cams/audits" },
          { label: "Independence Register" },
        ]}
      />
      <AssuranceView register={register} events={events} error={error} />
    </div>
  );
}
