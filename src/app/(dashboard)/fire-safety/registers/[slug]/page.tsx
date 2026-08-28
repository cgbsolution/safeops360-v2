// Any branded fire register, by its config slug.
//
// One route serves all of them — `/fire-safety/registers/alarm-panel-register`,
// `/fire-safety/registers/hydrant-system-register`,
// `/fire-safety/registers/extinguisher-register` — because the columns, the
// branding, the document-control block and the PDF layout are all rows in
// `FireRegisterViewConfig`, not code. Adding a fourth register is a seed entry.
//
// That was already the design; it just had no consumer. The config table was
// seeded with all three registers and read by nothing, so the extinguisher
// rendered from a hardcoded component and the other two did not exist.
//
// The doc-control header and the export pair are the existing shared
// components, unchanged — an auditor comparing this register's header against
// the extinguisher's must see the same block, or one of them is misreporting a
// controlled document.

import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { DocumentHeader } from "../../_components/document-header";
import { ExportButtons } from "../../_components/export-buttons";
import {
  ConfigRegisterTable,
  RegisterDocument,
  RegisterRow,
} from "../../_components/config-register-table";
import { CompletionPanel, CompliancePayload } from "@/components/compliance/completion-panel";
import { MX } from "../../lib";

export const dynamic = "force-dynamic";

type RegisterPayload = {
  document: RegisterDocument;
  summary: { total: number; overdue: number; dueSoon: number; notRecorded: number };
  rows: RegisterRow[];
  /** Column keys the backend's row builder does not produce. Surfaced, not
   *  swallowed: a blank column on a statutory register reads as "nothing
   *  recorded" when it actually means "nothing wired up". */
  unmappedColumns?: string[];
};

type RegisterListItem = {
  assetType: string;
  brandName: string;
  routeSlug: string;
  documentNo: string;
  isClientDocument: boolean;
};

export default async function BrandedRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};

  let payload: RegisterPayload | null = null;
  let error: string | null = null;
  let siblings: RegisterListItem[] = [];
  let compliance: CompliancePayload | null = null;

  // Settled independently: the register switcher failing must not blank the
  // register itself, and vice versa.
  const [regRes, listRes, compRes] = await Promise.allSettled([
    backendFetch<RegisterPayload>(`/api/fire/registers/${encodeURIComponent(slug)}`, {
      query: sp.location ? { location: sp.location } : undefined,
    }),
    backendFetch<{ items: RegisterListItem[] }>("/api/fire/registers"),
    // The Operations-side completion panel. Same endpoint the CAMS Compliance
    // Snapshot calls — one aggregation, two surfaces, so an auditor and a plant
    // engineer cannot be shown different numbers for the same asset.
    backendFetch<CompliancePayload>("/api/fire/compliance"),
  ]);

  if (regRes.status === "fulfilled") {
    payload = regRes.value;
  } else {
    const message = (regRes.reason as { message?: string })?.message ?? "";
    // A slug with no config row is a 404, not an error banner — the URL names a
    // register that does not exist.
    if (message.includes("No register is configured")) notFound();
    error = message || "This register could not be loaded.";
  }
  if (listRes.status === "fulfilled") siblings = listRes.value.items ?? [];
  // Settled independently: compliance is context, and its absence must not
  // blank the register itself, which is the statutory document.
  if (compRes.status === "fulfilled") compliance = compRes.value;

  const doc = payload?.document;
  const summary = payload?.summary;

  return (
    <div>
      <PageHeader
        title={doc?.title ? titleCase(doc.title) : "Fire Asset Register"}
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Fire Safety", href: "/fire-safety" },
          { label: "Registers" },
        ]}
        description={
          doc?.documentNo
            ? `${doc.documentNo}${doc.revision ? ` · ${doc.revision}` : ""} — every asset of this type on site, with its inspection status.`
            : "Every asset of this type on site, with its inspection status."
        }
        action={
          payload ? (
            <ExportButtons
              pdfHref={`/api/fire/registers/${encodeURIComponent(slug)}/export.pdf`}
              xlsxHref={`/api/fire/registers/${encodeURIComponent(slug)}/export.xlsx`}
            />
          ) : undefined
        }
      />

      {siblings.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {siblings.map((s) => {
            const on = s.routeSlug === slug;
            return (
              <Link
                key={s.routeSlug}
                href={`/fire-safety/registers/${s.routeSlug}`}
                className="rounded-lg px-3 py-2 text-left transition-colors"
                style={{
                  background: on ? MX.navy : MX.paper,
                  border: `1px solid ${on ? MX.navy : MX.iceLine}`,
                }}
              >
                <div className="text-[9.5px] font-semibold tracking-wide" style={{ color: MX.gold }}>
                  {s.documentNo}
                </div>
                <div className="text-[12.5px] font-semibold" style={{ color: on ? "#fff" : MX.navy }}>
                  {s.brandName}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {error && (
        <div
          className="rounded-xl border p-6 text-[13px]"
          style={{ borderColor: MX.red, background: MX.redSoft, color: MX.red }}
        >
          {error}
        </div>
      )}

      {payload && doc && (
        <>
          <div className="mb-4">
            <DocumentHeader
              doc={{
                documentNo: doc.documentNo ?? undefined,
                supersedesNo: doc.supersedesNo ?? undefined,
                revision: doc.revision ?? undefined,
                effectiveDate: doc.effectiveDate ?? undefined,
                reviewDate: doc.reviewDate ?? undefined,
                department: doc.department ?? undefined,
              }}
              title={doc.title ?? "FIRE ASSET REGISTER"}
              subtitle={
                summary
                  ? `${summary.total} asset(s) · ${summary.overdue} overdue · ${summary.dueSoon} due within 30 days · ${summary.notRecorded} with no date on file`
                  : undefined
              }
            />
          </div>

          {compliance && (
            <div className="mb-4">
              <CompletionPanel
                data={compliance}
                title="Checklist compliance"
                subtitle="Routine checklist completion across your fire and chemical assets"
                maxAssets={6}
                footer="Same figures the CAMS Compliance Snapshot shows — one aggregation, rendered on both sides."
              />
            </div>
          )}

          {/* A misconfigured column is named rather than left as an empty
              column an auditor would read as "nothing recorded". */}
          {payload.unmappedColumns && payload.unmappedColumns.length > 0 && (
            <div
              className="mb-4 flex items-start gap-2 rounded-xl border px-4 py-2.5 text-[12px]"
              style={{ borderColor: MX.gold, background: MX.amberSoft, color: MX.amber }}
              role="status"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong>{payload.unmappedColumns.join(", ")}</strong>{" "}
                {payload.unmappedColumns.length === 1 ? "is a column" : "are columns"} this
                register is configured to show, but the fire asset record has no such field — so{" "}
                {payload.unmappedColumns.length === 1 ? "it renders" : "they render"} blank.
                Either the field needs adding to the asset, or the column needs removing from the
                register configuration.
              </span>
            </div>
          )}

          <ConfigRegisterTable
            document={doc}
            rows={payload.rows}
            emptyMessage="No assets of this type are registered yet."
          />
        </>
      )}
    </div>
  );
}

/** "REGISTER OF FIRE ALARM PANELS" → "Register of Fire Alarm Panels". The
 *  config stores the title upper-cased for the printed sheet's band; a page
 *  heading shouting at the reader is a different thing from a document title. */
function titleCase(s: string): string {
  const minor = new Set(["of", "and", "the", "for", "in", "on", "&"]);
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && minor.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}
