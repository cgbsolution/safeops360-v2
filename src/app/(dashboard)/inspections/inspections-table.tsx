"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DeleteInspectionIconButton } from "@/components/inspections/delete-icon-button";
import { formatDate, humanize, statusColor } from "@/lib/utils";

export interface InspectionRow {
  id: string;
  number: string | null;
  equipmentName: string;
  equipmentCategory: string;
  plantName: string;
  frequency: string;
  scheduledDate: string;
  inspectorName: string | null;
  result: string | null;
  status: string;
}

const columns: ColumnDef<InspectionRow>[] = [
  {
    accessorKey: "number",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Inspection" />,
    cell: ({ row }) => (
      <Link href={`/inspections/${row.original.id}`} className="font-mono text-xs text-primary-700 hover:underline">
        {row.original.number ?? row.original.id.slice(0, 8)}
      </Link>
    ),
    size: 140
  },
  {
    accessorKey: "equipmentName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Equipment" />,
    cell: ({ row }) => (
      <div className="text-sm">
        <div className="font-medium">{row.original.equipmentName}</div>
        <div className="text-xs text-slate-500">{row.original.equipmentCategory}</div>
      </div>
    ),
    size: 200
  },
  {
    accessorKey: "plantName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plant" />,
    cell: ({ row }) => <span className="text-sm">{row.original.plantName}</span>,
    size: 150
  },
  {
    accessorKey: "frequency",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Frequency" />,
    cell: ({ row }) => <span className="text-xs">{humanize(row.original.frequency)}</span>,
    size: 110
  },
  {
    accessorKey: "scheduledDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Scheduled" />,
    cell: ({ row }) => <span className="whitespace-nowrap text-sm">{formatDate(row.original.scheduledDate)}</span>,
    sortingFn: "datetime",
    size: 110
  },
  {
    accessorKey: "inspectorName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Inspector" />,
    cell: ({ row }) => <span className="text-sm">{row.original.inspectorName ?? "—"}</span>,
    size: 150
  },
  {
    accessorKey: "result",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Result" />,
    cell: ({ row }) =>
      row.original.result ? (
        <Badge
          className={
            row.original.result === "Pass"
              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
              : row.original.result === "Fail"
              ? "bg-rose-100 text-rose-800 border-rose-200"
              : "bg-amber-100 text-amber-800 border-amber-200"
          }
        >
          {row.original.result}
        </Badge>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      ),
    size: 100
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => <Badge className={statusColor(row.original.status)}>{humanize(row.original.status)}</Badge>,
    size: 130
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-3">
        <Link href={`/inspections/${row.original.id}`} className="text-primary-700 hover:text-primary-900" title="View inspection">
          <Eye size={16} />
        </Link>
        <DeleteInspectionIconButton
          inspectionId={row.original.id}
          inspectionNumber={row.original.number ?? `Inspection ${row.original.id.slice(0, 6)}`}
        />
      </div>
    ),
    size: 80
  }
];

export function InspectionsTable({ data }: { data: InspectionRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="equipmentName"
      searchPlaceholder="Search inspections…"
      pageSize={15}
      emptyMessage="No inspections match the current filter."
      exportFileName="inspections"
      getRowLabel={(row) => row.number ?? row.id.slice(0, 8)}
      bulkDelete={{
        endpoint: "/api/inspections",
        permission: "INSPECTION.DELETE",
        entityLabel: "inspection"
      }}
    />
  );
}
