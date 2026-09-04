"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RETIRED: "bg-slate-200 text-slate-500 border-slate-300"
};

export interface ChecklistRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  inspectionTypeId: string;
  inspectionTypeName: string;
  inspectionTypeIsStatutory: boolean;
  version: number;
  itemsCount: number;
  inspectionsCount: number;
  approvalStatus: string;
}

const columns: ColumnDef<ChecklistRow>[] = [
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
        <div className="font-medium">{row.original.name}</div>
        {row.original.description && (
          <div className="max-w-md truncate text-xs text-slate-500">{row.original.description}</div>
        )}
      </div>
    ),
    size: 280
  },
  {
    accessorKey: "inspectionTypeName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Inspection Type" />,
    cell: ({ row }) => (
      <Link href={`/inspections/types/${row.original.inspectionTypeId}`} className="flex items-center gap-1 text-xs text-primary-700 hover:underline">
        {row.original.inspectionTypeIsStatutory && <ShieldAlert size={10} className="text-rose-600" />}
        {row.original.inspectionTypeName}
      </Link>
    ),
    size: 180
  },
  {
    accessorKey: "version",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Version" />,
    cell: ({ row }) => <span className="text-xs">v{row.original.version}</span>,
    size: 80
  },
  {
    accessorKey: "itemsCount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Items" />,
    cell: ({ row }) => <span className="text-xs text-slate-600">{row.original.itemsCount}</span>,
    size: 80
  },
  {
    accessorKey: "inspectionsCount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Used in" />,
    cell: ({ row }) => <span className="text-xs text-slate-600">{row.original.inspectionsCount} insp</span>,
    size: 100
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
      <Link href={`/inspections/checklists/${row.original.id}`} className="text-primary-700 hover:text-primary-900" title="View / edit">
        <Eye size={16} />
      </Link>
    ),
    size: 50
  }
];

export function ChecklistsTable({ data }: { data: ChecklistRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search checklists…"
      pageSize={15}
      emptyMessage="No checklist templates match the current filter."
      exportFileName="inspection-checklists"
    />
  );
}
