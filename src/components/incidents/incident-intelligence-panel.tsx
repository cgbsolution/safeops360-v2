"use client";

// Incident Intelligence panel — Features 1 (inline CAPA from root cause) + 2
// (AI-assist chips). Every AI-touched field carries a visible provenance chip
// and an Accept / Edit / Reject control; nothing AI-authored is presented as
// human content. All actions hit the audited FastAPI endpoints; AI endpoints
// are fail-soft (a null result degrades to manual, never an error state).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { UserPicker } from "@/components/ui/user-picker";
import { useToast } from "@/components/ui/toast";
import { Sparkles, Check, Pencil, X, Plus, Loader2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAPA_TYPE_OPTIONS } from "@/lib/capa/options";
import { SelectField } from "@/components/ui/select-field";

type RootCauseSuggestion = {
  text: string;
  confidence: number;
  basedOnIncidentIds?: string[];
  status?: "pending" | "accepted" | "edited" | "rejected";
  generatedAt?: string;
  rejectionReason?: string | null;
};

type AiAssist = {
  summary?: string;
  summarySource?: "human" | "ai_drafted" | "human_confirmed";
  summaryGeneratedAt?: string;
  rootCauseSuggestion?: RootCauseSuggestion | null;
} | null;

export function IncidentIntelligencePanel({
  incidentId,
  plantId,
  rootCauses,
  aiAssist,
  canManage,
}: {
  incidentId: string;
  plantId: string;
  rootCauses: string[];
  aiAssist: AiAssist;
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [summary, setSummary] = useState(aiAssist?.summary ?? "");
  const [summarySource, setSummarySource] = useState(aiAssist?.summarySource ?? "human");
  const [editingSummary, setEditingSummary] = useState(false);
  const [suggestion, setSuggestion] = useState<RootCauseSuggestion | null>(
    aiAssist?.rootCauseSuggestion ?? null,
  );
  const [busy, setBusy] = useState<string>("");

  async function call(path: string, body?: any): Promise<any> {
    const res = await fetch(`/api/incidents/${incidentId}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail ?? j.error ?? `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
  }

  async function patchCauses(next: string[]): Promise<void> {
    const res = await fetch(`/api/incidents/${incidentId}/cause-analysis`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootCauses: next }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail ?? `Could not update root causes (${res.status})`);
    }
  }

  // ─── Feature 2 — AI summary ───
  async function draftSummary() {
    setBusy("summary");
    try {
      const r = await call("/ai/summary");
      if (!r.summary) {
        toast({ variant: "default", title: "AI assist unavailable", description: "Summary drafting is not configured. Enter the summary manually." });
        return;
      }
      setSummary(r.summary);
      setSummarySource("ai_drafted");
    } catch (e: any) {
      toast({ variant: "error", title: "Draft failed", description: e.message });
    } finally {
      setBusy("");
    }
  }

  async function acceptSummary(text?: string) {
    setBusy("summary");
    try {
      const r = await call("/ai/summary/accept", text != null ? { text } : undefined);
      setSummary(r.summary ?? text ?? summary);
      setSummarySource("human_confirmed");
      setEditingSummary(false);
      toast({ variant: "success", title: "Summary confirmed" });
    } catch (e: any) {
      toast({ variant: "error", title: "Could not confirm", description: e.message });
    } finally {
      setBusy("");
    }
  }

  // ─── Feature 2 — AI root-cause suggestion ───
  async function suggestRootCause() {
    setBusy("suggest");
    try {
      const r = await call("/cause-analysis/suggest");
      if (!r.suggestion) {
        toast({ variant: "default", title: "AI assist unavailable", description: "Root-cause suggestion is not configured." });
        return;
      }
      setSuggestion(r.suggestion);
    } catch (e: any) {
      toast({ variant: "error", title: "Suggestion failed", description: e.message });
    } finally {
      setBusy("");
    }
  }

  async function acceptSuggestion(text?: string) {
    if (!suggestion) return;
    setBusy("suggest");
    try {
      const r = await call("/cause-analysis/suggestion/accept", text != null ? { text } : undefined);
      const accepted = r.suggestion ?? { ...suggestion, status: "accepted" };
      // Inject the accepted root cause into the incident's root-cause list.
      const finalText = accepted.text ?? text ?? suggestion.text;
      if (finalText && !rootCauses.includes(finalText)) {
        await patchCauses([...rootCauses, finalText]);
      }
      setSuggestion(accepted);
      toast({ variant: "success", title: "Root cause accepted", description: "Added to the incident's root causes." });
      router.refresh();
    } catch (e: any) {
      toast({ variant: "error", title: "Could not accept", description: e.message });
    } finally {
      setBusy("");
    }
  }

  async function rejectSuggestion(reason: string) {
    if (!suggestion) return;
    setBusy("suggest");
    try {
      const r = await call("/cause-analysis/suggestion/reject", { reason: reason || null });
      setSuggestion(r.suggestion ?? { ...suggestion, status: "rejected", rejectionReason: reason });
      toast({ variant: "default", title: "Suggestion rejected", description: "Logged to the audit trail." });
    } catch (e: any) {
      toast({ variant: "error", title: "Could not reject", description: e.message });
    } finally {
      setBusy("");
    }
  }

  return (
    <Card className="border-violet-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles size={16} className="text-violet-600" /> Incident Intelligence
        </CardTitle>
        <CardDescription>
          AI-assisted drafting and root-cause suggestion. Every AI field is marked and requires your acceptance before it counts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── AI Summary ── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">AI Summary</div>
            {summary && <ProvenanceChip source={summarySource} />}
          </div>
          {summary ? (
            editingSummary ? (
              <SummaryEditor initial={summary} busy={busy === "summary"} onCancel={() => setEditingSummary(false)} onSave={(t) => acceptSummary(t)} />
            ) : (
              <Card className="rounded-md border-slate-200 bg-slate-50/60 p-3 text-sm leading-relaxed text-slate-800 shadow-none">
                {summary}
                {canManage && summarySource === "ai_drafted" && (
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" onClick={() => acceptSummary()} disabled={busy === "summary"}>
                      <Check size={13} /> Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingSummary(true)}>
                      <Pencil size={13} /> Edit
                    </Button>
                  </div>
                )}
              </Card>
            )
          ) : (
            <div className="flex items-center gap-2">
              {canManage ? (
                <Button size="sm" variant="outline" onClick={draftSummary} disabled={busy === "summary"}>
                  {busy === "summary" ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />} Draft with AI
                </Button>
              ) : (
                <p className="text-xs text-slate-400 italic">No AI summary yet.</p>
              )}
            </div>
          )}
        </section>

        {/* ── AI Root-cause suggestion ── */}
        <section className="space-y-2 pt-3 border-t border-slate-100">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">AI Root-Cause Suggestion</div>
          {suggestion && suggestion.status !== "rejected" ? (
            <Card className="rounded-md border-violet-200 bg-violet-50/50 p-3 shadow-none">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-slate-800">{suggestion.text}</p>
                <SuggestionChip suggestion={suggestion} />
              </div>
              {suggestion.basedOnIncidentIds && suggestion.basedOnIncidentIds.length > 0 && (
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Computed from {suggestion.basedOnIncidentIds.length} similar closed incident(s).
                </p>
              )}
              {canManage && (suggestion.status === "pending" || !suggestion.status) && (
                <SuggestionActions
                  busy={busy === "suggest"}
                  text={suggestion.text}
                  onAccept={(t) => acceptSuggestion(t)}
                  onReject={(reason) => rejectSuggestion(reason)}
                />
              )}
            </Card>
          ) : (
            <div className="flex items-center gap-2">
              {canManage ? (
                <Button size="sm" variant="outline" onClick={suggestRootCause} disabled={busy === "suggest"}>
                  {busy === "suggest" ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />} Suggest with AI
                </Button>
              ) : (
                <p className="text-xs text-slate-400 italic">No AI suggestion yet.</p>
              )}
              {suggestion?.status === "rejected" && (
                <span className="text-[11px] text-slate-400 italic">Last suggestion rejected.</span>
              )}
            </div>
          )}
        </section>

        {/* ── Feature 1 — inline CAPA from root cause ── */}
        <section className="space-y-2 pt-3 border-t border-slate-100">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Raise CAPA from Root Cause</div>
          {rootCauses.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Identify root causes in the RCA canvas to raise linked CAPAs here.</p>
          ) : (
            <div className="space-y-1.5">
              {rootCauses.map((rc, i) => (
                <RootCauseCapaRow key={i} cause={rc} plantId={plantId} canManage={canManage}
                  onCreate={async (body) => { await call("/capas", body); toast({ variant: "success", title: "CAPA raised", description: "Linked to this root cause." }); router.refresh(); }} />
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ProvenanceChip({ source }: { source: string }) {
  if (source === "human_confirmed") {
    return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]"><Check size={10} className="mr-0.5" /> Human-confirmed</Badge>;
  }
  if (source === "ai_drafted") {
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]"><Sparkles size={10} className="mr-0.5" /> AI-drafted</Badge>;
  }
  return <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">Manual</Badge>;
}

function SuggestionChip({ suggestion }: { suggestion: RootCauseSuggestion }) {
  if (suggestion.status === "accepted" || suggestion.status === "edited") {
    return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] whitespace-nowrap"><Check size={10} className="mr-0.5" /> {suggestion.status === "edited" ? "Accepted (edited)" : "Accepted"}</Badge>;
  }
  return (
    <Badge className="bg-violet-100 text-violet-800 border-violet-200 text-[10px] whitespace-nowrap">
      <Sparkles size={10} className="mr-0.5" /> AI suggested · {suggestion.confidence}% confidence
    </Badge>
  );
}

function SummaryEditor({ initial, busy, onSave, onCancel }: { initial: string; busy: boolean; onSave: (t: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  return (
    <div className="space-y-2">
      <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onSave(text)} disabled={busy || !text.trim()}><Check size={13} /> Save & confirm</Button>
        <Button size="sm" variant="outline" onClick={onCancel}><X size={13} /> Cancel</Button>
      </div>
    </div>
  );
}

function SuggestionActions({ text, busy, onAccept, onReject }: { text: string; busy: boolean; onAccept: (t?: string) => void; onReject: (reason: string) => void }) {
  const [mode, setMode] = useState<"idle" | "edit" | "reject">("idle");
  const [editText, setEditText] = useState(text);
  const [reason, setReason] = useState("");

  if (mode === "edit") {
    return (
      <div className="space-y-2 mt-3">
        <Textarea rows={2} value={editText} onChange={(e) => setEditText(e.target.value)} />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => onAccept(editText)} disabled={busy || !editText.trim()}><Check size={13} /> Accept edited</Button>
          <Button size="sm" variant="outline" onClick={() => setMode("idle")}><X size={13} /> Cancel</Button>
        </div>
      </div>
    );
  }
  if (mode === "reject") {
    return (
      <div className="space-y-2 mt-3">
        <Input placeholder="Reason for rejecting (optional)…" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="destructive" onClick={() => onReject(reason)} disabled={busy}><X size={13} /> Confirm reject</Button>
          <Button size="sm" variant="outline" onClick={() => setMode("idle")}>Cancel</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 mt-3">
      <Button size="sm" onClick={() => onAccept()} disabled={busy}><Check size={13} /> Accept</Button>
      <Button size="sm" variant="outline" onClick={() => setMode("edit")}><Pencil size={13} /> Edit</Button>
      <Button size="sm" variant="ghost" onClick={() => setMode("reject")} className="text-slate-500"><X size={13} /> Reject</Button>
    </div>
  );
}

function RootCauseCapaRow({ cause, plantId, canManage, onCreate }: {
  cause: string; plantId: string; canManage: boolean;
  onCreate: (body: any) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState("CORRECTIVE");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [description, setDescription] = useState(`Address root cause: ${cause}`);
  const { toast } = useToast();

  async function submit() {
    if (!ownerId) { toast({ variant: "error", title: "Pick a CAPA owner" }); return; }
    if (!targetDate) { toast({ variant: "error", title: "Set a target date" }); return; }
    if (description.trim().length < 10) { toast({ variant: "error", title: "Description too short" }); return; }
    setBusy(true);
    try {
      await onCreate({
        description,
        type,
        rootCauseAddressed: cause,
        linkedCauseId: cause,
        ownerId,
        targetDate: new Date(targetDate).toISOString(),
      });
      setOpen(false);
    } catch (e: any) {
      toast({ variant: "error", title: "Could not raise CAPA", description: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-md border-slate-200 shadow-none">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-sm text-slate-700 truncate">{cause}</span>
        {canManage && !open && (
          <Button size="sm" variant="outline" className="flex-shrink-0" onClick={() => setOpen(true)}>
            <Plus size={13} /> Add CAPA
          </Button>
        )}
      </div>
      {open && (
        <div className="border-t border-slate-100 px-3 py-3 space-y-2.5 bg-slate-50/40">
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <div>
              <Label className="text-xs">Type</Label>
              <SelectField
                value={type}
                onChange={setType}
                ariaLabel="CAPA type"
                options={CAPA_TYPE_OPTIONS}
              />
            </div>
            <div>
              <Label className="text-xs">Target Date</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Owner</Label>
            <UserPicker value={ownerId} onChange={setOwnerId} filter={{ plantId }} placeholder="Assign CAPA owner…" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={submit} disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Raise CAPA</Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
