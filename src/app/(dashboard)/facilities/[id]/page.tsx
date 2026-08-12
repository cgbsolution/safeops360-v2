import { notFound } from "next/navigation";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { AccessRestricted } from "@/components/access-restricted";
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
  } catch (e) {
    // Only a real "no such factory" is a 404. Swallowing every failure here
    // rendered backend 500s as "This page could not be found", which hid a
    // total outage of the profile page behind a plausible-looking 404.
    if (e instanceof BackendError && e.status === 404) notFound();
    if (e instanceof BackendError && e.status === 403)
      return <AccessRestricted backHref="/facilities" backLabel="← Back to facilities" />;
    throw e;
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
