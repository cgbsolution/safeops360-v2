import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { EaiReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

type EaiReviewCycleOut = {
  id: string;
  entryId: string;
  scheduledFor: string;
  triggeredBy: string;
  status: string;
  assignedToId: string;
  outcome: string | null;
  outcomeNotes: string | null;
  changesMade: Record<string, unknown>[] | null;
  startedAt: string | null;
  completedAt: string | null;
  completedById: string | null;
  entryTitle: string | null;
  entrySequenceNumber: number | null;
  studyNumber: string | null;
  studyTitle: string | null;
};

export default async function EaiReviewCyclePage(
  props: { params: Promise<{ cycleId: string }> }
) {
  await requirePermission("EAI.READ");
  const { cycleId } = await props.params;

  let cycle: EaiReviewCycleOut;
  try {
    cycle = await backendFetch<EaiReviewCycleOut>(`/api/eai/review-cycles/${cycleId}`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <PageHeader
        title={`Review Cycle — ${cycle.entryTitle ?? (cycle.entrySequenceNumber != null ? `Entry #${cycle.entrySequenceNumber}` : `Entry ${cycle.entryId.slice(0, 8)}…`)}`}
        description={
          cycle.studyNumber && cycle.studyTitle
            ? `Study ${cycle.studyNumber} · ${cycle.studyTitle}`
            : cycle.studyNumber
            ? `Study ${cycle.studyNumber}`
            : cycle.studyTitle ?? "EAI Entry Review"
        }
        breadcrumbs={[
          { label: "EAI", href: "/eai" },
          { label: "EAI Reviews", href: "/eai/reviews" },
          {
            label: cycle.entryTitle ?? (cycle.entrySequenceNumber != null
              ? `Entry #${cycle.entrySequenceNumber}`
              : `Cycle ${cycle.id.slice(0, 8)}`)
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EaiReviewForm
            cycle={{
              id: cycle.id,
              entryId: cycle.entryId,
              status: cycle.status,
              triggeredBy: cycle.triggeredBy,
            }}
          />
        </div>

        <div className="lg:col-span-1 space-y-4">
          <Card title="Review Context">
            <DefList
              items={[
                ["Trigger", cycle.triggeredBy.replace(/_/g, " ")],
                ["Status", cycle.status.replace(/_/g, " ")],
                ["Scheduled", new Date(cycle.scheduledFor).toLocaleDateString()],
                ["Entry", cycle.entryTitle ?? "—"],
                ["Study", cycle.studyNumber ?? "—"],
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-white">
      <div className="px-4 py-2.5 border-b text-xs uppercase tracking-wider text-slate-600">
        {title}
      </div>
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
