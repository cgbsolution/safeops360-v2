"use client";

// Shared inline pencil that links to a record's edit page. Permission-gated
// via <Can> so only roles holding the module's UPDATE permission see it.
// The caller decides WHETHER to render it (e.g. only while the record is still
// open) — this component only handles the permission gate + navigation. The
// backend independently enforces the open-only rule.

import Link from "next/link";
import { Pencil } from "lucide-react";
import { Can } from "@/components/auth/can";

export function EditRecordIconButton({
  href,
  permission,
  label = "Edit"
}: {
  href: string;
  permission: string;
  label?: string;
}) {
  return (
    <Can permission={permission}>
      <Link
        href={href}
        title={label}
        onClick={(e) => e.stopPropagation()}
        className="text-slate-500 hover:text-primary-700"
      >
        <Pencil size={16} />
      </Link>
    </Can>
  );
}
