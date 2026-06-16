import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { CrisisWorkspace } from "./workspace";
import type { CrisisDetail } from "@/app/(dashboard)/erm/lib-p3";

export const dynamic = "force-dynamic";

export default async function CrisisWorkspacePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let crisis: CrisisDetail | null = null;
  let error: string | null = null;
  try {
    crisis = await backendFetch<CrisisDetail>(`/api/erm/bcm/crisis/${id}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load the crisis.";
  }

  if (error || !crisis) {
    // The server fetch failed (could be offline at the edge / backend down).
    // Render the client workspace with a null payload so it can fall back to
    // the localStorage-cached copy and show the offline banner.
    return (
      <div>
        <PageHeader
          title="Crisis workspace"
          breadcrumbs={[
            { label: "Enterprise Risk", href: "/erm" },
            { label: "Business Continuity", href: "/erm/bcm" },
            { label: "Crisis", href: "/erm/bcm/crisis" },
            { label: id },
          ]}
        />
        <CrisisWorkspace crisisId={id} initial={null} serverError={error ?? "Crisis not found"} />
        <p className="mt-3 text-center text-xs text-slate-400">
          If this crisis exists, a cached copy may be shown above. <Link href="/erm/bcm/crisis" className="underline">Back to crisis history</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={crisis.crisisCode}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "BCM", href: "/erm/bcm" },
          { label: "Crisis", href: "/erm/bcm/crisis" },
          { label: crisis.crisisCode },
        ]}
      />
      <CrisisWorkspace crisisId={id} initial={crisis} serverError={null} />
    </div>
  );
}
