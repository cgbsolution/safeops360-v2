"use client";

// The PDF + Excel pair, on every fire surface that exports something.
//
// One component rather than four copies because the two formats are not
// interchangeable and the distinction has to read the same everywhere:
//
//   PDF    the controlled document. Opens in a tab — an auditor is being shown
//          a sheet, not handed a file to save.
//   Excel  the working copy. Downloads — the next thing anyone does with it is
//          sort, filter or paste it into a report.
//
// Both hit the same backend payload behind `/api/fire/...`, so an export can
// never disagree with the screen it was taken from. Both are gated on
// FIRE.EXPORT server-side; `allowed` only decides whether to offer them, so a
// caller who cannot export is not shown a button that will 403.

import { FileDown, FileSpreadsheet } from "lucide-react";
import { MX } from "../lib";

export function ExportButtons({
  pdfHref,
  xlsxHref,
  allowed = true,
  size = "md",
}: {
  pdfHref: string;
  xlsxHref: string;
  /** False hides both — the caller lacks FIRE.EXPORT. */
  allowed?: boolean;
  size?: "sm" | "md";
}) {
  if (!allowed) return null;
  const pad = size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]";
  const icon = size === "sm" ? 11 : 13;
  const cls =
    "inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors hover:bg-slate-50 " +
    pad;

  return (
    <>
      <a
        href={pdfHref}
        target="_blank"
        rel="noreferrer"
        className={cls}
        style={{ borderColor: MX.iceLine, color: MX.navy }}
        title="Open as a PDF — the controlled document"
      >
        <FileDown size={icon} /> PDF
      </a>
      {/* No `target="_blank"`: an attachment response in a new tab leaves an
          empty tab behind in every browser once the download starts. */}
      <a
        href={xlsxHref}
        className={cls}
        style={{ borderColor: MX.iceLine, color: MX.green }}
        title="Download as Excel — sortable, filterable working copy"
      >
        <FileSpreadsheet size={icon} /> Excel
      </a>
    </>
  );
}
