import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

// BarList — the ranked "label · bar · value" row the analytics panels are built
// from. It was copy-pasted as a bare `grid-cols-[130px_1fr_auto]` in the
// bottleneck panel, the concentration panel, the insight hero rail and the dead
// category panel, each re-deriving its own percentage and its own 6% floor.
//
// A row is a link when `href` is set and a plain row otherwise — the bottleneck
// bars are informational, the concentration bars drill through to `?cat=`.
// Server-safe: no client JS, widths come from inline style.

export interface BarListRowProps {
  /** Left column. Truncates; the full text goes to the title attribute. */
  label: React.ReactNode;
  /** Raw value for this row — BarList divides by the row set's max. */
  value: number;
  /** Right column. Falls back to the value when not given. */
  meta?: React.ReactNode;
  /** Tooltip / accessible description for the row. */
  title?: string;
  /** Makes the row a drill-through link. */
  href?: string;
  /** Renders the row as the selected one (filter currently applied). */
  active?: boolean;
  /** Emphasises the label — the panels bold the worst offender. */
  emphasis?: boolean;
  /** Fill colour, when the caller computes a semantic band (e.g. dwell days). */
  indicatorClassName?: string;
}

const LABEL_COL = "grid grid-cols-[130px_1fr_auto] items-center gap-3";

function BarList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-0.5", className)} {...props} />;
}

/**
 * Rendered by BarList.Rows; exported so a caller can lay rows out itself.
 * `max` is injected by BarList.Rows — pass it explicitly when using this direct.
 */
function BarListRow({
  label,
  value,
  meta,
  title,
  href,
  active,
  emphasis,
  indicatorClassName,
  max
}: BarListRowProps & { max: number }) {
  const body = (
    <>
      <span
        className={cn(
          "truncate text-[12.5px]",
          active || emphasis ? "font-semibold text-slate-800" : "text-slate-600"
        )}
        title={typeof label === "string" ? label : undefined}
      >
        {label}
      </span>
      <Progress
        value={value}
        max={max}
        minVisiblePercent={6}
        indicatorClassName={cn(active ? "bg-primary-600" : "bg-primary-400", indicatorClassName)}
      />
      <span className="whitespace-nowrap text-right font-mono text-[12.5px] font-bold tabular-nums text-slate-800">
        {meta ?? value}
      </span>
    </>
  );

  if (!href) {
    return (
      <div className={cn(LABEL_COL, "px-1.5 py-1")} title={title}>
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      title={title}
      aria-current={active ? "true" : undefined}
      className={cn(LABEL_COL, "rounded-lg px-1.5 py-1 transition hover:bg-slate-50", active && "bg-primary-50")}
    >
      {body}
    </Link>
  );
}

/**
 * Renders a whole row set, scaling every bar against the largest value in it so
 * callers stop recomputing `Math.max(1, ...rows.map(r => r.value))` by hand.
 */
function BarListRows({
  rows,
  className,
  ...props
}: { rows: BarListRowProps[] } & React.HTMLAttributes<HTMLDivElement>) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <BarList className={className} {...props}>
      {rows.map((row, i) => (
        <BarListRow key={typeof row.label === "string" ? row.label : i} {...row} max={max} />
      ))}
    </BarList>
  );
}

export { BarList, BarListRow, BarListRows };
