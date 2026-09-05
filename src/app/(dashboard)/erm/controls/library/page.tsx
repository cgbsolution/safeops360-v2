import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import {
  RATING_CHIP,
  CONTROL_TYPE_LABEL,
  CONTROL_CATEGORY_LABEL,
  NATURE_LABEL,
  CONTROL_CATEGORIES,
  type ControlListResponse,
} from "@/app/(dashboard)/erm/lib-t3";
import { NewControlButton } from "./new-control-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const RATING_FILTERS = ["EFFECTIVE", "DEFICIENT", "NOT_ASSESSED"] as const;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function freqLabel(f: string) {
  return f.charAt(0) + f.slice(1).toLowerCase().replace(/_/g, " ");
}

function RatingChip({ rating }: { rating: string | null }) {
  const r = rating ?? "NOT_ASSESSED";
  return (
    <span className={"rounded border px-2 py-0.5 text-[11px] " + (RATING_CHIP[r] ?? RATING_CHIP.NOT_ASSESSED)}>
      {r === "NOT_ASSESSED" ? "Not assessed" : r.charAt(0) + r.slice(1).toLowerCase()}
    </span>
  );
}

export default async function ControlLibraryPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const category = one(sp.category);
  const keyOnly = one(sp.keyOnly) === "true";
  const rating = one(sp.rating);
  const overdueOnly = one(sp.overdueOnly) === "true";

  let data: ControlListResponse = { items: [], total: 0, categoryCounts: {} };
  let error: string | null = null;
  try {
    data = await backendFetch<ControlListResponse>("/api/erm/controls", {
      query: {
        category: category ?? undefined,
        keyOnly: keyOnly ? "true" : undefined,
        rating: rating ?? undefined,
        overdueOnly: overdueOnly ? "true" : undefined,
      },
    });
  } catch (e: any) {
    error = e?.message ?? "Failed to load controls";
  }

  const counts = data.categoryCounts ?? {};

  // Build a filtered href preserving the other params.
  const hrefWith = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      category,
      keyOnly: keyOnly ? "true" : undefined,
      rating,
      overdueOnly: overdueOnly ? "true" : undefined,
      ...patch,
    };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) next.set(k, v);
    });
    const qs = next.toString();
    return `/erm/controls/library${qs ? `?${qs}` : ""}`;
  };

  const chipCls = (active: boolean) =>
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
    (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400");

  return (
    <div>
      <PageHeader
        title="Controls Library"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Internal Controls", href: "/erm/controls" },
          { label: "Library" },
        ]}
        description="The full register of internal controls — design & operating ratings, ownership, test cadence and open deficiencies."
        action={<NewControlButton />}
      />

      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Tier 3 seed has been run and you are logged in with a controls role.
        </Alert>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Category</span>
            <Link href={hrefWith({ category: undefined })} className={chipCls(!category)}>All</Link>
            {CONTROL_CATEGORIES.map((c) => (
              <Link key={c} href={hrefWith({ category: category === c ? undefined : c })} className={chipCls(category === c)}>
                {CONTROL_CATEGORY_LABEL[c] ?? c} <span className="tabular-nums opacity-70">{counts[c] ?? 0}</span>
              </Link>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filters</span>
            <Link href={hrefWith({ keyOnly: keyOnly ? undefined : "true" })} className={chipCls(keyOnly)}>Key controls</Link>
            <Link href={hrefWith({ overdueOnly: overdueOnly ? undefined : "true" })} className={chipCls(overdueOnly)}>Test overdue</Link>
            <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Operating</span>
            {RATING_FILTERS.map((r) => (
              <Link key={r} href={hrefWith({ rating: rating === r ? undefined : r })} className={chipCls(rating === r)}>
                {r === "NOT_ASSESSED" ? "Not assessed" : r.charAt(0) + r.slice(1).toLowerCase()}
              </Link>
            ))}
            <span className="ml-auto text-xs text-slate-500">{data.items.length} of {data.total} shown</span>
          </div>

          <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
            <Table className="w-full min-w-[1200px] text-sm">
              <TableHeader className="bg-slate-50/95">
                <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <TableHead className="px-3 py-2.5">Code</TableHead>
                  <TableHead className="px-3 py-2.5">Name</TableHead>
                  <TableHead className="px-3 py-2.5">Type</TableHead>
                  <TableHead className="px-3 py-2.5">Nature</TableHead>
                  <TableHead className="px-3 py-2.5">Frequency</TableHead>
                  <TableHead className="px-3 py-2.5">Category</TableHead>
                  <TableHead className="px-3 py-2.5">Owner</TableHead>
                  <TableHead className="px-3 py-2.5">Key</TableHead>
                  <TableHead className="px-3 py-2.5">Design</TableHead>
                  <TableHead className="px-3 py-2.5">Operating</TableHead>
                  <TableHead className="px-3 py-2.5">Last test</TableHead>
                  <TableHead className="px-3 py-2.5">Next test</TableHead>
                  <TableHead className="px-3 py-2.5">Open def.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="px-3 py-10 text-center text-sm text-slate-400">
                      No controls match the current filter. Use “New Control” to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((c) => (
                    <TableRow key={c.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <TableCell className="px-3 py-2.5">
                        <Link href={`/erm/controls/${c.id}`} className="font-mono text-xs font-medium text-primary-700 hover:underline">
                          {c.controlCode}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[260px] px-3 py-2.5 text-slate-700">{c.name}</TableCell>
                      <TableCell className="px-3 py-2.5">
                        <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {CONTROL_TYPE_LABEL[c.controlType] ?? c.controlType}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-600">{NATURE_LABEL[c.nature] ?? c.nature}</TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-600">{freqLabel(c.frequency)}</TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-600">{CONTROL_CATEGORY_LABEL[c.category] ?? c.category}</TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-600">{c.controlOwnerName ?? "—"}</TableCell>
                      <TableCell className="px-3 py-2.5">
                        {c.isKeyControl ? (
                          <span className="rounded border border-primary-200 bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-800">KEY</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2.5"><RatingChip rating={c.currentDesignRating} /></TableCell>
                      <TableCell className="px-3 py-2.5"><RatingChip rating={c.currentOperatingRating} /></TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-500">{fmtDate(c.lastTestDate)}</TableCell>
                      <TableCell className="px-3 py-2.5 text-xs">
                        {c.testOverdue ? (
                          <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                            {fmtDate(c.nextTestDueDate)} · overdue
                          </span>
                        ) : (
                          <span className="text-slate-500">{fmtDate(c.nextTestDueDate)}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        {c.openDeficiencyCount > 0 ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                            {c.openDeficiencyCount}
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
