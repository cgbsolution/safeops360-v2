"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DeleteIncidentIconButton } from "@/components/incidents/delete-icon-button";
import { SignalChip } from "@/components/ai/SignalChip";
import type { Signal } from "@/lib/insights";
import { formatDate, formatINR, humanize } from "@/lib/utils";

export interface IncidentRow {
  id: string;
  number: string;
  date: string;
  type: string;
  typeColor: string;
  plantName: string;
  location: string;
  description: string;
  lostDays: number;
  propertyDamageCost: string | null;
  workflowStep: string;
  workflowColor: string;
  signal?: Signal | null;
}

const columns: ColumnDef<IncidentRow>[] = [
  {
    accessorKey: "number",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Number" />,
    cell: ({ row }) => (
      <Link href={`/incidents/${row.original.id}`} className="font-mono text-xs text-primary-700 hover:underline">
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
    accessorKey: "type",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => <Badge className={row.original.typeColor}>{humanize(row.original.type)}</Badge>,
    size: 140
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
      <div className="max-w-[28ch] truncate text-sm" title={row.original.description}>
        {row.original.description}
      </div>
    )
  },
  {
    accessorKey: "lostDays",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lost Days" />,
    cell: ({ row }) => (
      <div className="text-sm">
        {row.original.lostDays > 0 ? (
          <span className="font-semibold text-rose-700">{row.original.lostDays} days</span>
        ) : (
          "—"
        )}
        {row.original.propertyDamageCost && (
          <div className="text-xs text-slate-500">{formatINR(Number(row.original.propertyDamageCost))}</div>
        )}
      </div>
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
          <SignalChip signal={row.original.signal} href={`/incidents/${row.original.id}`} />
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
        <Link href={`/incidents/${row.original.id}`} className="text-primary-700 hover:text-primary-900" title="View">
          <Eye size={16} />
        </Link>
        <DeleteIncidentIconButton incidentId={row.original.id} incidentNumber={row.original.number} />
      </div>
    ),
    size: 80
  }
];

export function IncidentsTable({ data }: { data: IncidentRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="number"
      searchPlaceholder="Search incidents…"
      pageSize={15}
      emptyMessage="No incidents match the current filter."
    />
  );
}
