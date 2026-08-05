import { CheckCircle2, ClipboardCheck, Paperclip, RotateCcw, ShieldCheck, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDateTime, cn } from "@/lib/utils";
import { formatPartyMeta, formatPartyName } from "@/lib/users/user-ref";
import type { Party } from "@/lib/workflow/party";

// "What was actually done about this?" — the substantive record of the
// workflow, as opposed to the Audit Trail's who-clicked-what log.
//
// The action owner's corrective-action narrative, the verifier's findings and
// any rework reason were only ever rendered as a one-line italic quote inside
// the collapsed Audit Trail accordion. That is the single most important
// content on a closed record — the proof the hazard was actually dealt with —
// and it was the hardest thing on the page to find. This surfaces it as a
// first-class section, in the order it happened.

type Entry = {
  id: string;
  stepId: string | null;
  stepName: string;
  action: string;
  performedAt: Date | string;
  comments?: string | null;
  /** JSON array of filenames, as written by the engine. */
  attachments?: string | null;
  performedBy: Party;
};

type Step = { id: string; stepType: string };

/** Filenames the actor attached to this step, tolerant of legacy/malformed JSON. */
function parseAttachments(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * How each entry presents. Keyed on the workflow action rather than the step
 * name so a module that renames its steps still renders correctly.
 */
const PRESENTATION: Record<
  string,
  { title: string; icon: typeof CheckCircle2; tone: string; label: string }
> = {
  EXECUTED: {
    title: "Corrective Action Taken",
    icon: ClipboardCheck,
    tone: "border-emerald-200 bg-emerald-50/60",
    label: "text-emerald-800"
  },
  VERIFIED: {
    title: "Verification",
    icon: ShieldCheck,
    tone: "border-blue-200 bg-blue-50/60",
    label: "text-blue-800"
  },
  APPROVED: {
    title: "Review Remark",
    icon: UserCheck,
    tone: "border-slate-200 bg-slate-50",
    label: "text-slate-700"
  },
  REJECTED: {
    title: "Sent Back for Rework",
    icon: RotateCcw,
    tone: "border-rose-200 bg-rose-50/60",
    label: "text-rose-800"
  },
  COMPLETED: {
    title: "Closure",
    icon: CheckCircle2,
    tone: "border-emerald-200 bg-emerald-50/60",
    label: "text-emerald-800"
  },
  COMMENTED: {
    title: "Comment",
    icon: UserCheck,
    tone: "border-slate-200 bg-slate-50",
    label: "text-slate-700"
  }
};

/**
 * An entry earns a place here if it carries something a reader needs: a
 * narrative, or evidence. A bare APPROVED with no remark is pure process and
 * stays in the Audit Trail — repeating it here would bury the signal.
 * EXECUTED is always shown: "the action owner completed this and wrote nothing"
 * is itself worth seeing.
 */
function isSubstantive(e: Entry): boolean {
  if (e.action === "EXECUTED") return true;
  return Boolean(e.comments?.trim()) || parseAttachments(e.attachments).length > 0;
}

export function ActionRecordPanel({
  history,
  steps,
  title = "Corrective Action & Remarks",
  description = "What the action owner did, the evidence they attached, and the verifier's findings.",
  exclude
}: {
  history: Entry[];
  steps?: Step[];
  title?: string;
  description?: string;
  /** Actions a module already renders in a bespoke card of its own — Near Miss
   *  has a dedicated "Verification & Effectiveness" section, for instance.
   *  Excluding them here avoids showing the same text twice on one page. */
  exclude?: string[];
}) {
  const skip = new Set(exclude ?? []);
  const entries = history.filter(
    (h) => PRESENTATION[h.action] && !skip.has(h.action) && isSubstantive(h)
  );
  if (entries.length === 0) return null;

  // Chronological — a rework loop reads as execute → reject → execute again,
  // which is exactly the story a reviewer needs.
  const ordered = [...entries].sort(
    (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
  );

  // A verifier rejection and a checker rejection mean different things; use the
  // step type to say which, when the definition is available.
  const stepTypeById = new Map((steps ?? []).map((s) => [s.id, s.stepType]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ordered.map((e) => {
          const p = PRESENTATION[e.action];
          const Icon = p.icon;
          const files = parseAttachments(e.attachments);
          const meta = formatPartyMeta(e.performedBy);
          const stepType = e.stepId ? stepTypeById.get(e.stepId) : undefined;
          const heading =
            e.action === "REJECTED" && stepType === "CHECKER" ? "Returned by Reviewer" : p.title;
          return (
            <div key={e.id} className={cn("rounded-lg border px-4 py-3", p.tone)}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className={cn("flex items-center gap-2 text-sm font-semibold", p.label)}>
                  <Icon size={15} />
                  {heading}
                  <span className="font-normal text-slate-500">· {e.stepName}</span>
                </div>
                <div className="text-xs text-slate-500">{formatDateTime(e.performedAt)}</div>
              </div>

              {e.comments?.trim() ? (
                <p className="mt-2 whitespace-pre-wrap text-slate-800">{e.comments}</p>
              ) : (
                <p className="mt-2 text-sm italic text-slate-500">
                  Completed without a written narrative.
                </p>
              )}

              {files.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Paperclip size={12} className="text-slate-400" />
                  {files.map((f) => (
                    <span
                      key={f}
                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-2 text-xs text-slate-500">
                By <span className="font-medium text-slate-700">{formatPartyName(e.performedBy)}</span>
                {meta && <> · {meta}</>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
