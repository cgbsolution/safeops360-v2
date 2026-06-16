import { redirect, notFound } from "next/navigation";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

// Canonicalising redirect for bare entry links.
//
// Several registers link to a HIRA entry with only its id — the Combined
// Risk Register, the Risk Aggregation Dashboard, and EAI entry cross-
// references all use `/hira/entries/{entryId}`. The actual entry page is
// nested under its study at `/hira/{studyId}/entries/{entryId}`, so those
// bare links 404. We resolve the entry's studyId here and forward to the
// canonical URL — one route fixes every caller.
export default async function HiraEntryRedirectPage(props: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await props.params;

  let studyId: string;
  try {
    const entry = await backendFetch<{ studyId: string }>(
      `/api/hira/entries/${entryId}`
    );
    studyId = entry.studyId;
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  // redirect() must live outside the try/catch — it signals via a thrown
  // NEXT_REDIRECT that the catch above would otherwise swallow.
  redirect(`/hira/${studyId}/entries/${entryId}`);
}
