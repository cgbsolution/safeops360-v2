"use client";

// Feature 7 — golden thread. "Downstream impact" panel: what closing this
// incident triggered (risk score update, training assignment, audit checkpoint,
// CAPA links), each traceable via GoldenThreadLink.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, ShieldAlert, GraduationCap, ClipboardCheck, Wrench } from "lucide-react";

type ThreadLink = {
  id: string;
  targetType: string;
  targetId: string;
  targetRef: string | null;
  linkType: string;
  reversed: boolean;
  createdAt: string | null;
};

const META: Record<string, { label: string; icon: any; tone: string; href?: (id: string) => string }> = {
  risk_register: { label: "Risk register updated", icon: ShieldAlert, tone: "text-rose-600", href: (id) => `/erm/risks/${id}` },
  training_assignment: { label: "Training assigned", icon: GraduationCap, tone: "text-blue-600" },
  audit_checkpoint: { label: "Audit checkpoint added", icon: ClipboardCheck, tone: "text-violet-600" },
  capa: { label: "CAPA linked", icon: Wrench, tone: "text-emerald-600" },
};

export function IncidentDownstreamPanel({ incidentId }: { incidentId: string }) {
  const [links, setLinks] = useState<ThreadLink[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/incidents/${incidentId}/downstream-impact`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setLinks(j?.links ?? []); })
      .catch(() => setLinks([]));
    return () => { alive = false; };
  }, [incidentId]);

  if (links === null || links.length === 0) return null;

  return (
    <Card className="border-indigo-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch size={16} className="text-indigo-600" /> Downstream Impact
        </CardTitle>
        <CardDescription>Everything this incident triggered across the platform (golden thread).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {links.map((l) => {
          const m = META[l.targetType] ?? { label: l.targetType, icon: GitBranch, tone: "text-slate-600" };
          const Icon = m.icon;
          const inner = (
            <div className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${l.reversed ? "border-slate-200 bg-slate-50 opacity-60" : "border-slate-200 hover:bg-slate-50"}`}>
              <span className="flex items-center gap-2 min-w-0">
                <Icon size={15} className={m.tone} />
                <span className="text-slate-800">{m.label}</span>
                {l.targetRef && <span className="font-mono text-xs text-slate-500 truncate">{l.targetRef}</span>}
              </span>
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{l.linkType}</Badge>
                {l.reversed && <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">reversed</Badge>}
              </span>
            </div>
          );
          const href = m.href?.(l.targetId);
          return href && !l.reversed ? <Link key={l.id} href={href}>{inner}</Link> : <div key={l.id}>{inner}</div>;
        })}
      </CardContent>
    </Card>
  );
}
