import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KpiTile } from "@/components/erm/shared";
import {
  POLICY_STATUS_CHIP,
  POLICY_TYPE_LABEL,
  POLICY_TYPES,
  inrCompact,
  type PolicyListResponse,
} from "@/app/(dashboard)/erm/lib-t3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import { NewPolicyButton } from "./new-policy-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["ACTIVE", "EXPIRING_SOON", "EXPIRED", "UNDER_RENEWAL", "LAPSED"] as const;

function expiryBadge(days: number | null) {
  if (days == null) return null;
  if (days < 0) return <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">expired</span>;
  if (days <= 90) return <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{days}d</span>;
  return null;
}

function only(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PolicyRegisterPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const policyType = only(sp.policyType);
  const status = only(sp.status);

  let data: PolicyListResponse = { items: [], total: 0, statusCounts: {} };
  let error: string | null = null;
  try {
    data = await backendFetch<PolicyListResponse>("/api/erm/insurance/policies", {
      query: { policyType: policyType ?? undefined, status: status ?? undefined },
    });
  } catch (e: any) {
    error = e?.message ?? "Failed to load policies";
  }

  const counts = data.statusCounts ?? {};

  const buildHref = (next: { policyType?: string; status?: string }) => {
    const usp = new URLSearchParams();
    const pt = next.policyType !== undefined ? next.policyType : policyType;
    const st = next.status !== undefined ? next.status : status;
    if (pt) usp.set("policyType", pt);
    if (st) usp.set("status", st);
    const s = usp.toString();
    return `/erm/insurance/policies${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Policy Register"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Insurance & Transfer", href: "/erm/insurance" },
          { label: "Policies" },
        ]}
        description="Every active and historical insurance policy — sum insured, premium, renewal status, covered risks and open claims."
        action={<NewPolicyButton />}
      />

      {error ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Tier 3 seed has been run, and you are logged in with an insurance role.
        </Alert>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile label="Total Policies" value={data.total} />
            <KpiTile label="Active" value={counts.ACTIVE ?? 0} tone="good" href={buildHref({ status: "ACTIVE" })} />
            <KpiTile label="Expiring Soon" value={counts.EXPIRING_SOON ?? 0} tone="warn" href={buildHref({ status: "EXPIRING_SOON" })} />
            <KpiTile label="Expired / Lapsed" value={(counts.EXPIRED ?? 0) + (counts.LAPSED ?? 0)} tone="critical" />
          </div>

          {/* Filter chips */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Type</span>
            <Link
              href={buildHref({ policyType: "" })}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                (!policyType ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
              }
            >
              All
            </Link>
            {POLICY_TYPES.map((t) => (
              <Link
                key={t}
                href={buildHref({ policyType: policyType === t ? "" : t })}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                  (policyType === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
                }
              >
                {POLICY_TYPE_LABEL[t] ?? t.replace(/_/g, " ")}
              </Link>
            ))}
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
            <Link
              href={buildHref({ status: "" })}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                (!status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
              }
            >
              All
            </Link>
            {STATUS_FILTERS.map((s) => (
              <Link
                key={s}
                href={buildHref({ status: status === s ? "" : s })}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                  (status === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
                }
              >
                {s.replace(/_/g, " ")} <span className="tabular-nums opacity-70">{counts[s] ?? 0}</span>
              </Link>
            ))}
            <span className="ml-auto text-xs text-slate-500">{data.items.length} shown</span>
          </div>

          <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-none">
            <Table className="w-full min-w-[1100px] text-sm">
              <TableHeader className="bg-slate-50/95">
                <TableRow className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <TableHead className="px-3 py-2.5">Code</TableHead>
                  <TableHead className="px-3 py-2.5">Name</TableHead>
                  <TableHead className="px-3 py-2.5">Type</TableHead>
                  <TableHead className="px-3 py-2.5">Insurer</TableHead>
                  <TableHead className="px-3 py-2.5">Policy no.</TableHead>
                  <TableHead className="px-3 py-2.5 text-right">Sum insured</TableHead>
                  <TableHead className="px-3 py-2.5 text-right">Premium</TableHead>
                  <TableHead className="px-3 py-2.5">Coverage end</TableHead>
                  <TableHead className="px-3 py-2.5">Status</TableHead>
                  <TableHead className="px-3 py-2.5 text-right">Risks</TableHead>
                  <TableHead className="px-3 py-2.5 text-right">Claims</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="px-3 py-10 text-center text-sm text-slate-400">
                      No policies match the current filter. Use “New Policy” to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((p) => (
                    <TableRow key={p.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <TableCell className="px-3 py-2.5">
                        <Link href={`/erm/insurance/policies/${p.id}`} className="font-medium text-primary-700 hover:underline">
                          {p.policyCode}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[220px] px-3 py-2.5 text-slate-700">{p.policyName}</TableCell>
                      <TableCell className="px-3 py-2.5">
                        <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {POLICY_TYPE_LABEL[p.policyType] ?? p.policyType.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-600">{p.insurerName}</TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-500">{p.policyNumber}</TableCell>
                      <TableCell className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">{inrCompact(p.sumInsuredInr)}</TableCell>
                      <TableCell className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{inrCompact(p.premiumAnnualInr)}</TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-slate-500">
                        {fmtDate(p.coverageEndDate)}
                        {expiryBadge(p.daysToExpiry)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (POLICY_STATUS_CHIP[p.status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                          {p.status.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">{p.coveredRiskCount}</TableCell>
                      <TableCell className="px-3 py-2.5 text-right text-xs tabular-nums">
                        {p.openClaimCount > 0 ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">{p.openClaimCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
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
