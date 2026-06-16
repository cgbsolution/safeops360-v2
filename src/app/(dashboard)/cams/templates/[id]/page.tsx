import { notFound } from "next/navigation";
import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import type { TemplateDetail, ClauseRef } from "../../lib-cams";
import { TemplateBuilder } from "./template-builder";

export const dynamic = "force-dynamic";

export default async function TemplateBuilderPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("CAMS.READ");
  const { id } = await props.params;

  let template: TemplateDetail;
  try {
    template = await backendFetch<TemplateDetail>(`/api/cams/templates/${id}`);
  } catch {
    notFound();
  }
  const clauses = await backendFetch<ClauseRef[]>("/api/cams/clause-catalogue").catch(() => [] as ClauseRef[]);

  const session = await getServerSession(authOptions);
  const uid = (session?.user as any)?.id as string | undefined;
  const perms = {
    author: uid ? (await can(uid, "CAMS.TEMPLATE_AUTHOR")).allowed : false,
    approve: uid ? (await can(uid, "CAMS.TEMPLATE_APPROVE")).allowed : false,
  };

  return (
    <div>
      <PageHeader
        title={`${template.templateCode} · ${template.name}`}
        description={`Version ${template.version} — ${template.status}`}
        breadcrumbs={[{ label: "CAMS", href: "/cams" }, { label: "Templates", href: "/cams/templates" }, { label: template.templateCode }]}
        action={template.parentTemplateId ? <Link href={`/cams/templates/${template.parentTemplateId}`} className="text-xs text-primary-700 hover:underline">← previous version</Link> : undefined}
      />
      <TemplateBuilder template={template} clauses={clauses} perms={perms} />
    </div>
  );
}
