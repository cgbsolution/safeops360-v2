import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/server";
import { getAccessiblePlantIds } from "@/lib/dashboard/scope";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function ReportsLauncherPage() {
  await requirePermission("MANHOURS.READ");

  // Most-recently-completed month — submissions are post-period.
  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  // Current fiscal quarter (Apr-Jun = Q1, etc.) for the quarterly tile.
  const monthIdx = now.getMonth(); // 0-11
  const currentFiscalQuarter = (() => {
    if (monthIdx >= 3 && monthIdx <= 5) return { quarter: 1, year: now.getFullYear() };
    if (monthIdx >= 6 && monthIdx <= 8) return { quarter: 2, year: now.getFullYear() };
    if (monthIdx >= 9 && monthIdx <= 11) return { quarter: 3, year: now.getFullYear() };
    // Jan-Mar = Q4 of previous fiscal year
    return { quarter: 4, year: now.getFullYear() - 1 };
  })();

  // List of LOCKED submissions in the last 12 months — these have
  // immutable snapshots, so the report is fully reproducible. Surface
  // these as the "publish" buttons.
  const lockedSubmissions = await prisma.manhoursSubmission.findMany({
    where: { status: "LOCKED" },
    orderBy: [{ reportingYear: "desc" }, { reportingMonth: "desc" }],
    take: 20,
    select: {
      id: true,
      plantId: true,
      reportingYear: true,
      reportingMonth: true,
      submissionNumber: true,
      plant: { select: { name: true, code: true } }
    }
  });

  // Plants with a legacy Manhours row for last month — fallback path
  // for the period before the new wizard had any data.
  const accessibleIds = await getAccessiblePlantIds();
  const plants = await prisma.plant.findMany({
    where: accessibleIds ? { id: { in: accessibleIds } } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true }
  });

  return (
    <div>
      <PageHeader
        title="Auto-generated reports"
        description="Monthly, quarterly, and annual reports composed from the KPI engine. Each report is browser-printable to PDF and includes an AI-generated executive summary."
        breadcrumbs={[{ label: "Manhours", href: "/manhours" }, { label: "Reports" }]}
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {/* Quarterly */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp size={16} className="text-violet-700" />
              Quarterly Board Report
            </CardTitle>
            <CardDescription>
              Group-wide view across all plants for the current fiscal quarter. Designed for the Safety Committee.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/manhours/reports/quarterly/${currentFiscalQuarter.year}/${currentFiscalQuarter.quarter}`}
              className="block rounded-md border bg-violet-50 hover:bg-violet-100 transition px-4 py-3"
            >
              <div className="text-xs uppercase tracking-wider text-violet-700">Current quarter</div>
              <div className="text-lg font-bold text-violet-900">
                FY{String(currentFiscalQuarter.year).slice(2)} Q{currentFiscalQuarter.quarter}
              </div>
              <div className="text-[11px] text-violet-700 mt-1">Open report →</div>
            </Link>
          </CardContent>
        </Card>

        {/* Annual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText size={16} className="text-emerald-700" />
              Annual Safety Report
            </CardTitle>
            <CardDescription>
              Full year + YoY comparison. Suitable for ESG disclosure and investor relations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/manhours/reports/annual/${now.getFullYear() - 1}`}
              className="block rounded-md border bg-emerald-50 hover:bg-emerald-100 transition px-4 py-3"
            >
              <div className="text-xs uppercase tracking-wider text-emerald-700">Last completed year</div>
              <div className="text-lg font-bold text-emerald-900">{now.getFullYear() - 1}</div>
              <div className="text-[11px] text-emerald-700 mt-1">Open report →</div>
            </Link>
          </CardContent>
        </Card>

        {/* Monthly — surface the latest locked submission */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar size={16} className="text-primary-700" />
              Monthly Performance Report
            </CardTitle>
            <CardDescription>
              Per-plant operational view. Uses the immutable KPI snapshot when the period is locked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-slate-500">
              Pick a plant + month from the list below, or go to the calendar grid.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Locked submissions = ready-to-publish reports */}
      <h2 className="text-sm font-semibold text-slate-700 mb-2">Locked monthly submissions</h2>
      <Card className="mb-6">
        <CardContent className="p-0">
          {lockedSubmissions.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">
              No locked submissions yet. Submissions enter LOCKED state after Corporate HSE approval (see&nbsp;
              <Link href="/manhours" className="text-primary-700 hover:underline">/manhours</Link>).
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">Submission #</th>
                  <th className="px-3 py-2 text-left">Plant</th>
                  <th className="px-3 py-2 text-left">Period</th>
                  <th className="px-3 py-2 text-right">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lockedSubmissions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">{s.submissionNumber ?? "—"}</td>
                    <td className="px-3 py-2">{s.plant.name}</td>
                    <td className="px-3 py-2">{MONTHS[s.reportingMonth]} {s.reportingYear}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge className="bg-slate-700 text-white">LOCKED</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        className="text-primary-700 hover:underline text-xs"
                        href={`/manhours/reports/monthly/${s.plantId}/${s.reportingYear}/${s.reportingMonth}`}
                      >
                        Open report →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Quick-launch for last completed month per plant */}
      <h2 className="text-sm font-semibold text-slate-700 mb-2">
        Monthly report — last completed month ({MONTHS[lastMonth]} {lastMonthYear})
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        {plants.map((p) => (
          <Link
            key={p.id}
            href={`/manhours/reports/monthly/${p.id}/${lastMonthYear}/${lastMonth}`}
            className="block rounded-md border bg-white hover:shadow-sm hover:border-primary-300 transition p-4"
          >
            <div className="text-xs uppercase tracking-wider text-slate-500">{p.code}</div>
            <div className="text-sm font-medium mt-1">{p.name}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {MONTHS[lastMonth]} {lastMonthYear} →
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-[11px] text-slate-500">
        Reports use{" "}
        <code>window.print()</code> for PDF export — your browser's print dialog converts the
        report to PDF with the layout preserved. AI-generated narratives use the Claude API; when{" "}
        <code>ANTHROPIC_API_KEY</code> is unset the narrative falls back to a deterministic template.
      </p>
    </div>
  );
}
