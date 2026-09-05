// Read-only RCA visualisations dispatched from the incident detail page based
// on `rootCauseMethod`. Each renderer parses the methodology-specific JSON
// shape stored in `rootCauseDetail`. If parsing fails, we fall back to a plain
// preformatted view of the raw text so the page never crashes.
//
// IMPORTANT: these are presentational only — no state, no mutations, no API
// calls. They render whatever JSON shape exists in the field.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, AlertCircle, ShieldCheck, ShieldAlert, ShieldOff, Clock, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";

// ─── Shared parse helper ───────────────────────────────────────────────
function tryParse<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

// Fallback renderer when JSON shape doesn't match any known methodology.
// Avoids a blank state and gives the user the raw notes.
function RawFallback({ method, raw }: { method: string; raw: string | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Root Cause Analysis · {method}</CardTitle>
        <CardDescription>
          Raw findings — methodology-specific structure not detected.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">
          {raw ?? "No findings recorded."}
        </pre>
      </CardContent>
    </Card>
  );
}

// ─── 5-Why ─────────────────────────────────────────────────────────────
type FiveWhyShape = Record<string, string>;

export function FiveWhyView({ raw }: { raw: string | null }) {
  const data = tryParse<FiveWhyShape>(raw);
  if (!data) return <RawFallback method="5-Why" raw={raw} />;

  const has = [1, 2, 3, 4, 5].some((n) => data[`why${n}`] || data[`a${n}`]);
  if (!has) return <RawFallback method="5-Why" raw={raw} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Root Cause Analysis · 5-Why</CardTitle>
        <CardDescription>Sequential drilldown to the underlying cause.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => {
            const q = data[`why${n}`];
            const a = data[`a${n}`];
            if (!q && !a) return null;
            return (
              <div key={n} className="border-l-4 border-primary-300 pl-3 py-1">
                <div className="text-xs font-bold text-primary-700 uppercase">Why {n}</div>
                <div className="text-sm text-slate-600 italic">{q}</div>
                <div className="text-sm text-slate-900 mt-1">{a}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Fishbone (Ishikawa) — 6M ──────────────────────────────────────────
type FishboneShape = {
  problem?: string;
  categories?: Record<string, string[]>;
  rootCauses?: string[];
};

const FISHBONE_CATEGORIES = ["Manpower", "Machine", "Method", "Material", "Measurement", "Environment"] as const;

const FISHBONE_TONE: Record<string, string> = {
  Manpower: "border-rose-200 bg-rose-50/40",
  Machine: "border-blue-200 bg-blue-50/40",
  Method: "border-violet-200 bg-violet-50/40",
  Material: "border-amber-200 bg-amber-50/40",
  Measurement: "border-emerald-200 bg-emerald-50/40",
  Environment: "border-teal-200 bg-teal-50/40"
};

export function FishboneView({ raw }: { raw: string | null }) {
  const data = tryParse<FishboneShape>(raw);
  if (!data || !data.categories) return <RawFallback method="Fishbone (Ishikawa)" raw={raw} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Root Cause Analysis · Fishbone (Ishikawa)</CardTitle>
        {data.problem && (
          <CardDescription>
            <span className="font-medium text-slate-700">Problem:</span> {data.problem}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FISHBONE_CATEGORIES.map((cat) => {
            const causes = data.categories?.[cat] ?? [];
            return (
              <div key={cat} className={cn("rounded-lg border p-3", FISHBONE_TONE[cat] ?? "border-slate-200")}>
                <div className="text-xs uppercase tracking-wider font-bold text-slate-700 mb-2">{cat}</div>
                {causes.length === 0 ? (
                  <div className="text-xs text-slate-400 italic">— none recorded —</div>
                ) : (
                  <ul className="space-y-1.5">
                    {causes.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-slate-700">
                        <ChevronRight size={12} className="text-slate-400 mt-1 flex-shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {data.rootCauses && data.rootCauses.length > 0 && (
          <Alert variant="destructive" size="lg" className="mt-4 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className="text-rose-700" />
              <div className="text-xs uppercase tracking-wider font-bold text-rose-800">Root Causes Identified</div>
            </div>
            <ul className="space-y-1">
              {data.rootCauses.map((rc, i) => (
                <li key={i} className="text-sm text-rose-900 leading-snug">• {rc}</li>
              ))}
            </ul>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ─── FTA — tree with AND/OR gates + minimal cut sets ───────────────────
type FtaNode = {
  label: string;
  gate?: "AND" | "OR" | "BASIC";
  children?: FtaNode[];
  probability?: "Low" | "Medium" | "High";
  control?: string;
  occurred?: boolean;
};

type FtaShape = {
  topEvent?: string;
  tree?: FtaNode;
  minimalCutSets?: string[][];
  actualCutSet?: string[];
};

function FtaTreeNode({ node, depth }: { node: FtaNode; depth: number }) {
  const isBasic = node.gate === "BASIC" || (!node.children && !node.gate);
  return (
    <div className="space-y-1.5" style={{ marginLeft: depth * 14 }}>
      <div
        className={cn(
          "flex items-start gap-2 text-sm",
          isBasic ? "" : "font-medium"
        )}
      >
        {!isBasic && (
          <Badge
            className={cn(
              "text-[10px] font-mono",
              node.gate === "AND"
                ? "bg-rose-100 text-rose-800 border-rose-200"
                : "bg-amber-100 text-amber-800 border-amber-200"
            )}
          >
            {node.gate}
          </Badge>
        )}
        {isBasic && (
          <span
            className={cn(
              "inline-block w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
              node.occurred ? "bg-rose-600" : "bg-slate-300"
            )}
          />
        )}
        <span className={cn("flex-1 leading-snug", node.occurred && isBasic && "text-rose-800 font-semibold")}>{node.label}</span>
      </div>
      {isBasic && (node.probability || node.control) && (
        <div className="ml-5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {node.probability && (
            <Badge
              className={cn(
                "text-[10px]",
                node.probability === "High"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : node.probability === "Medium"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
              )}
            >
              p = {node.probability}
            </Badge>
          )}
          {node.control && <span>· Control: {node.control}</span>}
          {node.occurred && (
            <Badge className="text-[10px] bg-rose-600 text-white border-rose-600">Occurred</Badge>
          )}
        </div>
      )}
      {node.children && node.children.length > 0 && (
        <div className="space-y-1.5 border-l-2 border-slate-200 pl-2 ml-1">
          {node.children.map((c, i) => (
            <FtaTreeNode key={i} node={c} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FtaView({ raw }: { raw: string | null }) {
  const data = tryParse<FtaShape>(raw);
  if (!data || !data.tree) return <RawFallback method="Fault Tree Analysis (FTA)" raw={raw} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Root Cause Analysis · Fault Tree Analysis (FTA)</CardTitle>
        {data.topEvent && (
          <CardDescription>
            <span className="font-medium text-slate-700">Top event:</span> {data.topEvent}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Card className="p-3 shadow-none">
          <FtaTreeNode node={data.tree} depth={0} />
        </Card>

        <div className="grid sm:grid-cols-2 gap-3">
          {data.minimalCutSets && data.minimalCutSets.length > 0 && (
            <Card className="bg-slate-50/60 p-3 shadow-none">
              <div className="text-xs uppercase tracking-wider font-bold text-slate-600 mb-2">
                Minimal Cut Sets
              </div>
              <ul className="space-y-1.5">
                {data.minimalCutSets.map((set, i) => (
                  <li key={i} className="text-xs text-slate-700">
                    {set.map((b) => `{${b}}`).join(" ∩ ")}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {data.actualCutSet && data.actualCutSet.length > 0 && (
            <Card className="border-rose-200 bg-rose-50/60 p-3 shadow-none">
              <div className="text-xs uppercase tracking-wider font-bold text-rose-700 mb-2">
                Actual Path That Occurred
              </div>
              <ul className="space-y-1">
                {data.actualCutSet.map((b, i) => (
                  <li key={i} className="text-xs text-rose-900">• {b}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Bowtie ────────────────────────────────────────────────────────────
type BarrierStatus = "worked" | "failed" | "absent";
type BowtieBarrier = { name: string; status: BarrierStatus };
type BowtieSide = { name: string; barriers: BowtieBarrier[] };
type BowtieShape = {
  topEvent?: string;
  threats?: BowtieSide[];
  consequences?: BowtieSide[];
};

function BarrierRow({ barrier }: { barrier: BowtieBarrier }) {
  const ICON = barrier.status === "worked" ? ShieldCheck : barrier.status === "failed" ? ShieldAlert : ShieldOff;
  const cls =
    barrier.status === "worked"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : barrier.status === "failed"
        ? "text-rose-700 bg-rose-50 border-rose-200"
        : "text-slate-500 bg-slate-50 border-slate-200";
  return (
    <div className={cn("flex items-start gap-2 rounded border px-2 py-1.5 text-xs", cls)}>
      <ICON size={13} className="mt-0.5 flex-shrink-0" />
      <span className="leading-snug">{barrier.name}</span>
    </div>
  );
}

export function BowtieView({ raw }: { raw: string | null }) {
  const data = tryParse<BowtieShape>(raw);
  if (!data || (!data.threats && !data.consequences)) return <RawFallback method="Bowtie" raw={raw} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Root Cause Analysis · Bowtie</CardTitle>
        {data.topEvent && (
          <CardDescription>
            <span className="font-medium text-slate-700">Top event:</span> {data.topEvent}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-3 gap-4">
          {/* THREATS — left side */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider font-bold text-slate-600">Threats &amp; Preventive Barriers</div>
            {(data.threats ?? []).map((t, i) => (
              <div key={i} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                <div className="text-sm font-semibold text-amber-900 mb-2">{t.name}</div>
                <div className="space-y-1.5">
                  {t.barriers.map((b, bi) => <BarrierRow key={bi} barrier={b} />)}
                </div>
              </div>
            ))}
          </div>

          {/* TOP EVENT — center */}
          <div className="flex items-center justify-center">
            <Card className="w-full border-2 border-rose-300 bg-rose-100 p-4 text-center text-rose-900">
              <div className="text-[10px] uppercase tracking-wider font-bold text-rose-700">Top Event</div>
              <div className="text-sm font-semibold mt-1 leading-snug">{data.topEvent ?? "—"}</div>
            </Card>
          </div>

          {/* CONSEQUENCES — right side */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider font-bold text-slate-600">Consequences &amp; Mitigative Barriers</div>
            {(data.consequences ?? []).map((c, i) => (
              <div key={i} className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                <div className="text-sm font-semibold text-blue-900 mb-2">{c.name}</div>
                <div className="space-y-1.5">
                  {c.barriers.map((b, bi) => <BarrierRow key={bi} barrier={b} />)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-emerald-700" /> Worked</span>
          <span className="flex items-center gap-1"><ShieldAlert size={11} className="text-rose-700" /> Failed</span>
          <span className="flex items-center gap-1"><ShieldOff size={11} className="text-slate-500" /> Absent</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── TapRoot — SnapCharT + Causal Factors + Root Cause Tree ───────────
type SnapNode = { time?: string; type?: "Action" | "Condition"; node: string };
type CFRootCauseEntry = { category: string; node: string };
type CausalFactor = { cf: string; rootCauseTree: CFRootCauseEntry[] };
type TapRootShape = {
  event?: string;
  snapChart?: SnapNode[];
  causalFactors?: CausalFactor[];
  genericCauses?: string[];
  correctiveActions?: string[];
};

export function TapRootView({ raw }: { raw: string | null }) {
  const data = tryParse<TapRootShape>(raw);
  if (!data || (!data.snapChart && !data.causalFactors)) return <RawFallback method="TapRoot" raw={raw} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Root Cause Analysis · TapRoot</CardTitle>
        {data.event && (
          <CardDescription>
            <span className="font-medium text-slate-700">Event:</span> {data.event}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {data.snapChart && data.snapChart.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider font-bold text-slate-600 mb-2">SnapCharT — Sequence of Events</div>
            <Card className="p-3 shadow-none">
              <ol className="relative border-l-2 border-slate-200 ml-2 space-y-3">
                {data.snapChart.map((n, i) => (
                  <li key={i} className="ml-3">
                    <span
                      className={cn(
                        "absolute -left-[7px] w-3 h-3 rounded-full border-2 border-white",
                        n.type === "Condition" ? "bg-amber-500" : "bg-primary-600"
                      )}
                    />
                    <div className="flex items-start gap-2">
                      {n.time && (
                        <span className="text-xs font-mono text-slate-500 w-12 flex-shrink-0">{n.time}</span>
                      )}
                      <div className="flex-1">
                        {n.type && (
                          <Badge
                            className={cn(
                              "text-[9px] mr-2",
                              n.type === "Action"
                                ? "bg-primary-100 text-primary-800 border-primary-200"
                                : "bg-amber-100 text-amber-800 border-amber-200"
                            )}
                          >
                            {n.type}
                          </Badge>
                        )}
                        <span className="text-sm text-slate-800 leading-snug">{n.node}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-600" /> Action</span>
                <span className="flex items-center gap-1"><Clock size={10} className="text-amber-500" /> Condition</span>
              </div>
            </Card>
          </div>
        )}

        {data.causalFactors && data.causalFactors.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider font-bold text-slate-600 mb-2">Causal Factors → Root Cause Tree</div>
            <div className="space-y-3">
              {data.causalFactors.map((cf, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <Badge className="bg-violet-100 text-violet-800 border-violet-200">CF{i + 1}</Badge>
                    <div className="text-sm font-medium text-slate-900 leading-snug">{cf.cf}</div>
                  </div>
                  <ul className="space-y-1.5 ml-3">
                    {cf.rootCauseTree.map((rc, ri) => (
                      <li key={ri} className="flex items-start gap-2 text-xs">
                        <Badge className="bg-slate-200 text-slate-800 border-slate-300 text-[10px]">{rc.category}</Badge>
                        <span className="text-slate-700 leading-snug flex-1">{rc.node}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.genericCauses && data.genericCauses.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/60 p-3 shadow-none">
            <div className="text-xs uppercase tracking-wider font-bold text-amber-800 mb-2">Generic Causes</div>
            <ul className="space-y-1">
              {data.genericCauses.map((g, i) => (
                <li key={i} className="text-sm text-amber-900">• {g}</li>
              ))}
            </ul>
          </Card>
        )}

        {data.correctiveActions && data.correctiveActions.length > 0 && (
          <Card className="border-emerald-200 bg-emerald-50/60 p-3 shadow-none">
            <div className="flex items-center gap-2 mb-2">
              <Wrench size={14} className="text-emerald-700" />
              <div className="text-xs uppercase tracking-wider font-bold text-emerald-800">Corrective Actions</div>
            </div>
            <ol className="space-y-1 list-decimal list-inside text-sm text-emerald-900">
              {data.correctiveActions.map((a, i) => (
                <li key={i} className="leading-snug">{a}</li>
              ))}
            </ol>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Dispatcher ────────────────────────────────────────────────────────
export function RcaView({ method, raw }: { method: string | null; raw: string | null }) {
  if (!method) return null;
  switch (method) {
    case "5-Why":
      return <FiveWhyView raw={raw} />;
    case "Fishbone":
      return <FishboneView raw={raw} />;
    case "FTA":
      return <FtaView raw={raw} />;
    case "Bowtie":
      return <BowtieView raw={raw} />;
    case "TapRoot":
      return <TapRootView raw={raw} />;
    default:
      return <RawFallback method={method} raw={raw} />;
  }
}
