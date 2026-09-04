"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Calendar, Eye, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";

const CATEGORY_BADGE: Record<string, string> = {
  ROUTINE: "bg-slate-100 text-slate-700 border-slate-200",
  STATUTORY: "bg-rose-50 text-rose-700 border-rose-200",
  PRE_OPERATIONAL: "bg-blue-50 text-blue-700 border-blue-200",
  POST_INCIDENT: "bg-amber-50 text-amber-700 border-amber-200",
  CONDITION_BASED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  THIRD_PARTY: "bg-violet-50 text-violet-700 border-violet-200",
  FOCUSED: "bg-orange-50 text-orange-700 border-orange-200"
};

const FREQ_LABEL: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  ANNUAL: "Annual"
};

export interface InspectionTypeRow {
  id: string;
  code: string;
  name: string;
  isStatutory: boolean;
  statutoryReference: string | null;
  requiresCertifiedInspector: boolean;
  category: string;
  defaultFrequency: string;
  defaultTemplateId: string | null;
  defaultTemplateName: string | null;
  defaultTemplateVersion: number | null;
  draftTemplatesCount: number;
  equipmentLinksCount: number;
  inspectionsCount: number;
  statutoryFormType: string | null;
}

const columns: ColumnDef<InspectionTypeRow>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
    size: 110
  },
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <div>
        <div className="flex items-center gap-1.5 font-medium text-slate-900">
          {row.original.isStatutory && <ShieldAlert size={12} className="text-rose-600" />}
          {row.original.name}
        </div>
        {row.original.statutoryReference && (
          <div className="text-[11px] text-rose-700">{row.original.statutoryReference}</div>
        )}
        {row.original.requiresCertifiedInspector && (
          <div className="text-[11px] text-amber-700">Inspector certification required</div>
        )}
      </div>
    ),
    size: 260
  },
  {
    accessorKey: "category",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
    cell: ({ row }) => <Badge className={CATEGORY_BADGE[row.original.category] ?? "bg-slate-100"}>{row.original.category}</Badge>,
    size: 150
  },
  {
    accessorKey: "defaultFrequency",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Default Frequency" />,
    cell: ({ row }) => (
      <span className="text-xs text-slate-700">
        <Calendar size={12} className="mr-1 inline" />
        {FREQ_LABEL[row.original.defaultFrequency] ?? row.original.defaultFrequency}
      </span>
    ),
    size: 150
  },
  {
    accessorKey: "defaultTemplateName",
    header: "Default Template",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.defaultTemplateId && row.original.defaultTemplateName ? (
        <Link href={`/inspections/checklists/${row.original.defaultTemplateId}`} className="text-xs text-primary-700 hover:underline">
          {row.original.defaultTemplateName} <span className="text-slate-400">v{row.original.defaultTemplateVersion}</span>
        </Link>
      ) : (
        <span className="text-xs text-slate-400">— ({row.original.draftTemplatesCount} drafts)</span>
      ),
    size: 200
  },
  {
    id: "equipmentLinks",
    accessorFn: (r) => r.equipmentLinksCount,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Equipment Links" />,
    cell: ({ row }) => (
      <span className="text-xs text-slate-600">
        {row.original.equipmentLinksCount} eqp · {row.original.inspectionsCount} insp
      </span>
    ),
    size: 160
  },
  {
    accessorKey: "isStatutory",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Statutory" />,
    cell: ({ row }) =>
      row.original.isStatutory ? (
        <Badge className="bg-rose-50 text-rose-700 border-rose-200">{row.original.statutoryFormType ?? "Yes"}</Badge>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      ),
    size: 110
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <Link href={`/inspections/types/${row.original.id}`} className="text-primary-700 hover:text-primary-900" title="View / edit">
        <Eye size={16} />
      </Link>
    ),
    size: 50
  }
];

export function InspectionTypesTable({ data }: { data: InspectionTypeRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search inspection types…"
      pageSize={15}
      emptyMessage="No inspection types configured."
      exportFileName="inspection-types"
    />
  );
}
