"use client";

import Link from "next/link";
import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DeleteObservationIconButton } from "@/components/observations/delete-icon-button";
import { EditRecordIconButton } from "@/components/common/edit-icon-button";
import { SignalChipGroup } from "@/components/ai/SignalChipGroup";
import type { Signal } from "@/lib/insights";
import { formatDate, statusColor, severityColor, humanize } from "@/lib/utils";

export interface ObservationRow {
  id: string;
  number: string;
  date: string; // ISO
  plantName: string;
  areaName: string | null;
  areaId: string | null;
  type: string;
  category: string;
  description: string;
  severity: string;
  status: string;
  workflowStep: string;
  workflowColor: string;
  signals?: Signal[];
}

const columns: ColumnDef<ObservationRow>[] = [
  {
    accessorKey: "number",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Number" />,
    cell: ({ row }) => (
      <Link
        href={`/observations/${row.original.id}`}
        className="font-mono text-xs text-primary-700 hover:underline"
      >
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
    accessorKey: "type",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => {
      const isUnsafe = row.original.type.startsWith("UNSAFE");
      return (
        <Badge className={isUnsafe ? severityColor("HIGH") : severityColor("LOW")}>
          {humanize(row.original.type)}
        </Badge>
      );
    },
    size: 120
  },
  {
    accessorKey: "category",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
    cell: ({ row }) => <span className="text-sm">{humanize(row.original.category)}</span>,
    size: 140
  },
  {
    accessorKey: "description",
    header: "Description",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="max-w-[26ch] truncate text-sm text-slate-700" title={row.original.description}>
        {row.original.description}
      </div>
    )
  },
  {
    accessorKey: "severity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Severity" />,
    cell: ({ row }) => <Badge className={severityColor(row.original.severity)}>{row.original.severity}</Badge>,
    size: 110
  },
  {
    accessorKey: "workflowStep",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Workflow Step" />,
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={row.original.workflowColor}>{row.original.workflowStep}</Badge>
        <SignalChipGroup
          signals={row.original.signals ?? []}
          href={`/observations/${row.original.id}`}
        />
      </div>
    ),
    size: 220
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-3">
        <Link
          href={`/observations/${row.original.id}`}
          className="text-primary-700 hover:text-primary-900"
          title="View"
        >
          <Eye size={16} />
        </Link>
        {row.original.status !== "CLOSED" && (
          <EditRecordIconButton
            href={`/observations/${row.original.id}/edit`}
            permission="OBSERVATION.UPDATE"
            label={`Edit ${row.original.number}`}
          />
        )}
        <DeleteObservationIconButton
          observationId={row.original.id}
          observationNumber={row.original.number}
        />
      </div>
    ),
    size: 80
  }
];

export function ObservationsTable({ data }: { data: ObservationRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="number"
      searchPlaceholder="Search observations…"
      pageSize={15}
      emptyMessage="No observations match the current filter."
    />
  );
}
