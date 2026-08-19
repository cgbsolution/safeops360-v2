// The controlled-document header block, reproduced from the source sheets.
//
// Every one of the four workbooks opens the same way — company band, then
// Department / title / page, then Document No. / Supersedes No. / Effective Date
// / Review Date. Those four control fields are the first thing an auditor checks
// and the reason this is a component rather than four lines copied into each
// screen: if the block drifts between the Fire Alarm screen and the Hydrant
// screen, one of them is misreporting a controlled document.

import { DISPLAY_FONT, DocumentMeta, MX, fmtDate } from "../lib";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex-1 border-r px-2.5 py-1.5 last:border-r-0" style={{ borderColor: MX.iceLine }}>
      <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: MX.muted }}>
        {label}
      </div>
      <div className="truncate text-[12px] font-medium" style={{ color: MX.ink }}>
        {value || "—"}
      </div>
    </div>
  );
}

export function DocumentHeader({
  doc,
  title,
  subtitle,
  right,
}: {
  doc: DocumentMeta;
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: MX.iceLine }}>
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
        style={{ background: MX.navy }}
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: MX.gold }}>
            Page Industries Limited · {doc.department ?? "EHS"}
          </div>
          <h2 className="truncate text-[15px] font-semibold text-white" style={{ fontFamily: DISPLAY_FONT }}>
            {title}
          </h2>
          {subtitle && <div className="mt-0.5 text-[11px] text-white/70">{subtitle}</div>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>

      <div className="flex flex-wrap divide-y sm:divide-y-0" style={{ background: MX.ice }}>
        <Field label="Document No." value={doc.documentNo} />
        <Field label="Supersedes No." value={doc.supersedesNo} />
        <Field label="Effective Date" value={fmtDate(doc.effectiveDate)} />
        <Field label="Review Date" value={fmtDate(doc.reviewDate)} />
        <Field label="Revision" value={doc.revision} />
      </div>
    </div>
  );
}

// The revision notes and operating rules the sheets print below the item table.
// Reproduced verbatim, and visually subordinate — they are part of the document,
// not instructions to the person filling it in.
export function Footnotes({ lines }: { lines?: string[] }) {
  if (!lines?.length) return null;
  return (
    <div className="mt-3 rounded-lg border px-3 py-2" style={{ borderColor: MX.iceLine, background: MX.ice }}>
      {lines.map((l, i) => (
        <div key={i} className="text-[11px] leading-relaxed" style={{ color: MX.muted }}>
          {l}
        </div>
      ))}
    </div>
  );
}
