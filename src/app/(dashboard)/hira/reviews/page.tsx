import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { FilterTab, FilterTabsList } from "@/components/ui/filter-tabs";
import { BulkReviewPanel } from "./bulk-review-panel";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { code: "SCHEDULED", label: "Scheduled" },
  { code: "IN_PROGRESS", label: "In Progress" },
  { code: "COMPLETED", label: "Completed" },
  { code: "SKIPPED", label: "Skipped" }
];

const TRIGGER_OPTIONS = [
  { code: "SCHEDULE", label: "Schedule" },
  { code: "INCIDENT", label: "Incident" },
  { code: "MOC", label: "MOC" },
  { code: "AUDIT_FINDING", label: "Audit finding" },
  { code: "MANUAL", label: "Manual" },
  { code: "REGULATORY_CHANGE", label: "Regulatory change" },
  { code: "NEAR_MISS", label: "Near miss" },
  { code: "OBSERVATION", label: "Observation" }
];

type Cycle = {
  id: string;
  entryId: string;
  scheduledFor: string;
  triggeredBy: string;
  status: string;
  assignedToId: string;
  outcome: string | null;
  entryTitle: string | null;
  entrySequenceNumber: number | null;
  studyNumber: string | null;
  studyTitle: string | null;
};

export default async function HiraReviewsPage(
  props: { searchParams: Promise<{ status?: string; trigger?: string }> }
) {
  await requirePermission("HIRA.READ");
  const searchParams = await props.searchParams;

  const cycles = await backendFetch<Cycle[]>("/api/hira/review-cycles", {
    query: {
      status: searchParams.status ?? null,
      trigger: searchParams.trigger ?? null
    }
  });

  const activeTrigger = searchParams.trigger;
  const activeStatus = searchParams.status;

  // Compute counts from the already-fetched cycles list (respects active trigger filter).
  // These are used for the filter tabs so the counts always match what is shown on screen.
  const filteredCountMap: Record<string, number> = {};
  STATUS_OPTIONS.forEach((s) => {
    filteredCountMap[s.code] = cycles.filter((c) => c.status === s.code).length;
  });

  return (
    <div>
      <PageHeader
        title="HIRA Review Cycles"
        description="Scheduled and triggered re-reviews of HIRA entries — by incident, MOC, audit, schedule, or manual request"
      />

      <FilterTabsList label="Status" className="mb-3">
        <FilterTab
          href={activeTrigger ? `/hira/reviews?trigger=${activeTrigger}` : "/hira/reviews"}
          label="Open"
          count={(filteredCountMap.SCHEDULED ?? 0) + (filteredCountMap.IN_PROGRESS ?? 0)}
          active={!activeStatus}
        />
        {STATUS_OPTIONS.map((s) => (
          <FilterTab
            key={s.code}
            href={`/hira/reviews?status=${s.code}${activeTrigger ? `&trigger=${activeTrigger}` : ""}`}
            label={s.label}
            count={filteredCountMap[s.code] ?? 0}
            active={activeStatus === s.code}
          />
        ))}
      </FilterTabsList>

      {/* Trigger type filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <span className="text-xs text-slate-500 self-center mr-1">Trigger:</span>
        <Link
          href={activeStatus ? `/hira/reviews?status=${activeStatus}` : "/hira/reviews"}
          className={`text-xs px-2.5 py-1 rounded-full border ${
            !activeTrigger
              ? "bg-slate-800 text-white border-slate-800"
              : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          All
        </Link>
        {TRIGGER_OPTIONS.map((t) => (
          <Link
            key={t.code}
            href={`/hira/reviews?trigger=${t.code}${activeStatus ? `&status=${activeStatus}` : ""}`}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              activeTrigger === t.code
                ? "bg-slate-800 text-white border-slate-800"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {cycles.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
          No review cycles match the current filter.
        </div>
      ) : (
        <BulkReviewPanel cycles={cycles} />
      )}
    </div>
  );
}
