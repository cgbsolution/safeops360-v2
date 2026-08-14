import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { CertificatesTable, type CertificateRow } from "./certificates-table";

export const dynamic = "force-dynamic";

type Filter = "all" | "active" | "expiring" | "expired" | "lapsed" | "revoked";

// A row of /api/training/certificates. The backend enforces the OWN-vs-plant
// scope (workers see only their own), then joins the holder and programme
// names.
type CertificateListItem = {
  id: string;
  certificateNumber: string;
  /** ISO strings over the wire, not Dates. */
  issuedAt: string;
  validTo: string | null;
  status: string;
  holderName: string | null;
  holderDesignation: string | null;
  programName: string | null;
  programCode: string | null;
  programIsStatutory: boolean;
};

export default async function CertificatesPage(props: { searchParams: Promise<{ filter?: Filter }> }) {
  const searchParams = await props.searchParams;
  const filter = (searchParams.filter ?? "all") as Filter;

  const STATUS_BY_FILTER: Record<Filter, string | undefined> = {
    all: undefined,
    active: "ACTIVE",
    expiring: "EXPIRING_SOON",
    expired: "EXPIRED",
    lapsed: "LAPSED",
    revoked: "REVOKED"
  };

  const register = await backendFetch<{
    items: CertificateListItem[];
    statusCounts: Record<string, number>;
  }>("/api/training/certificates", {
    query: { status_filter: STATUS_BY_FILTER[filter] }
  }).catch(() => ({
    items: [] as CertificateListItem[],
    statusCounts: {} as Record<string, number>
  }));

  const certs = register.items;
  // Counts describe the caller's whole visible set, not the filtered slice.
  const cnt = (s: string) => register.statusCounts[s] ?? 0;

  const rows: CertificateRow[] = certs.map((c) => ({
    id: c.id,
    certificateNumber: c.certificateNumber,
    holderName: c.holderName ?? "—",
    holderDesignation: c.holderDesignation,
    programName: c.programName ?? "—",
    programCode: c.programCode ?? "—",
    isStatutory: c.programIsStatutory,
    issuedAt: c.issuedAt,
    validTo: c.validTo,
    status: c.status
  }));

  return (
    <div>
      <PageHeader
        title="Training Certificates"
        description="All issued certifications with state-machine status. Revoked / expired certificates fail SafeOps gates."
        breadcrumbs={[{ label: "Training", href: "/training" }, { label: "Certificates" }]}
        action={
          <form action="/api/training/certificates/admin/refresh-states" method="POST">
            <button
              type="submit"
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
            >
              Refresh state machine
            </button>
          </form>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Chip href="/training/certificates?filter=all" active={filter === "all"} label="All" count={certs.length} />
        <Chip href="/training/certificates?filter=active" active={filter === "active"} label="Active" count={cnt("ACTIVE")} tone="emerald" />
        <Chip href="/training/certificates?filter=expiring" active={filter === "expiring"} label="Expiring Soon" count={cnt("EXPIRING_SOON")} tone="amber" />
        <Chip href="/training/certificates?filter=expired" active={filter === "expired"} label="Expired" count={cnt("EXPIRED")} tone="slate" />
        <Chip href="/training/certificates?filter=lapsed" active={filter === "lapsed"} label="Lapsed" count={cnt("LAPSED")} tone="slate" />
        <Chip href="/training/certificates?filter=revoked" active={filter === "revoked"} label="Revoked" count={cnt("REVOKED")} tone="rose" />
      </div>

      <CertificatesTable data={rows} />
    </div>
  );
}

function Chip({
  href,
  active,
  label,
  count,
  tone = "primary"
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  tone?: "primary" | "emerald" | "amber" | "rose" | "slate";
}) {
  const t: Record<string, string> = {
    primary: "bg-primary-600 text-white border-primary-600",
    emerald: "bg-emerald-600 text-white border-emerald-600",
    amber: "bg-amber-600 text-white border-amber-600",
    rose: "bg-rose-600 text-white border-rose-600",
    slate: "bg-slate-700 text-white border-slate-700"
  };
  return (
    <Link
      href={href}
      className={[
        "rounded-full border px-3 py-1 text-xs font-medium",
        active ? t[tone] : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
      ].join(" ")}
    >
      {label} <span className="opacity-70">({count})</span>
    </Link>
  );
}
