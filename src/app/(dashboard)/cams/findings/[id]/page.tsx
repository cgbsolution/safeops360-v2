import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import type { Finding } from "../../lib-cams";
import { FindingDetailView } from "./finding-actions";

export const dynamic = "force-dynamic";

export default async function FindingDetailPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("CAMS.READ");
  const { id } = await props.params;
  let finding: Finding;
  try {
    finding = await backendFetch<Finding>(`/api/cams/findings/${id}`);
  } catch {
    notFound();
  }
  const session = await getServerSession(authOptions);
  const uid = (session?.user as any)?.id as string | undefined;
  const canManage = uid ? (await can(uid, "CAMS.FINDING_MANAGE")).allowed : false;

  return (
    <div>
      <PageHeader
        title={`${finding.findingCode}`}
        description={finding.title}
        breadcrumbs={[
          { label: "CAMS", href: "/cams" },
          { label: "Findings", href: "/cams/findings" },
          { label: finding.findingCode },
        ]}
      />
      <FindingDetailView finding={finding} canManage={canManage} />
    </div>
  );
}
