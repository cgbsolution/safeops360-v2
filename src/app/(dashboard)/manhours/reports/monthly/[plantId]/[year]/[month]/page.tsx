import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/server";
import { PageHeader } from "@/components/page-header";
import { ReportRenderer } from "@/components/manhours/report-renderer";
import { buildMonthlyReport } from "@/lib/manhours/report-builder";

export const dynamic = "force-dynamic";

export default async function MonthlyReportPage(props: {
  params: Promise<{ plantId: string; year: string; month: string }>;
}) {
  const params = await props.params;
  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return notFound();

  await requirePermission("MANHOURS.READ", { plantId: params.plantId });

  const data = await buildMonthlyReport({
    prisma,
    plantId: params.plantId,
    year,
    month
  });

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Monthly Safety Report"
          description={`${data.plant?.name ?? "—"} · ${data.periodLabel}`}
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
