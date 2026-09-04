"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  Row,
  RowSelectionState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Can } from "@/components/auth/can";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Download,
  Loader2,
  Search,
  Trash2,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Reserved column ids the toolbar never offers to hide, export, or label. */
const SELECT_COLUMN_ID = "__select";
const NON_DATA_COLUMN_IDS = new Set([SELECT_COLUMN_ID, "actions"]);

export interface DataTableBulkDelete {
  /** Collection endpoint. Each selected row is deleted with DELETE `${endpoint}/${id}`. */
  endpoint: string;
  /** Permission the caller needs before the button renders (a UX gate; the API is the real one). */
  permission: string;
  /** Noun shown in the confirm dialog and toasts — "observation", "permit", … */
  entityLabel?: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: string;
  className?: string;
  /** Minimum width (px) the table needs to render comfortably. Triggers horizontal scroll when container is narrower. */
  minWidth?: number;
  /** Row-selection checkbox column plus the bulk-action bar. */
  enableSelection?: boolean;
  /** "Customize Columns" dropdown. */
  enableColumnVisibility?: boolean;
  /** "Export to Excel" in the bulk-action bar. */
  enableExport?: boolean;
  /** Base name of the downloaded workbook (no extension). */
  exportFileName?: string;
  /** Worksheet name inside the workbook. Defaults to the export file name. */
  exportSheetName?: string;
  /** Stable row key — needed so a selection survives a `router.refresh()`. Defaults to `row.id`. */
  getRowId?: (row: TData) => string;
  /** Human label for a row, used in delete confirmations. Defaults to the row id. */
  getRowLabel?: (row: TData) => string;
  /** Opt in to "Delete selected". Omitted = no bulk delete on this table. */
  bulkDelete?: DataTableBulkDelete;
}

/**
 * Column labels for the "Customize Columns" menu and the Excel header row.
 *
 * Every list column in this app declares its label exactly once — as the
 * `title` prop of <DataTableColumnHeader>. Rather than make all 17 tables
 * repeat it in `meta`, we call the header renderer with the column context and
 * read `title` off the element it returns. Those renderers are pure JSX
 * factories, so building the element is side-effect free; anything more exotic
 * falls through to a plain-string header, then to the column id.
 */
function columnLabel<TData, TValue>(column: Column<TData, TValue>): string {
  const meta = column.columnDef.meta as { label?: string } | undefined;
  if (meta?.label) return meta.label;

  const header = column.columnDef.header;
  if (typeof header === "string" && header.trim()) return header;
  if (typeof header === "function") {
    try {
      const el: any = (header as any)({ column, table: undefined, header: undefined });
      const title = el?.props?.title;
      if (typeof title === "string" && title.trim()) return title;
    } catch {
      // Header needs a fuller context than we can synthesise — fall back to the id.
    }
  }
  return column.id
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Flattens a cell value to something a spreadsheet cell can hold.
 *
 * ISO timestamps are truncated to their date part rather than converted to a
 * Date: these columns are stored and rendered as UTC, so handing Excel an
 * instant would let it re-render in local time and show the previous day.
 */
function toCellValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    return /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value.slice(0, 10) : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((v) => toCellValue(v)).join(", ");
  return String(value);
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search…",
  pageSize = 10,
  emptyMessage = "No records found.",
  className,
  minWidth = 1100,
  enableSelection = true,
  enableColumnVisibility = true,
  enableExport = true,
  exportFileName = "export",
  exportSheetName,
  getRowId,
  getRowLabel,
  bulkDelete
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const { toast } = useToast();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const rowId = React.useCallback(
    (row: TData) => (getRowId ? getRowId(row) : String((row as any)?.id ?? "")),
    [getRowId]
  );

  const tableColumns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!enableSelection) return columns;
    const selectColumn: ColumnDef<TData, TValue> = {
      id: SELECT_COLUMN_ID,
      enableSorting: false,
      enableHiding: false,
      size: 44,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows on this page"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
          }}
          onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={(e) => row.toggleSelected(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
      )
    };
    return [selectColumn, ...columns];
  }, [columns, enableSelection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, columnFilters, columnVisibility, rowSelection, globalFilter },
    enableRowSelection: enableSelection,
    // Keyed by the record id so a selection survives the router.refresh() that
    // follows a bulk delete, instead of re-selecting whatever now sits at that index.
    getRowId: enableSelection ? (row, index) => rowId(row) || String(index) : undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } }
  });

  const totalRows = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const currentPageSize = table.getState().pagination.pageSize;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const visibleColumnCount = table.getVisibleLeafColumns().length;

  const hideableColumns = table
    .getAllLeafColumns()
    .filter((c) => c.getCanHide() && !NON_DATA_COLUMN_IDS.has(c.id));

  /** Visible columns that carry a value — badge and link cells export as their raw datum. */
  function exportableColumns() {
    return table
      .getVisibleLeafColumns()
      .filter((c) => !NON_DATA_COLUMN_IDS.has(c.id) && typeof c.accessorFn === "function");
  }

  async function handleExport() {
    if (exporting) return;
    const cols = exportableColumns();
    const rows: Row<TData>[] = selectedCount ? selectedRows : table.getFilteredRowModel().rows;
    if (!cols.length || !rows.length) {
      toast({ variant: "error", title: "Nothing to export", description: "There are no rows in the current view." });
      return;
    }
    setExporting(true);
    try {
      const res = await fetch("/api/exports/table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: exportFileName,
          sheetName: exportSheetName ?? exportFileName,
          columns: cols.map((c) => ({ key: c.id, label: columnLabel(c) })),
          rows: rows.map((r) => Object.fromEntries(cols.map((c) => [c.id, toCellValue(r.getValue(c.id))])))
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({
          variant: "error",
          title: "Export failed",
          description: j.error ?? `The server returned status ${res.status}.`
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportFileName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        variant: "success",
        title: "Export ready",
        description: `${rows.length} row${rows.length === 1 ? "" : "s"} downloaded as ${exportFileName}.xlsx.`
      });
    } catch (err: any) {
      toast({
        variant: "error",
        title: "Export failed",
        description: err?.message ?? "Could not reach the server. Check your connection and retry."
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleBulkDelete() {
    if (!bulkDelete || deleting || !selectedCount) return;
    const noun = bulkDelete.entityLabel ?? "record";
    const plural = selectedCount === 1 ? noun : `${noun}s`;
    const ok = confirm(
      `Permanently delete ${selectedCount} ${plural}?\n\nThis removes each record along with its workflow history and attachments. This cannot be undone.`
    );
    if (!ok) return;

    setDeleting(true);
    // One at a time on purpose: there is no bulk endpoint, and firing a hundred
    // parallel DELETEs at the pooled backend connection is how the session gets
    // poisoned. A partial failure still reports which rows survived.
    const failures: string[] = [];
    let deleted = 0;
    try {
      for (const row of selectedRows) {
        const id = rowId(row.original);
        const label = getRowLabel ? getRowLabel(row.original) : id;
        if (!id) {
          failures.push(label || "unknown row");
          continue;
        }
        try {
          const res = await fetch(`${bulkDelete.endpoint}/${id}`, { method: "DELETE" });
          if (res.ok || res.status === 204) deleted++;
          else failures.push(label);
        } catch {
          failures.push(label);
        }
      }
    } finally {
      setDeleting(false);
    }

    setRowSelection({});
    if (deleted) {
      toast({
        variant: failures.length ? "default" : "success",
        title: failures.length ? "Partly deleted" : "Deleted",
        description: failures.length
          ? `${deleted} removed. Could not delete: ${failures.slice(0, 5).join(", ")}${failures.length > 5 ? "…" : ""}.`
          : `${deleted} ${deleted === 1 ? noun : `${noun}s`} removed.`
      });
      router.refresh();
    } else {
      toast({
        variant: "error",
        title: "Delete failed",
        description: `None of the selected ${plural} could be deleted. You may not have permission.`
      });
    }
  }

  const showToolbar = Boolean(searchKey) || enableColumnVisibility;

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {searchKey ? (
            <div className="relative w-full max-w-sm">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="h-9 pl-9 text-sm"
              />
            </div>
          ) : (
            <span />
          )}

          {enableColumnVisibility && hideableColumns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Columns3 size={14} />
                  Customize Columns
                  <ChevronDown size={14} className="text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideableColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {columnLabel(column)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {enableSelection && selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50/70 px-4 py-2.5">
          <span className="text-sm font-medium text-slate-800">
            {selectedCount} row{selectedCount === 1 ? "" : "s"} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {enableExport && (
              <Button variant="outline" size="sm" className="h-8" onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Export to Excel
              </Button>
            )}
            {bulkDelete && (
              <Can permission={bulkDelete.permission}>
                <Button variant="destructive" size="sm" className="h-8" onClick={handleBulkDelete} disabled={deleting}>
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete selected
                </Button>
              </Can>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-slate-600"
              onClick={() => setRowSelection({})}
              disabled={deleting}
            >
              <X size={14} />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* The horizontal-scroll container — table never bleeds wider than this card */}
      <div className="w-full min-w-0 overflow-x-auto rounded-lg border bg-white">
        <table
          className="w-full caption-bottom border-separate border-spacing-0 text-sm"
          style={{ minWidth: `${minWidth}px` }}
        >
          <thead className="bg-slate-50/80">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    className={cn(
                      "h-11 border-b px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-600",
                      header.column.id === SELECT_COLUMN_ID && "pr-0"
                    )}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(
                    "transition-colors hover:bg-slate-50/70",
                    row.getIsSelected() && "bg-primary-50/60 hover:bg-primary-50"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "border-b px-4 py-3 align-top text-slate-700",
                        cell.column.id === SELECT_COLUMN_ID && "pr-0 pt-4"
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={visibleColumnCount} className="h-32 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* shadcn-style pagination footer */}
      <div className="flex flex-col items-start gap-3 px-1 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {enableSelection ? (
            <>
              <span className="font-medium text-slate-900">{selectedCount}</span> of{" "}
              <span className="font-medium text-slate-900">{totalRows}</span> row(s) selected.
            </>
          ) : totalRows > 0 ? (
            <>
              Showing{" "}
              <span className="font-medium text-slate-900">
                {pageIndex * currentPageSize + 1}–{Math.min((pageIndex + 1) * currentPageSize, totalRows)}
              </span>{" "}
              of <span className="font-medium text-slate-900">{totalRows}</span> rows
            </>
          ) : (
            "0 rows"
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap">Rows per page</span>
            <Select
              value={currentPageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-7 w-[68px] px-2 py-0 text-xs"
            >
              {[10, 15, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </div>

          <div className="whitespace-nowrap">
            Page <span className="font-medium text-slate-900">{pageCount === 0 ? 0 : pageIndex + 1}</span> of{" "}
            <span className="font-medium text-slate-900">{pageCount}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="h-7 w-7 p-0"
              aria-label="First page"
            >
              <ChevronsLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-7 w-7 p-0"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-7 w-7 p-0"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
              className="h-7 w-7 p-0"
              aria-label="Last page"
            >
              <ChevronsRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
