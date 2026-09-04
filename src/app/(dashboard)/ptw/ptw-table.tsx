"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DeletePermitIconButton } from "@/components/ptw/delete-icon-button";
import { formatDate, humanize } from "@/lib/utils";

export interface PermitRow {
  id: string;
  number: string;
  type: string;
  typeColor: string;
  plantName: string;
  areaName: string | null;
  scopeOfWork: string;
  validFrom: string;
  validTo: string;
  workflowStep: string;
  workflowColor: string;
}

const columns: ColumnDef<PermitRow>[] = [
  {
    accessorKey: "number",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Number" />,
    cell: ({ row }) => (
      <Link href={`/ptw/${row.original.id}`} className="font-mono text-xs text-primary-700 hover:underline">
        {row.original.number}
      </Link>
    ),
    size: 140
  },
  {
    accessorKey: "type",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => <Badge className={row.original.typeColor}>{humanize(row.original.type)}</Badge>,
    size: 150
  },
  {
    id: "plant",
    accessorFn: (r) => `${r.plantName} ${r.areaName ?? ""}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plant / Area" />,
    cell: ({ row }) => (
      <div className="text-sm">
        <div className="font-medium text-slate-900">{row.original.plantName}</div>
        {row.original.areaName && <div className="text-xs text-slate-500">{row.original.areaName}</div>}
      </div>
    ),
    size: 180
  },
  {
    accessorKey: "scopeOfWork",
    header: "Scope",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="max-w-[28ch] truncate text-sm" title={row.original.scopeOfWork}>
        {row.original.scopeOfWork}
      </div>
    )
  },
  {
    accessorKey: "validFrom",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Validity" />,
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-xs">
        <div>{formatDate(row.original.validFrom)}</div>
        <div className="text-slate-500">to {formatDate(row.original.validTo)}</div>
      </div>
    ),
    sortingFn: "datetime",
    size: 130
  },
  {
    accessorKey: "workflowStep",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Workflow Step" />,
    cell: ({ row }) => <Badge className={row.original.workflowColor}>{row.original.workflowStep}</Badge>,
    size: 180
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-3">
        <Link href={`/ptw/${row.original.id}`} className="text-primary-700 hover:text-primary-900" title="View">
          <Eye size={16} />
        </Link>
        <DeletePermitIconButton permitId={row.original.id} permitNumber={row.original.number} />
      </div>
    ),
    size: 80
  }
];

export function PtwTable({ data }: { data: PermitRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="number"
      searchPlaceholder="Search permits…"
      pageSize={15}
      emptyMessage="No permits match the current filter."
      exportFileName="permits"
      getRowLabel={(row) => row.number}
      bulkDelete={{
        endpoint: "/api/ptw",
        permission: "PTW.DELETE",
        entityLabel: "permit"
      }}
    />
  );
}
