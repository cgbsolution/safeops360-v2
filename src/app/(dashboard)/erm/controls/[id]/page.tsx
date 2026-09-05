import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type { ControlDetail } from "@/app/(dashboard)/erm/lib-t3";
import { ControlDetailView } from "./control-detail-view";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function ControlDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let d: ControlDetail | null = null;
  let error: string | null = null;
  try {
    d = await backendFetch<ControlDetail>(`/api/erm/controls/${id}`);
  } catch (e: any) {
    error = e?.message ?? "Failed to load control";
  }

  if (error || !d) {
    return (
      <div>
        <PageHeader
          title="Control"
          breadcrumbs={[
            { label: "Enterprise Risk", href: "/erm" },
            { label: "Internal Controls", href: "/erm/controls" },
            { label: "Library", href: "/erm/controls/library" },
            { label: "Not found" },
          ]}
        />
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "Control not found."}. Ensure the ERM Tier 3 seed has been run and you are logged in with a controls role.{" "}
          <Link href="/erm/controls/library" className="font-medium underline">Back to library</Link>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${d.controlCode} · ${d.name}`}
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Internal Controls", href: "/erm/controls" },
          { label: "Library", href: "/erm/controls/library" },
          { label: d.controlCode },
        ]}
      />
      <ControlDetailView detail={d} />
    </div>
  );
}
