import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { KpiTile } from "@/components/erm/shared";
import {
  CRITICALITY_CHIP,
  ONBOARDING_CHIP,
  VENDOR_CRITICALITIES,
  inrCompact,
  type VendorListResponse,
} from "@/app/(dashboard)/erm/lib-t3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import { TwinBadges } from "../twin-badges";
import { OnboardVendorButton } from "./onboard-form";

export const dynamic = "force-dynamic";

const RISK_BANDS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const ESG_BANDS = ["LEADING", "ADEQUATE", "DEVELOPING", "LAGGING"] as const;

const TIER_LABEL: Record<string, string> = { TIER_1: "Tier 1", TIER_2: "Tier 2", TIER_3: "Tier 3" };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function VendorRegisterPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const criticality = one(sp.criticality);
  const riskBand = one(sp.riskBand);
  const esgBand = one(sp.esgBand);
  const singleSource = one(sp.singleSource);
  const status = one(sp.status);

  let data: VendorListResponse = { items: [], total: 0, riskBandCounts: {}, esgBandCounts: {} };
  let error: string | null = null;
  try {
    data = await backendFetch<VendorListResponse>("/api/erm/vendors", {
      query: {
        criticality: criticality ?? undefined,
        riskBand: riskBand ?? undefined,
        esgBand: esgBand ?? undefined,
        singleSource: singleSource ? "true" : undefined,
        status: status ?? undefined,
      },
    });
  } catch (e: any) {
    error = e?.message ?? "Failed to load vendor register";
  }

  // Build a filter chip preserving the other active filters and toggling `key`.
  const chip = (key: string, value: string, label: string) => {
    const active = one(sp[key]) === value;
    const next = new URLSearchParams();
    for (const k of ["criticality", "riskBand", "esgBand", "singleSource", "status"]) {
      const cur = one(sp[k]);
      if (cur && k !== key) next.set(k, cur);
    }
    if (!active) next.set(key, value);
    const qs = next.toString();
    return (
      <Link
        key={`${key}:${value}`}
        href={`/erm/vendors/register${qs ? `?${qs}` : ""}`}
        className={
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
          (active
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")
        }
      >
        {label}
      </Link>
    );
  };

  const riskCounts = data.riskBandCounts ?? {};
  const esgCounts = data.esgBandCounts ?? {};

  return (
    <div>
      <PageHeader
        title="Vendor Register"
        breadcrumbs={[
          { label: "Enterprise Risk", href: "/erm" },
          { label: "Vendor Risk", href: "/erm/vendors" },
          { label: "Register" },
        ]}
        description="All third parties under management — each scored on TWO lenses (third-party RISK and supplier ESG posture). Twin badges per row."
        action={<OnboardVendorButton />}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error}. Ensure the ERM Tier 3 seed has been run, and you are logged in with a vendor role.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile label="Total Vendors" value={data.total} />
            <KpiTile label="HIGH + CRITICAL Risk" value={(riskCounts.HIGH ?? 0) + (riskCounts.CRITICAL ?? 0)} tone="high" />
            <KpiTile label="LAGGING ESG" value={esgCounts.LAGGING ?? 0} tone="critical" />
            <KpiTile label="LEADING ESG" value={esgCounts.LEADING ?? 0} tone="good" />
          </div>

          {/* Filter chips */}
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Criticality</span>
              {VENDOR_CRITICALITIES.map((c) => chip("criticality", c, c.charAt(0) + c.slice(1).toLowerCase()))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Risk band</span>
              {RISK_BANDS.map((b) => chip("riskBand", b, b))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-[11px] font-semibold uppercase tracking-wider text-slate-400">ESG band</span>
              {ESG_BANDS.map((b) => chip("esgBand", b, b))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Other</span>
              {chip("singleSource", "1", "Single-source")}
              {chip("status", "active", "Active only")}
              <span className="ml-auto text-xs text-slate-500">{data.items.length} shown</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Legal name</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Criticality</th>
                  <th className="px-3 py-2.5">Tier</th>
                  <th className="px-3 py-2.5">Owner</th>
                  <th className="px-3 py-2.5 text-right">Annual spend</th>
                  <th className="px-3 py-2.5">Single?</th>
                  <th className="px-3 py-2.5">Risk | ESG</th>
                  <th className="px-3 py-2.5">Onboarding</th>
                  <th className="px-3 py-2.5">Next review</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-sm text-slate-400">
                      No vendors match the current filters. Use “Onboard Vendor” to add one.
                    </td>
                  </tr>
                ) : (
                  data.items.map((v) => (
                    <tr key={v.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <td className="px-3 py-2.5">
                        <Link href={`/erm/vendors/${v.id}`} className="font-medium text-primary-700 hover:underline">
                          {v.vendorCode}
                        </Link>
                      </td>
                      <td className="max-w-[220px] px-3 py-2.5 text-slate-700">{v.legalName}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{v.category}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={
                            "inline-block rounded border px-2 py-0.5 text-[11px] " +
                            (CRITICALITY_CHIP[v.criticality] ?? "border-slate-200 bg-slate-100 text-slate-600")
                          }
                        >
                          {v.criticality.charAt(0) + v.criticality.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{TIER_LABEL[v.tier] ?? v.tier}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{v.relationshipOwnerName ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">{inrCompact(v.annualSpendInr)}</td>
                      <td className="px-3 py-2.5">
                        {v.isSingleSource ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">Single</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <TwinBadges
                          riskBand={v.currentRiskBand}
                          riskScore={v.currentRiskScore}
                          esgBand={v.currentEsgBand}
                          esgScore={v.currentEsgScore}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={
                            "inline-block rounded border px-2 py-0.5 text-[11px] " +
                            (ONBOARDING_CHIP[v.onboardingStatus] ?? "border-slate-200 bg-slate-100 text-slate-600")
                          }
                        >
                          {v.onboardingStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">
                        {v.reviewOverdue ? (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">
                            Overdue · {fmtDate(v.nextReviewDate)}
                          </span>
                        ) : (
                          fmtDate(v.nextReviewDate)
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
