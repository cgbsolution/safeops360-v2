"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, Lock, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RETIRED: "bg-slate-200 text-slate-500 border-slate-300"
};

const CATEGORY_BADGE: Record<string, string> = {
  STATUTORY: "bg-rose-50 text-rose-700 border-rose-200",
  TECHNICAL: "bg-blue-50 text-blue-700 border-blue-200",
  BEHAVIOURAL: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INDUCTION: "bg-violet-50 text-violet-700 border-violet-200",
  EMERGENCY: "bg-orange-50 text-orange-700 border-orange-200",
  LEADERSHIP: "bg-indigo-50 text-indigo-700 border-indigo-200",
  COMPLIANCE: "bg-amber-50 text-amber-700 border-amber-200",
  REFRESHER: "bg-teal-50 text-teal-700 border-teal-200"
};

export interface ProgramRow {
  id: string;
  code: string;
  name: string;
  isStatutory: boolean;
  statutoryReference: string | null;
  category: string | null;
  validityMonths: number | null;
  mandatoryFor: string[];
  gates: string[];
  approvalStatus: string;
}

const columns: ColumnDef<ProgramRow>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
    size: 120
  },
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <div>
        <div className="flex items-center gap-1.5 font-medium text-slate-900">
          {row.original.isStatutory && <ShieldAlert size={12} className="text-rose-600" />}
          {row.original.name}
        </div>
        {row.original.statutoryReference && (
          <div className="text-[11px] text-rose-700">{row.original.statutoryReference}</div>
        )}
      </div>
    ),
    size: 240
  },
  {
    accessorKey: "category",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
    cell: ({ row }) =>
      row.original.category ? (
        <Badge className={CATEGORY_BADGE[row.original.category] ?? "bg-slate-100 text-slate-700 border-slate-200"}>
          {row.original.category}
        </Badge>
      ) : null,
    size: 130
  },
  {
    accessorKey: "validityMonths",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Validity" />,
    cell: ({ row }) => (
      <span className="text-xs">{row.original.validityMonths ? `${row.original.validityMonths} months` : "Lifetime"}</span>
    ),
    size: 110
  },
  {
    id: "mandatoryFor",
    header: "Mandatory For",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.mandatoryFor.length === 0 ? (
        <span className="text-slate-400">—</span>
      ) : (
        <div className="space-y-0.5 text-xs text-slate-600">
          {row.original.mandatoryFor.map((m) => (
            <div key={m}>{m}</div>
          ))}
        </div>
      ),
    size: 160
  },
  {
    id: "gates",
    header: "SafeOps Gates",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.gates.length === 0 ? (
        <span className="text-xs text-slate-400">—</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {row.original.gates.map((g) => (
            <Badge key={g} className="bg-amber-50 text-amber-800 border-amber-200">
              <Lock size={9} /> {g}
            </Badge>
          ))}
        </div>
      ),
    size: 160
  },
  {
    accessorKey: "approvalStatus",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge className={STATUS_BADGE[row.original.approvalStatus] ?? "bg-slate-100 text-slate-700 border-slate-200"}>
        {row.original.approvalStatus.replace(/_/g, " ")}
      </Badge>
    ),
    size: 140
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Link href={`/training/programs/${row.original.id}`} className="text-primary-700 hover:text-primary-900" title="View / edit program">
        <Eye size={16} />
      </Link>
    ),
    size: 50
  }
];

export function ProgramsTable({ data }: { data: ProgramRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search programs…"
      pageSize={15}
      emptyMessage="No programs match the current filter."
    />
  );
}
