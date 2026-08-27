"use client";

// Lessons Learned editor.
//
// The workflow definition calls a closing remark and lessons learned mandatory
// at the incident's closure step, and the read-only Lessons Learned section
// renders `incident.lessonsLearned` — but nothing in the product could ever
// write that column, so the section was permanently invisible and the closing
// approver had nowhere to record what the plant should take away from the
// event. This panel gives the people who own the closure (HSE Manager, Plant
// Head, Corporate HSE, Admin, and the investigation lead) a place to write it
// before they sign the incident off.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Sparkles, Save, Loader2 } from "lucide-react";

export function LessonsLearnedPanel({
  incidentId,
  initial,
  distributedTo,
  canManage,
  isClosed
}: {
  incidentId: string;
  initial: string | null;
  distributedTo: string[] | null;
  canManage: boolean;
  isClosed: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);

  const editable = canManage && !isClosed;
  if (!editable && !saved) return null;

  async function save() {
    setBusy(true);
    try {
      const r = await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonsLearned: text.trim() || null })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail ?? j.error ?? `Save failed (${r.status})`);
      }
      setSaved(text.trim());
      toast({ variant: "success", title: "Lessons learned saved" });
      router.refresh();
    } catch (e: any) {
      toast({ variant: "error", title: "Could not save", description: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="break-inside-avoid border-violet-200 bg-violet-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-violet-900">
          <Sparkles size={16} /> Lessons Learned
        </CardTitle>
        {editable && (
          <CardDescription className="text-violet-700">
            What the plant should take away from this incident. Written before closure and distributed with the closure notification.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {editable ? (
          <>
            <div>
              <Label>Lessons Learned</Label>
              <Textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="One or two sentences a supervisor could read out at a shift start-up…"
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={save} disabled={busy || text.trim() === saved.trim()}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Lessons Learned
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-violet-900 whitespace-pre-wrap">{saved}</p>
        )}
        {distributedTo && Array.isArray(distributedTo) && distributedTo.length > 0 && (
          <div className="text-xs text-violet-700 print:hidden">
            Distributed to {distributedTo.length} plant{distributedTo.length === 1 ? "" : "s"}.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
