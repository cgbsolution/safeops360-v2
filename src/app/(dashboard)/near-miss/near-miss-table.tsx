"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DeleteNearMissIconButton } from "@/components/near-miss/delete-icon-button";
import { SignalChip } from "@/components/ai/SignalChip";
import type { Signal } from "@/lib/insights";
import { formatDate, severityColor } from "@/lib/utils";

export interface NearMissRow {
  id: string;
  number: string;
  date: string;
  plantName: string;
  location: string;
  description: string;
  potentialSeverity: string;
  promotedToIncident: boolean;
  workflowStep: string;
  workflowColor: string;
  signal?: Signal | null;
}

const columns: ColumnDef<NearMissRow>[] = [
  {
    accessorKey: "number",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Number" />,
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/near-miss/${row.original.id}`} className="font-mono text-xs text-primary-700 hover:underline">
          {row.original.number}
        </Link>
        {row.original.promotedToIncident && (
          <Badge className="bg-rose-100 text-rose-700 border-rose-200">
            <ArrowUpRight size={10} /> Promoted
          </Badge>
        )}
      </div>
    ),
    size: 180
  },
  {
    accessorKey: "date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => <span className="whitespace-nowrap text-sm">{formatDate(row.original.date)}</span>,
    sortingFn: "datetime",
    size: 110
  },
  {
    id: "plant",
    accessorFn: (r) => `${r.plantName} ${r.location}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plant / Location" />,
    cell: ({ row }) => (
      <div className="text-sm">
        <div className="font-medium text-slate-900">{row.original.plantName}</div>
        {row.original.location && <div className="text-xs text-slate-500">{row.original.location}</div>}
      </div>
    ),
    size: 180
  },
  {
    accessorKey: "description",
    header: "Description",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="max-w-[30ch] truncate text-sm" title={row.original.description}>
        {row.original.description}
      </div>
    )
  },
  {
    accessorKey: "potentialSeverity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Potential" />,
    cell: ({ row }) => (
      <Badge className={severityColor(row.original.potentialSeverity)}>{row.original.potentialSeverity}</Badge>
    ),
    size: 110
  },
  {
    accessorKey: "workflowStep",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Workflow Step" />,
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={row.original.workflowColor}>{row.original.workflowStep}</Badge>
        {row.original.signal && (
          <SignalChip signal={row.original.signal} href={`/near-miss/${row.original.id}`} />
        )}
      </div>
    ),
    size: 190
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-3">
        <Link href={`/near-miss/${row.original.id}`} className="text-primary-700 hover:text-primary-900" title="View">
          <Eye size={16} />
        </Link>
        <DeleteNearMissIconButton nearMissId={row.original.id} nearMissNumber={row.original.number} />
      </div>
    ),
    size: 80
  }
];

export function NearMissTable({ data }: { data: NearMissRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="number"
      searchPlaceholder="Search near-miss records…"
      pageSize={15}
      emptyMessage="No near-miss records match the current filter."
    />
  );
}
