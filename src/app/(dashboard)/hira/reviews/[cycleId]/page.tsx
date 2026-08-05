import { notFound } from "next/navigation";
import Link from "next/link";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { AccessRestricted } from "@/components/access-restricted";
import { requirePermission } from "@/lib/auth/server";
import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

type Cycle = {
  id: string;
  entryId: string;
  scheduledFor: string;
  triggeredBy: string;
  status: string;
  assignedToId: string;
  triggerReferenceId: string | null;
};

type Entry = {
  id: string;
  studyId: string;
  sequenceNumber: number;
  activityDescription: string;
  hazards: {
    id: string;
    hazardId: string;
    contextualDescription: string | null;
  }[];
  existingControls: {
    id: string;
    hierarchy: string;
    description: string;
    effectiveness: string | null;
  }[];
};

type Study = { id: string; number: string; title: string };

export default async function HiraReviewCyclePage(
  props: { params: Promise<{ cycleId: string }> }
) {
  await requirePermission("HIRA.EXECUTE");
  const { cycleId } = await props.params;

  let cycle: Cycle;
  try {
    cycle = await backendFetch<Cycle>(`/api/hira/review-cycles/${cycleId}`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    if (e instanceof BackendError && e.status === 403)
      return <AccessRestricted backHref="/hira/reviews" backLabel="← Back to review cycles" />;
    throw e;
  }

  const entry = await backendFetch<Entry>(`/api/hira/entries/${cycle.entryId}`);
  const study = await backendFetch<Study>(`/api/hira/studies/${entry.studyId}`);

  // Fetch hazard library to resolve names (the entry payload returns hazardIds only)
  const hazardLib = await backendFetch<{ id: string; name: string; category: string }[]>(
    "/api/hira/hazards",
    { query: { limit: 200 } }
  );
  const hazardById = new Map(hazardLib.map((h) => [h.id, h]));

  return (
    <div>
      <PageHeader
        title={`Review — Entry #${entry.sequenceNumber}`}
        description={entry.activityDescription}
        breadcrumbs={[
          { label: "HIRA", href: "/hira" },
          { label: "Reviews", href: "/hira/reviews" },
          { label: `Cycle ${cycle.id.slice(0, 8)}` }
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ReviewForm
            cycle={{
              id: cycle.id,
              status: cycle.status,
              triggeredBy: cycle.triggeredBy,
              entry: { id: entry.id, study: { id: entry.studyId } }
            }}
          />
        </div>
        <div className="lg:col-span-1 space-y-4">
          <Card title="Review Context">
            <DefList
              items={[
                ["Trigger", cycle.triggeredBy.replace(/_/g, " ")],
                ["Scheduled for", new Date(cycle.scheduledFor).toLocaleDateString()],
                ["Status", cycle.status.replace(/_/g, " ")],
                ["Trigger reference", cycle.triggerReferenceId ?? "—"]
              ]}
            />
          </Card>

          <Card title="Current Hazards">
            {entry.hazards.length === 0 ? (
              <div className="text-xs text-slate-500">No hazards on file.</div>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {entry.hazards.map((h) => {
                  const lib = hazardById.get(h.hazardId);
                  return (
                    <li key={h.id}>
                      <div className="font-medium">{lib?.name ?? h.hazardId}</div>
                      <div className="text-xs text-slate-500">{lib?.category ?? "—"}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Current Controls">
            {entry.existingControls.length === 0 ? (
              <div className="text-xs text-slate-500">No controls on file.</div>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {entry.existingControls.map((c) => (
                  <li key={c.id}>
                    <div className="text-xs font-medium uppercase text-slate-500">{c.hierarchy}</div>
                    <div className="text-sm">{c.description}</div>
                    {c.effectiveness && (
                      <div className="text-xs text-slate-500">Effectiveness: {c.effectiveness.replace(/_/g, " ")}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Link
            href={`/hira/${entry.studyId}/entries/${entry.id}`}
            className="block text-center text-sm text-primary-700 hover:underline"
          >
            Open full entry detail →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white">
      <div className="px-4 py-2.5 border-b text-xs uppercase tracking-wider text-slate-600">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DefList({ items }: { items: [string, string | null | undefined][] }) {
  return (
    <dl className="grid grid-cols-1 gap-1.5 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="text-slate-500 text-xs">{k}</dt>
          <dd className="text-slate-800 text-right text-xs">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
