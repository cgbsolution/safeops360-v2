import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { backendFetch, BackendError } from "@/lib/backend/fetch";

export const dynamic = "force-dynamic";

const SEVERITY_FILL: Record<string, string> = {
  LOW: "FFD1FAE5",
  MODERATE: "FFFDE68A",
  HIGH: "FFFFEDD5",
  CRITICAL: "FFFECDD3"
};
const SEVERITY_FONT: Record<string, string> = {
  LOW: "FF065F46",
  MODERATE: "FF92400E",
  HIGH: "FF7C2D12",
  CRITICAL: "FF881337"
};
const STATE_FILL: Record<string, string> = {
  CLOSED: "FFD1FAE5",
  VERIFIED: "FFD1FAE5",
  CLOSED_RECURRED: "FFFECDD3",
  REJECTED: "FFE2E8F0",
  CANCELLED: "FFE2E8F0"
};

type CapaListItem = {
  id: string;
  capaNumber: string;
  aliasNumber: string | null;
  title: string;
  sourceCategoryCode: string | null;
  sourceTypeCode: string;
  sourceReferenceSummary: string | null;
  severity: string;
  priority: string;
  state: string;
  primaryOwnerName: string | null;
  closureTargetDate: string | null;
  detectedAt: string;
  createdAt: string;
  daysOpen: number;
  daysOverdue: number;
  actionCount: number;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "csv";
    const sourceCategory = url.searchParams.get("sourceCategory");
    const plantId = url.searchParams.get("plantId");

    if (format === "csv") {
      const res = await backendFetch<Response>("/api/capa/export.csv", {
        responseType: "raw",
        query: { sourceCategory, plantId }
      });
      const text = await res.text();
      return new NextResponse(text, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            res.headers.get("content-disposition") ?? 'attachment; filename="capa-register.csv"'
        }
      });
    }

    if (format === "xlsx") {
      // Fetch via unified list endpoint (which carries denormalised owner names + counts)
      const list = await backendFetch<{ items: CapaListItem[] }>("/api/capa", {
        query: { sourceCategory, plantId }
      });

      const wb = new ExcelJS.Workbook();
      wb.creator = "SafeOps360";
      wb.created = new Date();

      const reg = wb.addWorksheet("CAPA Register");
      reg.columns = [
        { header: "CAPA Number", key: "num", width: 24 },
        { header: "Alias", key: "alias", width: 22 },
        { header: "Title", key: "title", width: 50 },
        { header: "Source", key: "source", width: 18 },
        { header: "Source Type", key: "sourceType", width: 22 },
        { header: "Reference", key: "ref", width: 36 },
        { header: "Severity", key: "severity", width: 12 },
        { header: "Priority", key: "priority", width: 12 },
        { header: "State", key: "state", width: 22 },
        { header: "Owner", key: "owner", width: 22 },
        { header: "Detected", key: "detected", width: 12 },
        { header: "Created", key: "created", width: 12 },
        { header: "Closure Target", key: "target", width: 14 },
        { header: "Days Open", key: "open", width: 11 },
        { header: "Days Overdue", key: "overdue", width: 13 },
        { header: "Actions", key: "actions", width: 9 }
      ];

      reg.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      reg.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
      reg.views = [{ state: "frozen", ySplit: 1 }];
      reg.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 16 } };

      for (const c of list.items) {
        const row = reg.addRow({
          num: c.capaNumber,
          alias: c.aliasNumber ?? "",
          title: c.title,
          source: c.sourceCategoryCode ?? "",
          sourceType: c.sourceTypeCode.replace(/_/g, " "),
          ref: c.sourceReferenceSummary ?? "",
          severity: c.severity,
          priority: c.priority,
          state: c.state.replace(/_/g, " "),
          owner: c.primaryOwnerName ?? "",
          detected: c.detectedAt ? new Date(c.detectedAt).toLocaleDateString() : "",
          created: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
          target: c.closureTargetDate ? new Date(c.closureTargetDate).toLocaleDateString() : "",
          open: c.daysOpen,
          overdue: c.daysOverdue,
          actions: c.actionCount
        });
        row.alignment = { vertical: "top", wrapText: true };
        // Severity fill
        if (SEVERITY_FILL[c.severity]) {
          row.getCell("severity").fill = { type: "pattern", pattern: "solid", fgColor: { argb: SEVERITY_FILL[c.severity] } };
          row.getCell("severity").font = { color: { argb: SEVERITY_FONT[c.severity] }, bold: true };
        }
        // State fill (only colors closure states)
        if (STATE_FILL[c.state]) {
          row.getCell("state").fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATE_FILL[c.state] } };
        }
        // Overdue highlight
        if (c.daysOverdue > 0) {
          row.getCell("overdue").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFECDD3" } };
          row.getCell("overdue").font = { color: { argb: "FF881337" }, bold: true };
        }
      }

      // Summary sheet
      const summary = wb.addWorksheet("Summary");
      summary.columns = [
        { header: "Metric", key: "k", width: 30 },
        { header: "Value", key: "v", width: 18 }
      ];
      summary.getRow(1).font = { bold: true };
      summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      summary.addRow({ k: "Total CAPAs", v: list.items.length });
      summary.addRow({ k: "Overdue", v: list.items.filter((i) => i.daysOverdue > 0).length });
      summary.addRow({ k: "Critical severity", v: list.items.filter((i) => i.severity === "CRITICAL").length });
      summary.addRow({ k: "High severity", v: list.items.filter((i) => i.severity === "HIGH").length });
      summary.addRow({ k: "Closed", v: list.items.filter((i) => i.state === "CLOSED").length });
      summary.addRow({ k: "Verified (awaiting closure)", v: list.items.filter((i) => i.state === "VERIFIED").length });
      summary.addRow({ k: "Generated at", v: new Date().toISOString() });

      const buf = await wb.xlsx.writeBuffer();
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="capa-register.xlsx"'
        }
      });
    }

    return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 });
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
