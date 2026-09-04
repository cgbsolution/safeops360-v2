"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

export interface UserRow {
  id: string;
  name: string;
  designation: string | null;
  email: string;
  primaryRole: string;
  additionalRoles: string[];
  isAdminLike: boolean;
  plantName: string | null;
  department: string | null;
}

const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <div>
        <div className="flex items-center gap-1.5 font-medium">
          {row.original.isAdminLike && <ShieldAlert size={12} className="text-rose-600" />}
          {row.original.name}
        </div>
        {row.original.designation && <div className="text-xs text-slate-500">{row.original.designation}</div>}
      </div>
    ),
    size: 200
  },
  {
    accessorKey: "email",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    cell: ({ row }) => <span className="text-xs">{row.original.email}</span>,
    size: 220
  },
  {
    accessorKey: "primaryRole",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Primary Role" />,
    cell: ({ row }) => <Badge className="bg-primary-50 text-primary-700 border-primary-200">{row.original.primaryRole}</Badge>,
    size: 150
  },
  {
    id: "additionalRoles",
    header: "Additional Roles",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.additionalRoles.length === 0 ? (
        <span className="text-xs text-slate-400">—</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {row.original.additionalRoles.map((r) => (
            <Badge key={r} className="bg-slate-100 text-slate-700 border-slate-200">
              {r}
            </Badge>
          ))}
        </div>
      ),
    size: 200
  },
  {
    accessorKey: "plantName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Plant" />,
    cell: ({ row }) => <span className="text-xs">{row.original.plantName ?? "—"}</span>,
    size: 160
  },
  {
    accessorKey: "department",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
    cell: ({ row }) => <span className="text-xs">{row.original.department ?? "—"}</span>,
    size: 140
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Link href={`/configuration/users/${row.original.id}`} className="text-primary-700 hover:text-primary-900" title="Manage user">
        <Eye size={16} />
      </Link>
    ),
    size: 50
  }
];

export function UsersTable({ data }: { data: UserRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search users…"
      pageSize={15}
      emptyMessage="No users match the current filter."
      exportFileName="users"
    />
  );
}
