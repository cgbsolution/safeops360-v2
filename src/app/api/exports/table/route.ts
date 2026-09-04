// Generic "Export to Excel" endpoint behind the shared <DataTable> toolbar.
//
// The browser already holds exactly what the user is looking at — the visible
// columns, the active filter, the selected rows — so it posts that projection
// here and gets a real .xlsx back. Building the workbook server-side keeps
// exceljs (~1 MB) out of the client bundle; it is already a server dependency
// for the CAPA and HIRA exports.
//
// This route deliberately reads NOTHING from the database. It only formats
// data the caller was already authorised to see on screen, which is why the
// only check here is "is there a session".

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Guardrails against a pathological payload turning into an OOM.
const MAX_ROWS = 20_000;
const MAX_COLUMNS = 80;
const MAX_CELL_CHARS = 32_000;

type ExportColumn = { key: string; label?: string };
type ExportBody = {
  fileName?: string;
  sheetName?: string;
  columns?: ExportColumn[];
  rows?: Record<string, unknown>[];
};

/** Excel rejects these in a sheet name, and caps it at 31 characters. */
function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\[\]:*?/\\]/g, " ").trim();
  return (cleaned || "Export").slice(0, 31);
}

/** Keeps the Content-Disposition filename to something a browser will accept. */
function safeFileName(name: string): string {
  const cleaned = name
    .replace(/\.xlsx$/i, "")
    .replace(/[^A-Za-z0-9 ._-]/g, "-")
    .trim();
  return (cleaned || "export").slice(0, 80);
}

function cell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  const s = typeof value === "string" ? value : String(value);
  return s.length > MAX_CELL_CHARS ? s.slice(0, MAX_CELL_CHARS) : s;
}

/** Column width from the longest value, clamped so one long description doesn't blow the sheet out. */
function widthFor(label: string, values: (string | number | boolean)[]): number {
  const longest = values.reduce<number>((max, v) => Math.max(max, String(v).length), label.length);
  return Math.min(Math.max(longest + 2, 10), 50);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ExportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const columns = (body.columns ?? []).filter((c) => c && typeof c.key === "string");
  const rows = body.rows ?? [];

  if (!columns.length) {
    return NextResponse.json({ error: "No columns to export." }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows to export." }, { status: 400 });
  }
  if (columns.length > MAX_COLUMNS) {
    return NextResponse.json({ error: `Too many columns (limit ${MAX_COLUMNS}).` }, { status: 413 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Too many rows (limit ${MAX_ROWS.toLocaleString()}).` }, { status: 413 });
  }

  const fileName = safeFileName(body.fileName ?? "export");
  const values = rows.map((r) => columns.map((c) => cell(r?.[c.key])));

  const wb = new ExcelJS.Workbook();
  wb.creator = "SafeOps360";
  wb.created = new Date();

  const sheet = wb.addWorksheet(safeSheetName(body.sheetName ?? fileName));
  sheet.columns = columns.map((c, i) => {
    const label = c.label?.trim() || c.key;
    return {
      header: label,
      key: `c${i}`,
      width: widthFor(
        label,
        values.map((row) => row[i])
      )
    };
  });

  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
  head.alignment = { vertical: "middle" };
  head.height = 20;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  for (const row of values) {
    sheet.addRow(row).alignment = { vertical: "top", wrapText: true };
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
      "Cache-Control": "no-store"
    }
  });
}
