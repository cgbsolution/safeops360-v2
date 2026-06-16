import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

// Export route. Data is fetched from the FastAPI backend; the file is
// generated in Next.js (no DB call from this route).
//
// Formats:
//   ?format=csv  — proxies the backend's CSV stream (text/csv)
//   ?format=xlsx — generates a styled XLSX via exceljs (frozen header,
//                  autofilter, conditional cell fill on risk levels)

const RISK_FILL: Record<string, string> = {
  LOW: "FFD1FAE5",
  MODERATE: "FFFDE68A",
  HIGH: "FFFFEDD5",
  CRITICAL: "FFFECDD3"
};

const RISK_FONT: Record<string, string> = {
  LOW: "FF065F46",
  MODERATE: "FF92400E",
  HIGH: "FF7C2D12",
  CRITICAL: "FF881337"
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "csv";

  try {
    if (format === "csv") {
      const res = await backendFetch<Response>(`/api/hira/studies/${id}/export.csv`, {
        responseType: "raw"
      });
      const text = await res.text();
      return new NextResponse(text, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            res.headers.get("content-disposition") ?? `attachment; filename="hira-export.csv"`
        }
      });
    }

    if (format === "xlsx") {
      // Fetch full study + entry data through backend
      type EntryFull = {
        id: string;
        sequenceNumber: number;
        groupLabel: string | null;
        activityDescription: string;
        routine: string;
        frequency: string;
        areaId: string | null;
        initialLikelihoodScore: number;
        initialSeverityScore: number;
        initialRiskScore: number;
        initialRiskLevel: string;
        residualLikelihoodScore: number | null;
        residualSeverityScore: number | null;
        residualRiskScore: number | null;
        residualRiskLevel: string | null;
        residualAcceptable: boolean | null;
        status: string;
        lastReviewedAt: string | null;
        nextReviewDue: string | null;
        hazards: { hazardName: string | null; hazardCategory: string | null }[];
        existingControls: { hierarchy: string; description: string }[];
        recommendedControls: { hierarchy: string; description: string; status: string }[];
        regulationRefs: { regulation: string; section: string | null }[];
      };
      type StudyDetail = {
        study: {
          id: string;
          number: string;
          title: string;
          description: string | null;
          status: string;
          scopeType: string;
          initiatedAt: string;
          effectiveFrom: string | null;
          nextScheduledReviewDate: string | null;
          reviewFrequency: string;
        };
        entries: { id: string }[];
        plantName: string | null;
        departmentName: string | null;
        areaName: string | null;
        teamLeaderName: string | null;
        riskMatrix: { code: string; name: string } | null;
      };

      const detail = await backendFetch<StudyDetail>(`/api/hira/studies/${id}/detail`);
      const fullEntries = await Promise.all(
        detail.entries.map((e) => backendFetch<EntryFull>(`/api/hira/entries/${e.id}`))
      );

      const wb = new ExcelJS.Workbook();
      wb.creator = "SafeOps360";
      wb.created = new Date();

      // Summary sheet
      const summary = wb.addWorksheet("Summary");
      summary.columns = [
        { header: "Field", key: "k", width: 28 },
        { header: "Value", key: "v", width: 60 }
      ];
      summary.getRow(1).font = { bold: true };
      summary.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" }
      };
      const summaryRows: [string, string][] = [
        ["Study Number", detail.study.number],
        ["Title", detail.study.title],
        ["Description", detail.study.description ?? ""],
        ["Plant", detail.plantName ?? ""],
        ["Department", detail.departmentName ?? ""],
        ["Area", detail.areaName ?? ""],
        ["Scope Type", detail.study.scopeType],
        ["Methodology", detail.riskMatrix ? `${detail.riskMatrix.name} (${detail.riskMatrix.code})` : ""],
        ["Team Leader", detail.teamLeaderName ?? ""],
        ["Status", detail.study.status],
        ["Initiated", new Date(detail.study.initiatedAt).toLocaleDateString()],
        [
          "Effective From",
          detail.study.effectiveFrom ? new Date(detail.study.effectiveFrom).toLocaleDateString() : ""
        ],
        [
          "Next Scheduled Review",
          detail.study.nextScheduledReviewDate
            ? new Date(detail.study.nextScheduledReviewDate).toLocaleDateString()
            : ""
        ],
        ["Review Frequency", detail.study.reviewFrequency],
        ["Total Entries", String(fullEntries.length)],
        ["Generated At", new Date().toISOString()]
      ];
      for (const [k, v] of summaryRows) summary.addRow({ k, v });

      // Risk distribution sheet
      const dist = wb.addWorksheet("Risk Distribution");
      dist.columns = [
        { header: "Level", key: "level", width: 14 },
        { header: "Initial", key: "initial", width: 12 },
        { header: "Residual", key: "residual", width: 12 }
      ];
      dist.getRow(1).font = { bold: true };
      const counts = { LOW: [0, 0], MODERATE: [0, 0], HIGH: [0, 0], CRITICAL: [0, 0] } as Record<
        string,
        [number, number]
      >;
      for (const e of fullEntries) {
        if (counts[e.initialRiskLevel]) counts[e.initialRiskLevel][0]++;
        if (e.residualRiskLevel && counts[e.residualRiskLevel]) {
          counts[e.residualRiskLevel][1]++;
        }
      }
      for (const lvl of ["LOW", "MODERATE", "HIGH", "CRITICAL"]) {
        const row = dist.addRow({ level: lvl, initial: counts[lvl][0], residual: counts[lvl][1] });
        row.getCell("level").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: RISK_FILL[lvl] }
        };
        row.getCell("level").font = { color: { argb: RISK_FONT[lvl] }, bold: true };
      }

      // Register sheet — main data table
      const reg = wb.addWorksheet("Register");
      reg.columns = [
        { header: "Sr. No.", key: "sn", width: 8 },
        { header: "Group", key: "group", width: 18 },
        { header: "Activity", key: "activity", width: 60 },
        { header: "Routine", key: "routine", width: 14 },
        { header: "Frequency", key: "frequency", width: 14 },
        { header: "Hazards", key: "hazards", width: 50 },
        { header: "Init L", key: "iL", width: 8 },
        { header: "Init S", key: "iS", width: 8 },
        { header: "Init Risk", key: "iRisk", width: 10 },
        { header: "Init Level", key: "iLevel", width: 13 },
        { header: "Existing Controls", key: "controls", width: 60 },
        { header: "Resid L", key: "rL", width: 8 },
        { header: "Resid S", key: "rS", width: 8 },
        { header: "Resid Risk", key: "rRisk", width: 10 },
        { header: "Resid Level", key: "rLevel", width: 13 },
        { header: "Acceptable", key: "accept", width: 12 },
        { header: "Recommended", key: "rec", width: 60 },
        { header: "Reg Refs", key: "regs", width: 30 },
        { header: "Status", key: "status", width: 16 },
        { header: "Last Reviewed", key: "lastReviewed", width: 14 },
        { header: "Next Review", key: "nextReview", width: 14 }
      ];
      // Header styling
      reg.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      reg.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF334155" }
      };
      reg.getRow(1).alignment = { vertical: "middle", horizontal: "left" };
      reg.views = [{ state: "frozen", ySplit: 1 }];
      reg.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 21 } };

      // Data rows
      for (const e of fullEntries) {
        const row = reg.addRow({
          sn: e.sequenceNumber,
          group: e.groupLabel ?? "",
          activity: e.activityDescription,
          routine: e.routine,
          frequency: e.frequency,
          hazards: e.hazards
            .map((h) => `${h.hazardName ?? ""}${h.hazardCategory ? ` [${h.hazardCategory}]` : ""}`)
            .filter((s) => s.trim())
            .join("; "),
          iL: e.initialLikelihoodScore,
          iS: e.initialSeverityScore,
          iRisk: e.initialRiskScore,
          iLevel: e.initialRiskLevel,
          controls: e.existingControls.map((c) => `${c.hierarchy}: ${c.description}`).join("; "),
          rL: e.residualLikelihoodScore ?? "",
          rS: e.residualSeverityScore ?? "",
          rRisk: e.residualRiskScore ?? "",
          rLevel: e.residualRiskLevel ?? "",
          accept: e.residualAcceptable === null ? "" : e.residualAcceptable ? "Yes" : "No",
          rec: e.recommendedControls
            .map((c) => `[${c.status}] ${c.hierarchy}: ${c.description}`)
            .join("; "),
          regs: e.regulationRefs
            .map((r) => `${r.regulation}${r.section ? " " + r.section : ""}`)
            .join("; "),
          status: e.status,
          lastReviewed: e.lastReviewedAt ? new Date(e.lastReviewedAt).toLocaleDateString() : "",
          nextReview: e.nextReviewDue ? new Date(e.nextReviewDue).toLocaleDateString() : ""
        });
        row.alignment = { vertical: "top", wrapText: true };

        // Conditional fills on risk-level cells
        const iLevelCell = row.getCell("iLevel");
        if (RISK_FILL[e.initialRiskLevel]) {
          iLevelCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: RISK_FILL[e.initialRiskLevel] }
          };
          iLevelCell.font = { color: { argb: RISK_FONT[e.initialRiskLevel] }, bold: true };
        }
        if (e.residualRiskLevel && RISK_FILL[e.residualRiskLevel]) {
          const rLevelCell = row.getCell("rLevel");
          rLevelCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: RISK_FILL[e.residualRiskLevel] }
          };
          rLevelCell.font = { color: { argb: RISK_FONT[e.residualRiskLevel] }, bold: true };
        }
        if (e.residualAcceptable === false) {
          row.getCell("accept").fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFECDD3" }
          };
          row.getCell("accept").font = { color: { argb: "FF881337" }, bold: true };
        }
      }

      const buf = await wb.xlsx.writeBuffer();
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${detail.study.number}.xlsx"`
        }
      });
    }

    return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 });
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message ?? "Export failed" }, { status: 500 });
  }
}
