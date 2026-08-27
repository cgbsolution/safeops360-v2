"use client";

// Feature 4 — statutory form auto-generation. Shows which forms are required
// (determined at classification) and their fill status; lets a reviewer generate
// + preview the rendered filled form. Immutable versions (regeneration = new
// version). A non-reportable incident correctly shows "no forms required".

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { FileText, Download, Loader2, CheckCircle2, FilePlus, Send } from "lucide-react";

type Instance = {
  id: string; formType: string; version: number; fileName: string;
  jurisdiction: string | null; isCurrent: boolean; createdAt: string | null;
};
type Obligation = { required: boolean; forms: string[]; jurisdiction?: string | null };

// The regulations whose filing can be recorded against the incident, in the
// order they are shown. Keyed to Incident.reportableUnder.
const FILINGS = [
  { code: "FACTORIES_ACT", label: "Form 18 — Inspector of Factories", hasRef: true },
  { code: "DGFASLI", label: "DGFASLI accident return", hasRef: false },
  { code: "CPCB", label: "CPCB environmental notification", hasRef: false },
] as const;

type FilingState = {
  reportableUnder: string[] | null;
  form18Submitted: boolean; form18SubmissionDate: string | null; form18SubmissionRef: string | null;
  dgfasliSubmitted: boolean; dgfasliSubmissionDate: string | null;
  cpcbSubmitted: boolean; cpcbSubmissionDate: string | null;
};

const FORM_LABEL: Record<string, string> = {
  FORM_18: "Factories Act — Form 18",
  ESIC_FORM_16: "ESIC — Form 16",
  DGFASLI_REPORT: "DGFASLI Notification",
  CPCB_NOTIFICATION: "CPCB Notification",
};

export function IncidentStatutoryPanel({ incidentId, canManage }: { incidentId: string; canManage: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [obligation, setObligation] = useState<Obligation | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  // Filing record. Generating a form is not the same act as filing it, and
  // workflow step 9 ("Statutory Forms Submission") asks the HSE Manager to
  // record the filing — but the only UI that could was the investigation
  // panel's Statutory tab, which stops rendering once the investigation step
  // is complete. So by the time the workflow asked for the submission there
  // was nowhere to enter it, and closure was gated on a field nobody could set.
  const [filing, setFiling] = useState<FilingState | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [form18Ref, setForm18Ref] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/incidents/${incidentId}/statutory-forms`);
    if (r.ok) {
      const j = await r.json();
      setObligation(j.obligation ?? { required: false, forms: [] });
      setInstances(j.instances ?? []);
    }
    const ri = await fetch(`/api/incidents/${incidentId}`);
    if (ri.ok) {
      const j = await ri.json();
      setFiling({
        reportableUnder: j.reportableUnder ?? null,
        form18Submitted: !!j.form18Submitted,
        form18SubmissionDate: j.form18SubmissionDate ?? null,
        form18SubmissionRef: j.form18SubmissionRef ?? null,
        dgfasliSubmitted: !!j.dgfasliSubmitted,
        dgfasliSubmissionDate: j.dgfasliSubmissionDate ?? null,
        cpcbSubmitted: !!j.cpcbSubmitted,
        cpcbSubmissionDate: j.cpcbSubmissionDate ?? null,
      });
      setForm18Ref(j.form18SubmissionRef ?? "");
    }
    setLoaded(true);
  }, [incidentId]);

  async function markSubmitted(code: string) {
    const date = dates[code];
    if (!date) {
      toast({ variant: "error", title: "Date required", description: "Pick the date the return was filed." });
      return;
    }
    setBusy(code);
    const payload: Record<string, unknown> = {};
    if (code === "FACTORIES_ACT") {
      payload.form18Submitted = true;
      payload.form18SubmissionDate = new Date(date).toISOString();
      payload.form18SubmissionRef = form18Ref || null;
    } else if (code === "DGFASLI") {
      payload.dgfasliSubmitted = true;
      payload.dgfasliSubmissionDate = new Date(date).toISOString();
    } else {
      payload.cpcbSubmitted = true;
      payload.cpcbSubmissionDate = new Date(date).toISOString();
    }
    try {
      const r = await fetch(`/api/incidents/${incidentId}/statutory-submissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.detail ?? `Failed (${r.status})`); }
      toast({ variant: "success", title: "Filing recorded" });
      await load();
      router.refresh();
    } catch (e: any) {
      toast({ variant: "error", title: "Could not record the filing", description: e.message });
    } finally {
      setBusy("");
    }
  }

  useEffect(() => { load(); }, [load]);

  async function generate(formType: string) {
    setBusy(formType);
    try {
      const r = await fetch(`/api/incidents/${incidentId}/generate-statutory-form/${formType}`, { method: "POST" });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.detail ?? `Failed (${r.status})`); }
      toast({ variant: "success", title: "Form generated", description: `${FORM_LABEL[formType] ?? formType} is ready to preview.` });
      await load();
    } catch (e: any) {
      toast({ variant: "error", title: "Generation failed", description: e.message });
    } finally {
      setBusy("");
    }
  }

  if (!loaded) return null;

  // A non-reportable incident correctly shows zero required forms.
  if (!obligation?.required && instances.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><FileText size={16} className="text-slate-500" /> Statutory Forms</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">No statutory forms required for this incident.</p>
        </CardContent>
      </Card>
    );
  }

  const currentByType = new Map(instances.filter((i) => i.isCurrent).map((i) => [i.formType, i]));
  const allTypes = Array.from(new Set([...(obligation?.forms ?? []), ...instances.map((i) => i.formType)]));

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><FileText size={16} className="text-blue-600" /> Statutory Forms</CardTitle>
        <CardDescription>
          Required forms determined at classification{obligation?.jurisdiction ? ` · ${obligation.jurisdiction}` : ""}. Generated forms are immutable; regenerating creates a new version.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {allTypes.map((ft) => {
          const cur = currentByType.get(ft);
          return (
            <div key={ft} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2">
              <span className="flex items-center gap-2 min-w-0">
                {cur ? <CheckCircle2 size={15} className="text-emerald-600" /> : <FilePlus size={15} className="text-amber-600" />}
                <span className="text-sm text-slate-800">{FORM_LABEL[ft] ?? ft}</span>
                {cur ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">v{cur.version} generated</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">not generated</Badge>
                )}
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                {cur && (
                  <a href={`/api/incidents/${incidentId}/statutory-forms/${cur.id}/download`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><Download size={13} /> Preview</Button>
                  </a>
                )}
                {canManage && (
                  <Button size="sm" onClick={() => generate(ft)} disabled={busy === ft}>
                    {busy === ft ? <Loader2 size={13} className="animate-spin" /> : <FilePlus size={13} />} {cur ? "Regenerate" : "Generate"}
                  </Button>
                )}
              </span>
            </div>
          );
        })}

        {/* Filing record — recording that a return was actually filed. */}
        {filing?.reportableUnder?.length ? (
          <div className="pt-3 mt-1 border-t border-slate-200 space-y-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Filing Record</div>
            {FILINGS.filter((f) => filing.reportableUnder?.includes(f.code)).map((f) => {
              const submitted =
                f.code === "FACTORIES_ACT" ? filing.form18Submitted
                  : f.code === "DGFASLI" ? filing.dgfasliSubmitted
                    : filing.cpcbSubmitted;
              const when =
                f.code === "FACTORIES_ACT" ? filing.form18SubmissionDate
                  : f.code === "DGFASLI" ? filing.dgfasliSubmissionDate
                    : filing.cpcbSubmissionDate;
              return (
                <div key={f.code} className="rounded-md border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-800">{f.label}</span>
                    {submitted ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                        filed{when ? ` ${new Date(when).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">not filed</Badge>
                    )}
                  </div>
                  {submitted && f.code === "FACTORIES_ACT" && filing.form18SubmissionRef && (
                    <div className="text-xs text-slate-500 mt-1 font-mono">Ref: {filing.form18SubmissionRef}</div>
                  )}
                  {!submitted && canManage && (
                    <div className="grid sm:grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-slate-100 items-end">
                      <div>
                        <Label>Submission Date</Label>
                        <Input type="date" value={dates[f.code] ?? ""}
                          onChange={(e) => setDates({ ...dates, [f.code]: e.target.value })} />
                      </div>
                      {f.hasRef && (
                        <div>
                          <Label>Inspector Reference No.</Label>
                          <Input value={form18Ref} onChange={(e) => setForm18Ref(e.target.value)}
                            placeholder="e.g. INS/HSN/2026/0418" />
                        </div>
                      )}
                      <div className={f.hasRef ? "" : "sm:col-span-2"}>
                        <Button size="sm" disabled={busy === f.code} onClick={() => markSubmitted(f.code)}>
                          {busy === f.code ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Mark Submitted
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
