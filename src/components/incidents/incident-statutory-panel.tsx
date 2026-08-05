"use client";

// Feature 4 — statutory form auto-generation. Shows which forms are required
// (determined at classification) and their fill status; lets a reviewer generate
// + preview the rendered filled form. Immutable versions (regeneration = new
// version). A non-reportable incident correctly shows "no forms required".

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { FileText, Download, Loader2, CheckCircle2, FilePlus } from "lucide-react";

type Instance = {
  id: string; formType: string; version: number; fileName: string;
  jurisdiction: string | null; isCurrent: boolean; createdAt: string | null;
};
type Obligation = { required: boolean; forms: string[]; jurisdiction?: string | null };

const FORM_LABEL: Record<string, string> = {
  FORM_18: "Factories Act — Form 18",
  ESIC_FORM_16: "ESIC — Form 16",
  DGFASLI_REPORT: "DGFASLI Notification",
  CPCB_NOTIFICATION: "CPCB Notification",
};

export function IncidentStatutoryPanel({ incidentId, canManage }: { incidentId: string; canManage: boolean }) {
  const { toast } = useToast();
  const [obligation, setObligation] = useState<Obligation | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/incidents/${incidentId}/statutory-forms`);
    if (r.ok) {
      const j = await r.json();
      setObligation(j.obligation ?? { required: false, forms: [] });
      setInstances(j.instances ?? []);
    }
    setLoaded(true);
  }, [incidentId]);

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
      </CardContent>
    </Card>
  );
}
