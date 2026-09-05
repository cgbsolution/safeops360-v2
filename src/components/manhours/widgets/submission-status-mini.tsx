import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MONTH_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CELL_STYLE: Record<string, string> = {
  NOT_STARTED: "bg-slate-50 border-slate-200 text-slate-400",
  DRAFT: "bg-amber-100 border-amber-300 text-amber-900",
  UNDER_REVIEW: "bg-blue-100 border-blue-300 text-blue-900",
  APPROVED: "bg-emerald-100 border-emerald-300 text-emerald-900",
  LOCKED: "bg-slate-800 border-slate-800 text-white",
  UNLOCKED_FOR_REVISION: "bg-rose-100 border-rose-300 text-rose-900",
  LEGACY: "bg-slate-200 border-slate-300 text-slate-700"
};

export interface MiniCell {
  plantId: string;
  plantCode: string;
  plantName: string;
  year: number;
  month: number;
  status: string;
}

/**
 * Compact submission status grid for the dashboard. Same data as
 * the /manhours calendar but tile-only — no metrics, just status
 * pills, optimised for a single dashboard row.
 */
export function SubmissionStatusMini({
  title,
  description,
  plants,
  monthsAxis,
  cells
}: {
  title: string;
  description?: string;
  plants: { id: string; code: string; name: string }[];
  monthsAxis: { year: number; month: number; label: string }[];
  cells: MiniCell[];
}) {
  const cellMap = new Map<string, MiniCell>();
  for (const c of cells) cellMap.set(`${c.plantId}::${c.year}-${c.month}`, c);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="text-[10px] w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-[10px] uppercase tracking-wider text-slate-500">
                  Plant
                </TableHead>
                {monthsAxis.map((m) => (
                  <TableHead key={`${m.year}-${m.month}`} className="px-1 py-1 text-center text-[9px] uppercase tracking-wider text-slate-500">
                    {m.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {plants.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="sticky left-0 z-10 bg-white px-2 py-1 font-medium text-slate-800 text-xs whitespace-nowrap">
                    {p.code}
                  </TableCell>
                  {monthsAxis.map((m) => {
                    const cell = cellMap.get(`${p.id}::${m.year}-${m.month}`);
                    const status = cell?.status ?? "NOT_STARTED";
                    const style = CELL_STYLE[status] ?? CELL_STYLE.NOT_STARTED;
                    const initial = status.charAt(0); // D / U / A / L / R
                    return (
                      <TableCell key={`${p.id}::${m.year}-${m.month}`} className="px-0.5 py-0.5 text-center">
                        <Link
                          href={`/manhours/${p.id}/${m.year}/${m.month}/edit`}
                          title={`${p.name} · ${MONTH_SHORT[m.month]} ${m.year} · ${status.replace(/_/g, " ")}`}
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded border text-[9px] font-bold transition hover:scale-110",
                            style
                          )}
                        >
                          {initial}
                        </Link>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
          <LegendChip label="Locked" code="L" style={CELL_STYLE.LOCKED} />
          <LegendChip label="Approved" code="A" style={CELL_STYLE.APPROVED} />
          <LegendChip label="Under review" code="U" style={CELL_STYLE.UNDER_REVIEW} />
          <LegendChip label="Draft" code="D" style={CELL_STYLE.DRAFT} />
          <LegendChip label="Unlocked" code="U" style={CELL_STYLE.UNLOCKED_FOR_REVISION} />
          <LegendChip label="Not started" code="—" style={CELL_STYLE.NOT_STARTED} />
        </div>
      </CardContent>
    </Card>
  );
}

function LegendChip({ label, code, style }: { label: string; code: string; style: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded border text-[8px] font-bold", style)}>
        {code}
      </span>
      <span className="text-slate-500">{label}</span>
    </span>
  );
}
