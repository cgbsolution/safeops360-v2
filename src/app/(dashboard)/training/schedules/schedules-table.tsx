"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { formatDate } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  PUBLISHED: "bg-blue-100 text-blue-800 border-blue-200",
  NOMINATIONS_OPEN: "bg-violet-100 text-violet-800 border-violet-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
  POSTPONED: "bg-slate-200 text-slate-600 border-slate-300"
};

export interface ScheduleRow {
  id: string;
  scheduleNumber: string;
  programName: string;
  isStatutory: boolean;
  plantName: string;
  venue: string;
  startDate: string;
  endDate: string;
  trainerLabel: string;
  registrationsCount: number;
  maxParticipants: number;
  sessionsCount: number;
  status: string;
}

const columns: ColumnDef<ScheduleRow>[] = [
  {
    accessorKey: "scheduleNumber",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Number" />,
    cell: ({ row }) => (
      <Link href={`/training/schedules/${row.original.id}`} className="font-mono text-xs text-primary-700 hover:underline">
        {row.original.scheduleNumber}
      </Link>
    ),
    size: 130
  },
  {
    accessorKey: "programName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Program" />,
    cell: ({ row }) => (
      <div>
        <div className="font-medium text-slate-900">{row.original.programName}</div>
        {row.original.isStatutory && (
          <Badge className="mt-0.5 bg-rose-100 text-rose-800 border-rose-200">Statutory</Badge>
        )}
      </div>
    ),
    size: 220
  },
  {
    id: "plant",
    accessorFn: (r) => `${r.plantName} ${r.venue}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plant / Venue" />,
    cell: ({ row }) => (
      <div className="text-xs">
        <div className="font-medium">{row.original.plantName}</div>
        <div className="text-slate-500">{row.original.venue}</div>
      </div>
    ),
    size: 180
  },
  {
    accessorKey: "startDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Dates" />,
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-xs">
        <div>{formatDate(row.original.startDate)}</div>
        <div className="text-slate-500">to {formatDate(row.original.endDate)}</div>
      </div>
    ),
    sortingFn: "datetime",
    size: 130
  },
  {
    accessorKey: "trainerLabel",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Trainer" />,
    cell: ({ row }) => <span className="text-xs">{row.original.trainerLabel}</span>,
    size: 160
  },
  {
    id: "registrations",
    accessorFn: (r) => r.registrationsCount,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Registrations" />,
    cell: ({ row }) => (
      <div className="text-xs">
        {row.original.registrationsCount} / {row.original.maxParticipants}
        <div className="text-slate-500">
          {row.original.sessionsCount} session{row.original.sessionsCount === 1 ? "" : "s"}
        </div>
      </div>
    ),
    size: 130
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge className={STATUS_BADGE[row.original.status] ?? "bg-slate-100 text-slate-700 border-slate-200"}>
        {row.original.status.replace(/_/g, " ")}
      </Badge>
    ),
    size: 150
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Link href={`/training/schedules/${row.original.id}`} className="text-primary-700 hover:text-primary-900" title="View schedule">
        <Eye size={16} />
      </Link>
    ),
    size: 50
  }
];

export function SchedulesTable({ data }: { data: ScheduleRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="scheduleNumber"
      searchPlaceholder="Search schedules…"
      pageSize={15}
      emptyMessage="No schedules match the current filter."
      exportFileName="training-schedules"
    />
  );
}
