import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { PageHeader } from "@/components/page-header";
import { ReportRenderer } from "@/components/manhours/report-renderer";
import { buildAnnualReport } from "@/lib/manhours/report-builder";

export const dynamic = "force-dynamic";

export default async function AnnualReportPage(props: {
  params: Promise<{ year: string }>;
}) {
  const params = await props.params;
  const year = parseInt(params.year, 10);
  if (isNaN(year)) return notFound();

  await requirePermission("MANHOURS.READ");

  const data = await buildAnnualReport({ prisma, year });

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Annual Safety Report"
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
