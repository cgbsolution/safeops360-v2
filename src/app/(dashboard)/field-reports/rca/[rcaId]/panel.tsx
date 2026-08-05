"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Mic, Send, UserRound, UsersRound } from "lucide-react";
import { Can } from "@/components/auth/can";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/client-errors";
import { UserPicker } from "@/components/ui/user-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FieldInput = {
  id: string;
  fishboneCategory: string | null;
  causePath: { level: number; label?: string; code?: string }[];
  controlSuggestionIds: string[];
  note: string | null;
  transcriptOriginal: string | null;
  transcriptEnglish: string | null;
  isAnonymous: boolean;
  contributor: { id: string; name: string; designation: string | null } | null;
  promotedCauseId: string | null;
  createdAt: string | null;
};

const FISHBONE_LABEL: Record<string, string> = {
  EQUIPMENT: "Equipment",
  PERSON: "Person",
  PROCESS: "Process",
  ENVIRONMENT: "Environment",
  MATERIAL: "Material",
  MANAGEMENT: "Management",
  UNKNOWN: "Unclassified",
};

const FISHBONE_COLOR: Record<string, string> = {
  EQUIPMENT: "#2563EB",
  PERSON: "#DB2777",
  PROCESS: "#0891B2",
  ENVIRONMENT: "#16A34A",
  MATERIAL: "#CA8A04",
  MANAGEMENT: "#7C3AED",
  UNKNOWN: "#5A6273",
};

export function RcaFieldInputsPanel({
  rcaId,
  initialByFishbone,
  total,
}: {
  rcaId: string;
  initialByFishbone: Record<string, FieldInput[]>;
  total: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [techIds, setTechIds] = useState<string[]>([]);
  const [summary, setSummary] = useState("");

  async function promote(input: FieldInput) {
    setBusy(input.id);
    try {
      const res = await fetch(`/api/erm/rca/field-inputs/${input.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ causalRole: "CONTRIBUTING", confidence: "POSSIBLE" }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Promote failed"));
      toast({ title: "Promoted to an official cause node", variant: "success" });
      router.refresh();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Promote failed", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function requestInput() {
    if (techIds.length === 0) {
      toast({ title: "Select at least one technician", variant: "error" });
      return;
    }
    setBusy("request");
    try {
      const res = await fetch(`/api/erm/rca/${rcaId}/field-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextSummary: summary, technicianIds: techIds }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Request failed"));
      const data = (await res.json()) as { notified: number };
      toast({ title: `Field input requested from ${data.notified} technician(s)`, variant: "success" });
      setRequesting(false);
      setTechIds([]);
      setSummary("");
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Request failed", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const groups = Object.entries(initialByFishbone);

  return (
    <div className="space-y-6">
      <Can permission="RCA.TAG">
        <div className="rounded-lg border bg-card p-5">
          {!requesting ? (
            <Button
              type="button"
              onClick={() => setRequesting(true)}
              className="flex items-center gap-2 text-sm font-semibold text-primary-foreground"
            >
              <UsersRound className="h-4 w-4" /> Request field input
            </Button>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Request field input</h3>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
                placeholder="One-line context for the technicians (what happened, in plain words)"
                className="form-textarea"
              />
              <UserPicker value={techIds} onChange={setTechIds} multiple filter={{ role: "FIELD_TECHNICIAN", roleFallback: true }} />
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={busy === "request"}
                  onClick={requestInput}
                  className="flex items-center gap-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> {busy === "request" ? "Sending…" : "Send request"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setRequesting(false)} className="text-sm font-semibold hover:bg-accent">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Can>

      {total === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No field contributions yet. Request input from technicians who were on the floor.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map(([fishbone, inputs]) => (
            <div key={fishbone} className="rounded-lg border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: FISHBONE_COLOR[fishbone] ?? "#5A6273" }} />
                <h3 className="text-sm font-semibold">{FISHBONE_LABEL[fishbone] ?? fishbone}</h3>
                <span className="text-xs text-muted-foreground">({inputs.length})</span>
              </div>
              <div className="space-y-3">
                {inputs.map((input) => (
                  <div key={input.id} className="rounded-md border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {input.causePath.map((n, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                          {i > 0 ? <span className="text-muted-foreground">→</span> : null}
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#0B1F4D]">
                            {n.label ?? n.code}
                          </span>
                        </span>
                      ))}
                    </div>
                    {input.transcriptEnglish || input.transcriptOriginal ? (
                      <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                        <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {input.transcriptEnglish ?? input.transcriptOriginal}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UserRound className="h-3.5 w-3.5" />
                        {input.isAnonymous ? "Anonymous" : (input.contributor?.name ?? "—")}
                        {input.createdAt ? ` · ${new Date(input.createdAt).toLocaleDateString("en-IN")}` : ""}
                      </span>
                      {input.promotedCauseId ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Promoted
                        </span>
                      ) : (
                        <Can permission="RCA.TAG">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy === input.id}
                            onClick={() => promote(input)}
                            className={cn(
                              "text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground",
                              busy === input.id && "opacity-50",
                            )}
                          >
                            {busy === input.id ? "Promoting…" : "Promote to cause →"}
                          </Button>
                        </Can>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
