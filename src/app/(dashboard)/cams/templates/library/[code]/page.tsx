import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { LibraryEditor, type LibraryDetail } from "./library-editor";

export const dynamic = "force-dynamic";

/**
 * The checkpoint library as an EDITABLE template.
 *
 * The library arrived through bulk JSON import, which is the right tool for
 * authoring 120 checkpoints in one go and the wrong one for changing the
 * wording of question 37 — re-pasting the whole document to fix one line
 * silently discards every other edit made since the copy was taken.
 */
export default async function LibraryEditorPage(props: {
  params: Promise<{ code: string }>;
}) {
  await requirePermission("CAMS.READ");
  const { code } = await props.params;

  let library: LibraryDetail;
  try {
    library = await backendFetch<LibraryDetail>(
      `/api/audit-compliance/library/${encodeURIComponent(code)}`,
    );
  } catch {
    notFound();
  }

  const total = (library.categories ?? []).reduce(
    (s, c) => s + (c.checkpoints?.length ?? 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title={library.industryName}
        description={`${total} checkpoints across ${library.categories?.length ?? 0} disciplines · v${library.version}. Edits apply to the NEXT audit scheduled — audits already created keep the checkpoints they were materialised with.`}
        breadcrumbs={[
          { label: "CAMS", href: "/cams" },
          { label: "Templates", href: "/cams/templates" },
          { label: library.industryName },
        ]}
      />
      <LibraryEditor library={library} />
    </div>
  );
}
