import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { ProcessDetail } from "@/app/(dashboard)/erm/lib-p3";
import { ProcessDetailView } from "./process-detail-view";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function ProcessDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let d: ProcessDetail | null = null;
  let error: string | null = null;
  try {
    d = await backendFetch<ProcessDetail>(`/api/erm/bcm/processes/${id}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load process";
  }

  if (error || !d) {
    return (
      <div>
        <PageHeader
          title="Process"
          breadcrumbs={[
            { label: "Enterprise Risk", href: "/erm" },
            { label: "Business Continuity", href: "/erm/bcm" },
            { label: "Processes (BIA)", href: "/erm/bcm/processes" },
            { label: "Not found" },
          ]}
        />
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Process not found."}{" "}
          <Link href="/erm/bcm/processes" className="font-medium underline">Back to processes</Link>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${d.processCode} · ${d.name}`}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Business Continuity", href: "/erm/bcm" },
          { label: "Processes (BIA)", href: "/erm/bcm/processes" },
          { label: d.processCode },
        ]}
      />
      <ProcessDetailView detail={d} />
    </div>
  );
}
