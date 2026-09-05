import Link from "next/link";
import { Sparkles, ArrowRight, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type Phase2Capability = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type Phase2MockMetric = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
};

export type Phase2MockRow = Record<string, string | number>;

// Tailwind JIT only generates classes whose full names appear in source files.
// Each accent must therefore be a finite key with all its class names listed
// statically — never `bg-${x}-100` because that would be purged.
export type AccentKey = "violet" | "amber" | "emerald" | "rose" | "blue" | "indigo";

const ACCENT: Record<AccentKey, {
  border: string;
  gradient: string;
  iconWrap: string;
  badge: string;
  button: string;
  capIconWrap: string;
}> = {
  violet: {
    border: "border-violet-200",
    gradient: "from-violet-50 via-white to-white",
    iconWrap: "bg-violet-100 text-violet-700",
    badge: "bg-violet-100 text-violet-800 border-violet-200",
    button: "bg-violet-700 hover:bg-violet-800",
    capIconWrap: "bg-violet-100 text-violet-700"
  },
  amber: {
    border: "border-amber-200",
    gradient: "from-amber-50 via-white to-white",
    iconWrap: "bg-amber-100 text-amber-700",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    button: "bg-amber-700 hover:bg-amber-800",
    capIconWrap: "bg-amber-100 text-amber-700"
  },
  emerald: {
    border: "border-emerald-200",
    gradient: "from-emerald-50 via-white to-white",
    iconWrap: "bg-emerald-100 text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    button: "bg-emerald-700 hover:bg-emerald-800",
    capIconWrap: "bg-emerald-100 text-emerald-700"
  },
  rose: {
    border: "border-rose-200",
    gradient: "from-rose-50 via-white to-white",
    iconWrap: "bg-rose-100 text-rose-700",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    button: "bg-rose-700 hover:bg-rose-800",
    capIconWrap: "bg-rose-100 text-rose-700"
  },
  blue: {
    border: "border-blue-200",
    gradient: "from-blue-50 via-white to-white",
    iconWrap: "bg-blue-100 text-blue-700",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    button: "bg-blue-700 hover:bg-blue-800",
    capIconWrap: "bg-blue-100 text-blue-700"
  },
  indigo: {
    border: "border-indigo-200",
    gradient: "from-indigo-50 via-white to-white",
    iconWrap: "bg-indigo-100 text-indigo-700",
    badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
    button: "bg-indigo-700 hover:bg-indigo-800",
    capIconWrap: "bg-indigo-100 text-indigo-700"
  }
};

export type Phase2ScaffoldProps = {
  module: {
    href: string;
    name: string;
    icon: LucideIcon;
    description: string;
    targetIndustries: string;
    availability: string; // e.g. "Available Q3 2026"
    accent: AccentKey;
  };
  capabilities: Phase2Capability[];
  mockMetrics: Phase2MockMetric[];
  list?: {
    title: string;
    description?: string;
    columns: string[];
    rows: Phase2MockRow[];
    statusKey?: string;
  };
};

const TONE_CLS: Record<NonNullable<Phase2MockMetric["tone"]>, string> = {
  default: "text-slate-900",
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-rose-700"
};

function statusBadgeCls(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("active") || v.includes("approved") || v.includes("compliant") || v.includes("complete")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (v.includes("draft") || v.includes("scheduled") || v.includes("planned")) return "bg-slate-50 text-slate-700 border-slate-200";
  if (v.includes("review") || v.includes("progress") || v.includes("monitoring") || v.includes("pending")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (v.includes("expir") || v.includes("warn") || v.includes("flag") || v.includes("watch")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (v.includes("breach") || v.includes("fail") || v.includes("over") || v.includes("blocked") || v.includes("suspend")) return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export function Phase2Scaffold({ module, capabilities, mockMetrics, list }: Phase2ScaffoldProps) {
  const Icon = module.icon;
  const accent = ACCENT[module.accent];

  return (
    <div className="space-y-5">
      <PageHeader
        title={module.name}
        description={module.description}
        breadcrumbs={[{ label: "Modules" }, { label: module.name }]}
        action={
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
            <Sparkles size={11} /> {module.availability}
          </Badge>
        }
      />

      {/* Hero — Phase 2 framing */}
      <Card className={cn("border-2 overflow-hidden", accent.border)}>
        <CardContent className={cn("p-6 sm:p-8 bg-gradient-to-br", accent.gradient)}>
          <div className="flex items-start gap-5">
            <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0", accent.iconWrap)}>
              <Icon size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <Badge className={cn("mb-2", accent.badge)}>
                Coming in Phase 2 · {module.availability}
              </Badge>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">{module.name}</h2>
              <p className="text-sm text-slate-700 leading-relaxed mb-3 max-w-3xl">{module.description}</p>
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Target industries:</span> {module.targetIndustries}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" className={cn("text-white", accent.button)}>
                  Notify me at launch
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard">Back to dashboard <ArrowRight size={13} /></Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mock metrics — proves data model is thought through */}
      {mockMetrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {mockMetrics.map((m, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{m.label}</div>
                <div className={cn("text-xl font-bold mt-1", TONE_CLS[m.tone ?? "default"])}>{m.value}</div>
                {m.hint && <div className="text-[11px] text-slate-500 mt-0.5">{m.hint}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planned capabilities</CardTitle>
          <CardDescription>What this module will support at launch.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {capabilities.map((c, i) => {
              const CIcon = c.icon;
              return (
                <Card key={i} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white shadow-none">
                  <div className={cn("w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0", accent.capIconWrap)}>
                    <CIcon size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{c.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5 leading-snug">{c.description}</div>
                  </div>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Read-only mock list — proves the entity model */}
      {list && list.rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{list.title}</CardTitle>
            {list.description && <CardDescription>{list.description}</CardDescription>}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-slate-50 border-y">
                  <TableRow>
                    {list.columns.map((c) => (
                      <TableHead key={c} className="text-left px-4 py-2 font-semibold text-slate-700 text-xs uppercase tracking-wider">{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.rows.map((row, i) => (
                    <TableRow key={i} className="border-b last:border-b-0 hover:bg-slate-50/50">
                      {list.columns.map((c) => {
                        const v = row[c];
                        const isStatus = list.statusKey === c;
                        return (
                          <TableCell key={c} className="px-4 py-2.5 text-slate-700">
                            {isStatus ? (
                              <Badge className={statusBadgeCls(String(v))}>{v}</Badge>
                            ) : (
                              <span>{v}</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-3 border-t bg-slate-50/50 text-[11px] text-slate-500">
              Sample data — full create/edit experience ships with Phase 2 ({module.availability}).
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
