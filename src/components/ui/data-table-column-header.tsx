"use client";

import * as React from "react";
import { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={cn("text-[11px] font-semibold uppercase tracking-wider text-slate-600", className)}>{title}</span>;
  }
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-900",
        className
      )}
    >
      <span>{title}</span>
      {sorted === "asc" ? (
        <ArrowUp size={12} />
      ) : sorted === "desc" ? (
        <ArrowDown size={12} />
      ) : (
        <ChevronsUpDown size={12} className="opacity-50" />
      )}
    </button>
  );
}
