"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

export interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  usersCount: number;
  permissionsCount: number;
  isActive: boolean;
}

const columns: ColumnDef<RoleRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 font-medium">
        {row.original.isSystem && <Shield size={12} className="text-primary-600" />}
        {row.original.name}
      </div>
    ),
    size: 220
  },
  {
    accessorKey: "code",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
    size: 180
  },
  {
    accessorKey: "description",
    header: "Description",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="max-w-md truncate text-xs text-slate-600" title={row.original.description ?? ""}>
        {row.original.description ?? "—"}
      </div>
    )
  },
  {
    accessorKey: "usersCount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Users" />,
    cell: ({ row }) => <Badge>{row.original.usersCount}</Badge>,
    size: 90
  },
  {
    accessorKey: "permissionsCount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Permissions" />,
    cell: ({ row }) => <Badge className="bg-blue-50 text-blue-700">{row.original.permissionsCount}</Badge>,
    size: 130
  },
  {
    accessorKey: "isActive",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) =>
      row.original.isActive ? (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
      ) : (
        <Badge className="bg-slate-200 text-slate-500">Inactive</Badge>
      ),
    size: 110
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Link href={`/configuration/roles/${row.original.code}`} className="text-primary-700 hover:text-primary-900">
        <Eye size={16} />
      </Link>
    ),
    size: 50
  }
];

export function RolesTable({ data }: { data: RoleRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search roles…"
      pageSize={20}
      emptyMessage="No roles configured."
      exportFileName="roles"
    />
  );
}
