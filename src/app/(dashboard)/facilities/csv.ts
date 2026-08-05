// Shared CSV helpers for the Facilities registers / reports.
// All exports are UTF-8 with a BOM so Excel detects the encoding (₹ and other
// non-ASCII render correctly); rows are CRLF-delimited; cells are always quoted
// with embedded quotes doubled.

export type Cell = string | number | boolean | null | undefined;

export function toCsv(rows: Cell[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Date-stamp for export filenames: YYYY-MM-DD.
export function stamp(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
