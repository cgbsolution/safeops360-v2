import { notFound } from "next/navigation";
import Link from "next/link";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { AccessRestricted } from "@/components/access-restricted";
import { VersionDiff } from "./version-diff";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const TRIGGER_COLOR: Record<string, string> = {
  SCHEDULED_REVIEW: "bg-blue-100 text-blue-800 border-blue-200",
  INCIDENT_REVIEW: "bg-rose-100 text-rose-800 border-rose-200",
  MOC: "bg-indigo-100 text-indigo-800 border-indigo-200",
  CORRECTION: "bg-slate-100 text-slate-700 border-slate-200",
  AUDIT_FINDING: "bg-amber-100 text-amber-800 border-amber-200",
  INITIAL_APPROVAL: "bg-emerald-100 text-emerald-800 border-emerald-200"
};

type Version = {
  id: string;
  entryId: string;
  versionNumber: number;
  snapshot: Record<string, unknown>;
  changes: unknown[];
  changeReason: string;
  changeTrigger: string;
  createdAt: string;
  createdById: string;
};

type EntryOut = {
  id: string;
  sequenceNumber: number;
  activityDescription: string;
  versionNumber: number;
  studyId: string;
};

type StudyOut = { id: string; number: string; title: string };

export default async function HiraEntryHistoryPage(
  props: {
    params: Promise<{ id: string; entryId: string }>;
    searchParams: Promise<{ from?: string; to?: string }>;
  }
) {
  const { id: studyId, entryId } = await props.params;
  const { from, to } = await props.searchParams;

  let entry: EntryOut;
  let study: StudyOut;
  let versions: Version[];
  try {
    [entry, study, versions] = await Promise.all([
      backendFetch<EntryOut>(`/api/hira/entries/${entryId}`),
      backendFetch<StudyOut>(`/api/hira/studies/${studyId}`),
      backendFetch<Version[]>(`/api/hira/entries/${entryId}/versions`)
    ]);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    if (e instanceof BackendError && e.status === 403)
      return <AccessRestricted backHref="/hira" backLabel="← Back to HIRA register" />;
    throw e;
  }
  if (entry.studyId !== studyId) notFound();

  const fromVersion = from ? versions.find((v) => v.id === from) ?? null : null;
  const toVersion = to ? versions.find((v) => v.id === to) ?? null : null;

  return (
    <div>
      <PageHeader
        title={`Version History — Entry #${entry.sequenceNumber}`}
        description={`${study.number} — ${study.title}`}
        breadcrumbs={[
          { label: "HIRA", href: "/hira" },
          { label: study.number, href: `/hira/${studyId}` },
          { label: `Entry #${entry.sequenceNumber}`, href: `/hira/${studyId}/entries/${entryId}` },
          { label: "History" }
        ]}
      />

      {versions.length === 0 ? (
        <Card className="rounded-xl border bg-white p-8 text-center text-slate-500 shadow-none">
          No version history yet. Versions are created when an approved or active entry is edited.
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="rounded-xl border bg-white shadow-none">
              <div className="px-4 py-2.5 border-b text-xs uppercase tracking-wider text-slate-600">
                Versions ({versions.length})
              </div>
              <ul className="divide-y">
                {versions.map((v) => {
                  const isFrom = v.id === from;
                  const isTo = v.id === to;
                  return (
                    <li
                      key={v.id}
                      className={`px-4 py-3 ${
                        isFrom ? "bg-amber-50" : isTo ? "bg-emerald-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">v{v.versionNumber}</div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            TRIGGER_COLOR[v.changeTrigger] ??
                            "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {v.changeTrigger.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(v.createdAt).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-700 mt-1 line-clamp-2">
                        {v.changeReason}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Link
                          href={`/hira/${studyId}/entries/${entryId}/history?from=${v.id}${
                            to ? `&to=${to}` : ""
                          }`}
                          className={`text-[11px] px-2 py-0.5 rounded border ${
                            isFrom
                              ? "bg-amber-200 text-amber-900 border-amber-300"
                              : "bg-white hover:bg-amber-50 text-slate-700 border-slate-300"
                          }`}
                        >
                          Set as "before"
                        </Link>
                        <Link
                          href={`/hira/${studyId}/entries/${entryId}/history?${
                            from ? `from=${from}&` : ""
                          }to=${v.id}`}
                          className={`text-[11px] px-2 py-0.5 rounded border ${
                            isTo
                              ? "bg-emerald-200 text-emerald-900 border-emerald-300"
                              : "bg-white hover:bg-emerald-50 text-slate-700 border-slate-300"
                          }`}
                        >
                          Set as "after"
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {fromVersion && toVersion ? (
              <VersionDiff
                fromSnapshot={fromVersion.snapshot as Record<string, unknown>}
                toSnapshot={toVersion.snapshot as Record<string, unknown>}
                fromLabel={`v${fromVersion.versionNumber}`}
                toLabel={`v${toVersion.versionNumber}`}
              />
            ) : (
              <Card className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500 shadow-none">
                Select a "before" and "after" version on the left to see a field-by-field diff.
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
