"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

const CRITICALITY_COLOR: Record<string, string> = {
  A: "bg-rose-100 text-rose-800 border-rose-200",
  B: "bg-amber-100 text-amber-800 border-amber-200",
  C: "bg-blue-100 text-blue-800 border-blue-200",
  D: "bg-slate-100 text-slate-700 border-slate-200"
};

export interface EquipmentInspectionTypeRef {
  id: string;
  name: string;
  isStatutory: boolean;
}

export interface EquipmentRow {
  id: string;
  code: string;
  name: string;
  make: string | null;
  modelNumber: string | null;
  hasStatutory: boolean;
  plantCode: string;
  category: string;
  criticality: string | null;
  inspectionTypes: EquipmentInspectionTypeRef[];
  nextInspectionDue: string | null;
  isOverdue: boolean;
}

const columns: ColumnDef<EquipmentRow>[] = [
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
        <div className="flex items-center gap-1.5 font-medium">
          {row.original.hasStatutory && <ShieldAlert size={12} className="text-rose-600" />}
          {row.original.name}
        </div>
        {(row.original.make || row.original.modelNumber) && (
          <div className="text-xs text-slate-500">
            {[row.original.make, row.original.modelNumber].filter(Boolean).join(" / ")}
          </div>
        )}
      </div>
    ),
    size: 220
  },
  {
    accessorKey: "plantCode",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plant" />,
    cell: ({ row }) => <span className="text-xs">{row.original.plantCode}</span>,
    size: 90
  },
  {
    accessorKey: "category",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
    cell: ({ row }) => <span className="text-xs">{row.original.category}</span>,
    size: 140
  },
  {
    accessorKey: "criticality",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Crit." />,
    cell: ({ row }) =>
      row.original.criticality ? (
        <Badge className={CRITICALITY_COLOR[row.original.criticality] ?? ""}>{row.original.criticality}</Badge>
      ) : null,
    size: 80
  },
  {
    id: "inspectionTypes",
    header: "Inspection Types",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.inspectionTypes.length === 0 ? (
        <span className="text-xs text-amber-700">No types linked</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {row.original.inspectionTypes.slice(0, 3).map((l) => (
            <Badge key={l.id} className="bg-slate-100 text-slate-700 border-slate-200">
              {l.isStatutory && <ShieldAlert size={8} className="text-rose-600" />}
              {l.name}
            </Badge>
          ))}
          {row.original.inspectionTypes.length > 3 && (
            <span className="text-xs text-slate-400">+{row.original.inspectionTypes.length - 3}</span>
          )}
        </div>
      ),
    size: 220
  },
  {
    accessorKey: "nextInspectionDue",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Next Due" />,
    cell: ({ row }) =>
      row.original.nextInspectionDue ? (
        <span className={row.original.isOverdue ? "text-xs font-semibold text-rose-700" : "text-xs text-slate-700"}>
          {new Date(row.original.nextInspectionDue).toLocaleDateString()}
          {row.original.isOverdue && " (overdue)"}
        </span>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      ),
    sortingFn: "datetime",
    size: 130
  },
  // Equipment detail page (/inspections/equipment/[id]) is not yet implemented.
  // The "actions" column is omitted entirely so users don't hit a 404 when
  // clicking through. Re-introduce when the detail/edit page lands.
];

export function EquipmentTable({ data }: { data: EquipmentRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search equipment…"
      pageSize={20}
      emptyMessage="No equipment matches filters."
      exportFileName="equipment-master"
    />
  );
}
