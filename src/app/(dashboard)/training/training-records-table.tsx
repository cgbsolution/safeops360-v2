"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, CheckCircle2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DeleteTrainingIconButton } from "@/components/training/delete-icon-button";
import { formatDate } from "@/lib/utils";

export type TrainingClass = "all" | "valid" | "expiring" | "expired" | "failed";

export interface TrainingRow {
  id: string;
  employeeName: string;
  employeeDept: string | null;
  programName: string;
  programCode: string;
  date: string;
  passed: boolean;
  score: number | null;
  validUntil: string;
  klass: Exclude<TrainingClass, "all">;
  daysToExpiry: number;
}

const columns: ColumnDef<TrainingRow>[] = [
  {
    accessorKey: "employeeName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
    cell: ({ row }) => (
      <div className="text-sm">
        <div className="font-medium text-slate-900">{row.original.employeeName}</div>
        <div className="text-xs text-slate-500">{row.original.employeeDept ?? "—"}</div>
      </div>
    ),
    size: 180
  },
  {
    accessorKey: "programName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Program" />,
    cell: ({ row }) => (
      <div className="text-sm">
        <div className="font-medium text-slate-900">{row.original.programName}</div>
        <div className="font-mono text-xs text-slate-500">{row.original.programCode}</div>
      </div>
    ),
    size: 200
  },
  {
    accessorKey: "date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => <span className="whitespace-nowrap text-sm">{formatDate(row.original.date)}</span>,
    sortingFn: "datetime",
    size: 110
  },
  {
    accessorKey: "score",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Score" />,
    cell: ({ row }) =>
      row.original.passed ? (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
          <CheckCircle2 size={14} /> {row.original.score ?? "—"}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-rose-700">
          <AlertCircle size={14} /> Failed{row.original.score !== null ? ` (${row.original.score})` : ""}
        </span>
      ),
    size: 130
  },
  {
    accessorKey: "validUntil",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Validity" />,
    cell: ({ row }) => {
      const { klass, validUntil, daysToExpiry } = row.original;
      if (klass === "expired") return <Badge className="bg-rose-100 text-rose-800 border-rose-200">Expired {formatDate(validUntil)}</Badge>;
      if (klass === "expiring") return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Expires in {daysToExpiry}d</Badge>;
      if (klass === "failed") return <Badge className="bg-slate-100 text-slate-700 border-slate-200">No certificate</Badge>;
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Valid till {formatDate(validUntil)}</Badge>;
    },
    size: 180
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-3">
        <Link href={`/training/${row.original.id}`} className="text-primary-700 hover:text-primary-900" title="View record">
          <Eye size={16} />
        </Link>
        <DeleteTrainingIconButton recordId={row.original.id} label={`${row.original.employeeName} · ${row.original.programName}`} />
      </div>
    ),
    size: 80
  }
];

export function TrainingRecordsTable({ data }: { data: TrainingRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="employeeName"
      searchPlaceholder="Search employee or program…"
      pageSize={15}
      emptyMessage="No training records match the current filter."
    />
  );
}
