import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { Can } from "@/components/auth/can";
import { requirePermission } from "@/lib/auth/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  TEMPLATE_STATUS_CHIP, fmtDate, labelize, engagementTypeLabel,
  type TemplateListResponse,
} from "../lib-cams";
import type { AuditLibrary } from "../audits/lib";
import { NewTemplateButton } from "./new-template";
import { ImportLibraryButton } from "./import-library";

export const dynamic = "force-dynamic";

export default async function TemplateLibraryPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("CAMS.READ");
  const sp = await props.searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const query: Record<string, string> = {};
  for (const k of ["status", "engagementType", "standard", "q"]) {
    const v = get(k);
    if (v) query[k] = v;
  }

  const session = await getServerSession(authOptions);
  const ownerId = (session?.user as any)?.id as string | undefined;

  let data: TemplateListResponse = { items: [], total: 0, statusCounts: {} };
  let error: string | null = null;
  try {
    data = await backendFetch<TemplateListResponse>("/api/cams/templates", { query });
  } catch (e: any) {
    error = e?.message ?? "Failed to load templates";
  }

  // Audit checkpoint libraries — the source the audit flow materializes from.
  let libraries: AuditLibrary[] = [];
  try {
    libraries = (await backendFetch<{ libraries: AuditLibrary[] }>("/api/audit-compliance/library")).libraries;
  } catch {
    libraries = [];
  }

  const spStr: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") spStr[k] = v;
    else if (Array.isArray(v) && v[0]) spStr[k] = v[0];
  }
  const statusChip = (value: string, label: string) => {
    const next = new URLSearchParams(spStr);
    const active = get("status") === value;
    if (active) next.delete("status"); else next.set("status", value);
    return (
      <Link key={value} href={`/cams/templates?${next.toString()}`}
        className={"rounded-full border px-3 py-1 text-xs font-medium transition-colors " + (active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")}>
        {label} {data.statusCounts[value] != null && <span className="tabular-nums opacity-70">{data.statusCounts[value]}</span>}
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="Templates & Libraries"
        description="Two checklist sources: audit checkpoint libraries (per-industry discipline→checkpoint sets the audit flow materializes from — supports ≈1500 checkpoints via import) and clause-mapped inspection templates."
        breadcrumbs={[{ label: "CAMS", href: "/cams" }, { label: "Templates" }]}
        action={<Can permission="CAMS.TEMPLATE_AUTHOR"><NewTemplateButton ownerId={ownerId ?? ""} /></Can>}
      />

      {/* Audit checkpoint libraries — source for the ComplianceAudit flow. */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Audit Checkpoint Libraries</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{libraries.length}</span>
          <span className="text-xs text-slate-500">— per-industry discipline → checkpoint sets that audits materialize from</span>
          <div className="ml-auto"><Can permission="AUDIT_COMPLIANCE.CREATE"><ImportLibraryButton /></Can></div>
        </div>
        {libraries.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">No audit libraries yet. Import one to enable the audit flow (supports ≈1500 checkpoints).</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {libraries.map((lib) => (
              <div key={lib.industryCode} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{lib.industryName}</span>
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">{lib.checkpointCount} cp</span>
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-slate-400">{lib.industryCode} · v{lib.version}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {lib.categories.slice(0, 6).map((c) => (
                    <span key={c.category_code} className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: c.category_color || "#94a3b8" }} />
                      {c.category_name} <span className="tabular-nums text-slate-400">{c.checkpointCount}</span>
                    </span>
                  ))}
                  {lib.categories.length > 6 && <span className="text-[10px] text-slate-400">+{lib.categories.length - 6} more</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error}</div>
      ) : (
        <>
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Inspection Templates</h2>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
            {["DRAFT", "IN_REVIEW", "APPROVED", "RETIRED"].map((s) => statusChip(s, labelize(s)))}
            <span className="ml-auto text-xs text-slate-500">{data.total} template(s)</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Applies to</th>
                  <th className="px-3 py-2.5">Standards</th>
                  <th className="px-3 py-2.5 text-center">Sections</th>
                  <th className="px-3 py-2.5 text-center">Questions</th>
                  <th className="px-3 py-2.5 text-center">Clauses</th>
                  <th className="px-3 py-2.5">Ver</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Owner</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr><td colSpan={10} className="px-3 py-10 text-center text-sm text-slate-400">No templates match the current filter.</td></tr>
                ) : (
                  data.items.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <td className="px-3 py-2.5"><Link href={`/cams/templates/${t.id}`} className="font-medium text-primary-700 hover:underline">{t.templateCode}</Link></td>
                      <td className="max-w-[240px] px-3 py-2.5 text-slate-700">{t.name}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{t.applicableEngagementTypes.map(engagementTypeLabel).join(", ") || "Any"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{t.standardRefs.map((s) => s.replace("_", " ")).join(", ") || "—"}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{t.sectionCount}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{t.questionCount}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{t.clauseCount}</td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-500">v{t.version}</td>
                      <td className="px-3 py-2.5"><span className={"rounded border px-2 py-0.5 text-[11px] " + (TEMPLATE_STATUS_CHIP[t.status] ?? "")}>{labelize(t.status)}</span></td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{t.ownerName ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
