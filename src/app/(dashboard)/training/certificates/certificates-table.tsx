"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Eye, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { formatDate } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EXPIRING_SOON: "bg-amber-100 text-amber-800 border-amber-200",
  EXPIRED: "bg-slate-200 text-slate-700 border-slate-300",
  LAPSED: "bg-slate-300 text-slate-800 border-slate-400",
  REVOKED: "bg-rose-100 text-rose-800 border-rose-200"
};

export interface CertificateRow {
  id: string;
  certificateNumber: string;
  holderName: string;
  holderDesignation: string | null;
  programName: string;
  programCode: string;
  isStatutory: boolean;
  issuedAt: string;
  validTo: string | null;
  status: string;
}

const columns: ColumnDef<CertificateRow>[] = [
  {
    accessorKey: "certificateNumber",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Number" />,
    cell: ({ row }) => (
      <Link href={`/training/certificates/${row.original.id}`} className="font-mono text-xs text-primary-700 hover:underline">
        {row.original.certificateNumber}
      </Link>
    ),
    size: 150
  },
  {
    accessorKey: "holderName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Holder" />,
    cell: ({ row }) => (
      <div>
        <div className="text-sm font-medium">{row.original.holderName}</div>
        {row.original.holderDesignation && (
          <div className="text-[11px] text-slate-500">{row.original.holderDesignation}</div>
        )}
      </div>
    ),
    size: 180
  },
  {
    accessorKey: "programName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Program" />,
    cell: ({ row }) => (
      <div>
        <div className="flex items-center gap-1.5 text-sm">
          {row.original.isStatutory && <ShieldAlert size={12} className="text-rose-600" />}
          {row.original.programName}
        </div>
        <div className="font-mono text-[11px] text-slate-500">{row.original.programCode}</div>
      </div>
    ),
    size: 220
  },
  {
    accessorKey: "issuedAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Issued" />,
    cell: ({ row }) => <span className="text-xs">{formatDate(row.original.issuedAt)}</span>,
    sortingFn: "datetime",
    size: 110
  },
  {
    accessorKey: "validTo",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Valid Until" />,
    cell: ({ row }) => <span className="text-xs">{row.original.validTo ? formatDate(row.original.validTo) : "Lifetime"}</span>,
    size: 120
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const Icon =
        row.original.status === "REVOKED"
          ? XCircle
          : row.original.status === "EXPIRING_SOON"
          ? AlertTriangle
          : Sparkles;
      return (
        <Badge className={STATUS_BADGE[row.original.status] ?? "bg-slate-100 text-slate-700 border-slate-200"}>
          <Icon size={11} /> {row.original.status.replace(/_/g, " ")}
        </Badge>
      );
    },
    size: 150
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Link href={`/training/certificates/${row.original.id}`} className="text-primary-700 hover:text-primary-900">
        <Eye size={16} />
      </Link>
    ),
    size: 50
  }
];

export function CertificatesTable({ data }: { data: CertificateRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="holderName"
      searchPlaceholder="Search holder or program…"
      pageSize={15}
      emptyMessage="No certificates match the current filter."
    />
  );
}
