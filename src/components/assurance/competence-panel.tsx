"use client";

// Auditor competence, frozen at assignment (docs/cams/09 §2.2, ISO 19011 cl.7).
//
// This renders a SNAPSHOT, not a live Skill-Matrix read. The distinction is the
// whole point: a certification body asks "was this person qualified when the
// audit was conducted?", and a live read cannot answer that after a
// revalidation, an expiry or a suspension. So the panel says what was true on
// the capture date, and shows that date.
//
// Empty is a legitimate state — it means the audit type declares no required
// competencies, which is every audit type until they are configured. The panel
// says so rather than rendering a misleading green.

import { GraduationCap, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { fmtDate, fmtDateTime, type CompetenceSnapshotRow } from "@/app/(dashboard)/cams/lib-assurance";

export function CompetenceSnapshotPanel({ rows }: { rows: CompetenceSnapshotRow[] }) {
  if (!rows.length) {
    return (
      <Card className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <GraduationCap size={16} className="text-violet-700" />
          Auditor competence
          <span className="text-xs font-normal text-slate-400">ISO 19011 cl.7</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          This audit type declares no required auditor competencies, so none were checked. Configure
          them on the audit type to have assignments verified against the Skill Matrix.
        </p>
      </Card>
    );
  }

  // Group by person — a reader thinks in people, not in competency rows.
  const byUser = new Map<string, CompetenceSnapshotRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r);
    byUser.set(r.userId, list);
  }

  const gaps = rows.filter((r) => !r.held).length;

  return (
    <Card className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <GraduationCap size={16} className="text-violet-700" />
          Auditor competence
          <span className="text-xs font-normal text-slate-400">ISO 19011 cl.7</span>
        </div>
        {gaps > 0 && (
          <span className="ml-auto rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
            {gaps} gap{gaps === 1 ? "" : "s"} at assignment
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[11px] text-slate-500">
        Captured when the auditor was assigned. Later Skill-Matrix changes do not alter this record.
      </p>

      <div className="mt-3 space-y-3">
        {[...byUser.entries()].map(([userId, list]) => (
          <Card key={userId} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 shadow-none">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-medium text-slate-800">
                {list[0].userName ?? userId}
              </span>
              <span className="text-[10px] text-slate-400">
                as at {fmtDateTime(list[0].capturedAt)}
              </span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {list.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1.5 text-[12px]">
                  {r.held ? (
                    <CheckCircle2 size={12} className="text-emerald-600" />
                  ) : r.waivedGap ? (
                    <AlertTriangle size={12} className="text-amber-600" />
                  ) : (
                    <XCircle size={12} className="text-rose-600" />
                  )}
                  <span className={cn(r.held ? "text-slate-700" : "text-rose-700")}>
                    {r.competencyName || r.competencyCode}
                  </span>
                  {r.held && r.validUntil && (
                    <span className="text-[10px] text-slate-400">
                      valid to {fmtDate(r.validUntil)}
                    </span>
                  )}
                  {!r.held && (
                    <span className="text-[10px] text-rose-600">
                      {r.state ? `not held (${r.state})` : "no record"}
                      {r.waivedGap ? " · proceeded with gap" : ""}
                    </span>
                  )}
                  {r.externalCertificateReference && (
                    <span className="rounded bg-white px-1 text-[10px] text-slate-500">
                      {r.externalCertificateReference}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </Card>
  );
}
