// AccessRestricted — a calm, full-page "you don't have access" state.
//
// Server-component friendly (no client hooks), so detail pages can return it
// directly from their data-fetch catch block when the backend answers 403
// (a row-level scope denial). This replaces the generic full-page error crash
// with a clear, non-alarming message — the record exists, the viewer just
// isn't in its scope.

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ShieldAlert } from "lucide-react";

export function AccessRestricted({
  title = "Access Restricted",
  description = "This record is outside your access scope",
  message = "It belongs to a plant, department, or scope your role isn’t permitted to view. If you believe you should have access, ask an administrator to review your permissions.",
  backHref = "/dashboard",
  backLabel = "← Back to dashboard",
  breadcrumbs
}: {
  title?: string;
  description?: string;
  message?: string;
  backHref?: string;
  backLabel?: string;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <div>
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} />
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-6 text-sm text-amber-900 max-w-2xl">
        <div className="flex items-center gap-2 font-semibold mb-1">
          <ShieldAlert size={16} /> You don’t have access to this record.
        </div>
        <p className="text-amber-800">{message}</p>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 mt-4 px-3 py-1.5 text-xs rounded border border-amber-400 bg-white hover:border-amber-500"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
