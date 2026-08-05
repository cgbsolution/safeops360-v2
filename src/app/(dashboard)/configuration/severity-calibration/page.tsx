import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { Card, CardContent } from "@/components/ui/card";
import { CalibrationTable, type CalibrationReport } from "./calibration-table";

export const dynamic = "force-dynamic";

/**
 * Severity matrix calibration — the feedback loop the override log exists for.
 *
 * Reads only. Nothing here edits the matrix: the point is to show which rules
 * observers keep disagreeing with, so the correction is made deliberately (in
 * prisma/seed-severity-matrix.ts or directly on SeverityMatrixRule) rather than
 * inferred automatically. A matrix that retuned itself from field overrides
 * would drift toward whatever severity is least inconvenient to report.
 */
export default async function SeverityCalibrationPage(props: {
  searchParams: Promise<{ days?: string; all?: string }>;
}) {
  const searchParams = await props.searchParams;
  await requirePermission("OBSERVATION.READ");

  const days = Number(searchParams?.days) || 90;
  const includeAll = searchParams?.all === "1";

  // An empty report is the normal state on day one — the endpoint is new and
  // nothing has been overridden yet. Failing soft keeps a missing table (DDL
  // not yet applied) from 500ing a configuration page.
  const report = await backendFetch<CalibrationReport>(
    `/api/observations/severity-calibration?days=${days}&includeAllSources=${includeAll}`
  ).catch(() => null);

  return (
    <div>
      <PageHeader
        title="Severity Matrix Calibration"
        description="Where observers disagree with the suggested severity. A sub-category overridden consistently in one direction means the matrix rule is wrong — not the observers."
        breadcrumbs={[{ label: "Configuration", href: "/configuration" }, { label: "Severity Calibration" }]}
      />
      {report ? (
        <CalibrationTable report={report} days={days} includeAll={includeAll} />
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            The calibration report is unavailable. If the severity suggestion engine was only just
            deployed, run <code className="rounded bg-slate-100 px-1">npm run db:apply-observation-severity</code>{" "}
            and restart the backend.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
