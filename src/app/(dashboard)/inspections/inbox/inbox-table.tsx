"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheck, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

const STATUS_BADGE: Record<string, string> = {
  SCHEDULED: "bg-slate-100 text-slate-700 border-slate-200",
  DUE: "bg-amber-100 text-amber-800 border-amber-200",
  OVERDUE: "bg-rose-100 text-rose-800 border-rose-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200"
};

export interface InboxRow {
  id: string;
  number: string | null;
  equipmentName: string;
  equipmentCode: string;
  isStatutory: boolean;
  plantCode: string;
  inspectionTypeName: string | null;
  scheduledDate: string;
  status: string;
}

const columns: ColumnDef<InboxRow>[] = [
  {
    accessorKey: "number",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Number" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.number ?? row.original.id.slice(0, 8)}</span>,
    size: 130
  },
  {
    accessorKey: "equipmentName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Equipment" />,
    cell: ({ row }) => (
      <div>
        <div className="flex items-center gap-1.5 font-medium">
          {row.original.isStatutory && <ShieldAlert size={12} className="text-rose-600" />}
          {row.original.equipmentName}
        </div>
        <div className="text-xs text-slate-500">{row.original.equipmentCode}</div>
      </div>
    ),
    size: 220
  },
  {
    accessorKey: "plantCode",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plant" />,
    cell: ({ row }) => <span className="text-xs">{row.original.plantCode}</span>,
    size: 100
  },
  {
    accessorKey: "inspectionTypeName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => <span className="text-xs">{row.original.inspectionTypeName ?? "—"}</span>,
    size: 180
  },
  {
    accessorKey: "scheduledDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Scheduled" />,
    cell: ({ row }) => <span className="text-xs">{new Date(row.original.scheduledDate).toLocaleDateString()}</span>,
    sortingFn: "datetime",
    size: 110
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge className={STATUS_BADGE[row.original.status] ?? "bg-slate-100 text-slate-700 border-slate-200"}>
        {row.original.status.replace(/_/g, " ")}
      </Badge>
    ),
    size: 130
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Link href={`/inspections/${row.original.id}`} className="text-sm font-medium text-primary-700 hover:text-primary-900">
        <ClipboardCheck size={14} className="mr-1 inline" />
        Open
      </Link>
    ),
    size: 90
  }
];

export function InspectionInboxTable({ data }: { data: InboxRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="equipmentName"
      searchPlaceholder="Search equipment…"
      pageSize={15}
      emptyMessage="No inspections assigned to you. Inspections are auto-generated from equipment master schedules."
      exportFileName="my-inspections"
    />
  );
}
