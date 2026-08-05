import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { ProfileDetail } from "./profile-detail";
import type { FactoryProfileDetail } from "../lib";

export const dynamic = "force-dynamic";

export default async function FactoryProfilePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("FACILITY.READ");
  const { id } = await props.params;
  const sp = await props.searchParams;

  let profile: FactoryProfileDetail;
  try {
    profile = await backendFetch<FactoryProfileDetail>(`/api/factory/profiles/${id}`);
  } catch {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title={`${profile.factoryCode} — ${profile.factoryName}`}
        breadcrumbs={[{ label: "Facilities", href: "/facilities" }, { label: profile.factoryName }]}
      />
      <ProfileDetail profile={profile} initialTab={sp.tab} />
    </div>
  );
}
