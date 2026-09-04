"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DeleteFlraIconButton } from "@/components/flra/delete-icon-button";
import { formatDate } from "@/lib/utils";

export interface FlraRow {
  id: string;
  number: string;
  date: string;
  plantName: string;
  jobDescription: string;
  leaderName: string;
  permitId: string | null;
  permitNumber: string | null;
}

const columns: ColumnDef<FlraRow>[] = [
  {
    accessorKey: "number",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Number" />,
    cell: ({ row }) => (
      <Link href={`/flra/${row.original.id}`} className="font-mono text-xs text-primary-700 hover:underline">
        {row.original.number}
      </Link>
    ),
    size: 140
  },
  {
    accessorKey: "date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => <span className="whitespace-nowrap text-sm">{formatDate(row.original.date)}</span>,
    sortingFn: "datetime",
    size: 110
  },
  {
    accessorKey: "plantName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plant" />,
    cell: ({ row }) => <span className="text-sm">{row.original.plantName}</span>,
    size: 160
  },
  {
    accessorKey: "jobDescription",
    header: "Job",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="max-w-[36ch] truncate text-sm" title={row.original.jobDescription}>
        {row.original.jobDescription}
      </div>
    )
  },
  {
    accessorKey: "leaderName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Leader" />,
    cell: ({ row }) => <span className="text-sm">{row.original.leaderName}</span>,
    size: 160
  },
  {
    id: "permit",
    header: "Permit",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.permitId && row.original.permitNumber ? (
        <Link href={`/ptw/${row.original.permitId}`} className="font-mono text-xs text-primary-700 hover:underline">
          {row.original.permitNumber}
        </Link>
      ) : (
        <span className="text-xs text-slate-400">Standalone</span>
      ),
    size: 130
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-3">
        <Link href={`/flra/${row.original.id}`} className="text-primary-700 hover:text-primary-900" title="View FLRA">
          <Eye size={16} />
        </Link>
        <DeleteFlraIconButton flraId={row.original.id} flraNumber={row.original.number} />
      </div>
    ),
    size: 80
  }
];

export function FlraTable({ data }: { data: FlraRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="number"
      searchPlaceholder="Search FLRAs…"
      pageSize={15}
      emptyMessage="No FLRAs found."
      exportFileName="flra-register"
      getRowLabel={(row) => row.number}
      bulkDelete={{
        endpoint: "/api/flra",
        permission: "FLRA.DELETE",
        entityLabel: "FLRA"
      }}
    />
  );
}
