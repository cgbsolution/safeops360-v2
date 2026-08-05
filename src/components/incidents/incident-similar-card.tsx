"use client";

// Feature 3 — trend tie-back. "N similar incidents this quarter" chip with a
// click-through to the matched records (not a modal dump of raw scores). Only
// renders when at least one match clears the 40-point floor.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ChevronDown, ChevronRight } from "lucide-react";

type Match = {
  incidentId: string;
  number: string;
  score: number;
  type: string | null;
  severity: string | null;
  date: string | null;
  sharedFactors: string[];
};

export function IncidentSimilarCard({ incidentId }: { incidentId: string }) {
  const [data, setData] = useState<{ matches: Match[]; count: number; quarterCount: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/incidents/${incidentId}/similar`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) { setData(j); setLoaded(true); } })
      .catch(() => setLoaded(true));
    return () => { alive = false; };
  }, [incidentId]);

  // Chip only appears when there's at least one match over the floor.
  if (!loaded || !data || data.count === 0) return null;

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp size={16} className="text-amber-600" /> Trend & Pattern
        </CardTitle>
      </CardHeader>
      <CardContent>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="font-semibold">{data.quarterCount}</span> similar incident{data.quarterCount === 1 ? "" : "s"} this quarter
          <span className="text-amber-600 text-xs">({data.count} in 12 mo)</span>
        </button>
        {open && (
          <div className="mt-3 space-y-1.5">
            {data.matches.map((m) => (
              <Link
                key={m.incidentId}
                href={`/incidents/${m.incidentId}`}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-slate-600 truncate">{m.number}</span>
                  {m.type && <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">{m.type.replace(/_/g, " ")}</Badge>}
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-slate-400">{m.sharedFactors.join(" · ")}</span>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">{m.score}% match</Badge>
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
