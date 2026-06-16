"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-rose-100 text-rose-800 border-rose-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  DEFERRED: "bg-slate-200 text-slate-600 border-slate-300",
  DUPLICATE: "bg-slate-100 text-slate-500 border-slate-200",
  CLOSED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  VERIFIED: "bg-emerald-600 text-white border-emerald-700"
};

const SEV_BADGE: Record<string, string> = {
  CRITICAL: "bg-rose-600 text-white",
  HIGH: "bg-rose-100 text-rose-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-slate-100 text-slate-700"
};

export interface FindingRow {
  id: string;
  findingNumber: string;
  title: string;
  isCritical: boolean;
  inspectionId: string;
  inspectionNumber: string;
  severity: string;
  plantCode: string;
  ownerName: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  capasCount: number;
  status: string;
}

const columns: ColumnDef<FindingRow>[] = [
  {
    accessorKey: "findingNumber",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Number" />,
    cell: ({ row }) => (
      <Link href={`/inspections/findings/${row.original.id}`} className="font-mono text-xs text-primary-700 hover:underline">
        {row.original.findingNumber}
      </Link>
    ),
    size: 130
  },
  {
    accessorKey: "title",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
    cell: ({ row }) => (
      <div>
        <div className="flex items-center gap-1 font-medium">
          {row.original.isCritical && <Star size={11} className="fill-rose-600 text-rose-600" />}
          {row.original.title}
        </div>
        <Link href={`/inspections/${row.original.inspectionId}`} className="text-xs text-primary-700 hover:underline">
          From {row.original.inspectionNumber}
        </Link>
      </div>
    ),
    size: 260
  },
  {
    accessorKey: "severity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Severity" />,
    cell: ({ row }) => <Badge className={SEV_BADGE[row.original.severity]}>{row.original.severity}</Badge>,
    size: 110
  },
  {
    accessorKey: "plantCode",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plant" />,
    cell: ({ row }) => <span className="text-xs">{row.original.plantCode}</span>,
    size: 90
  },
  {
    accessorKey: "ownerName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Owner" />,
    cell: ({ row }) =>
      row.original.ownerName ? (
        <span className="text-xs">{row.original.ownerName}</span>
      ) : (
        <span className="text-xs text-slate-400">— unassigned</span>
      ),
    size: 140
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Due" />,
    cell: ({ row }) =>
      row.original.dueDate ? (
        <span className={row.original.isOverdue ? "text-xs font-semibold text-rose-700" : "text-xs"}>
          {new Date(row.original.dueDate).toLocaleDateString()}
          {row.original.isOverdue && " (overdue)"}
        </span>
      ) : (
        <span className="text-xs">—</span>
      ),
    sortingFn: "datetime",
    size: 130
  },
  {
    accessorKey: "capasCount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="CAPAs" />,
    cell: ({ row }) => <span className="text-xs">{row.original.capasCount}</span>,
    size: 80
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge className={STATUS_BADGE[row.original.status] ?? "bg-slate-100 text-slate-700 border-slate-200"}>
        {row.original.status.replace(/_/g, " ")}
      </Badge>
    ),
    size: 140
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Link href={`/inspections/findings/${row.original.id}`} className="text-primary-700">
        <Eye size={14} />
      </Link>
    ),
    size: 50
  }
];

export function FindingsTable({ data }: { data: FindingRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="title"
      searchPlaceholder="Search findings…"
      pageSize={15}
      emptyMessage="No findings match the current filter."
    />
  );
}
