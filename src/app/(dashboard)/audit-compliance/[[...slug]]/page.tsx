import { redirect } from "next/navigation";

// The Audit & Compliance lifecycle now lives under the CAMS module at
// /cams/audits. This optional catch-all redirects any legacy /audit-compliance
// deep link (e.g. older CAPA sourceReferenceUrls, bookmarks) to the new home.
export default async function AuditComplianceRedirect({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const rest = slug?.length ? `/${slug.join("/")}` : "";
  redirect(`/cams/audits${rest}`);
}
