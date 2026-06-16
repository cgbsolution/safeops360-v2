import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { PageHeader } from "@/components/page-header";
import { ReportRenderer } from "@/components/manhours/report-renderer";
import { buildQuarterlyReport } from "@/lib/manhours/report-builder";

export const dynamic = "force-dynamic";

export default async function QuarterlyReportPage(props: {
  params: Promise<{ year: string; quarter: string }>;
}) {
  const params = await props.params;
  const year = parseInt(params.year, 10);
  const quarter = parseInt(params.quarter, 10);
  if (isNaN(year) || isNaN(quarter) || quarter < 1 || quarter > 4) return notFound();

  await requirePermission("MANHOURS.READ");

  const data = await buildQuarterlyReport({
    prisma,
    year,
    quarter: quarter as 1 | 2 | 3 | 4
  });

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Quarterly Board Report"
          description={`Group-wide · ${data.periodLabel}`}
          breadcrumbs={[
            { label: "Manhours", href: "/manhours" },
            { label: "Reports", href: "/manhours/reports" },
            { label: data.periodLabel }
          ]}
        />
      </div>
      <ReportRenderer data={data} />
    </div>
  );
}
