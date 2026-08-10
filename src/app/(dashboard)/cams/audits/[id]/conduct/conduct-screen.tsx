"use client";

// ──────────────────────────────────────────────────────────────────────
// THE SHOWPIECE — on-site conduct UI engineered for LARGE audits (≈1500
// checkpoints). Discipline-scoped, server-paginated worklist: the screen never
// holds more than one discipline's page in memory. Left/top discipline
// navigator (from the rollup — no row load), grade filter + search, inline
// grading per card with auto-save, and bulk "mark discipline" fast paths. Every
// checkpoint is reachable; nothing is rendered until scoped to.
//
// Grading is the Page Industries internal-audit model — the seven columns their
// auditors already fill in on the workbook:
//
//   C Grade Awarded    the one control that decides everything else
//   D Score Allotted   3, or nothing for an N/A checkpoint
//   E Score Obtained   auto-filled from the grade, overridable
//   F Status           auto-suggested from the grade, overridable
//   G Audit Findings   the auditor's comment (required on any finding)
//   H Risk Grade       the auditor's read on what they found
//   I Requirement Type master data, read-only
//
// The card is laid out so a fully-compliant checkpoint is ONE tap: pick
// Effective and the score, status and (absent) risk grade all settle
// themselves. The extra fields only unfold when the grade makes them matter.
// ──────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Check, Camera, AlertTriangle, Link2, Loader2, X, ArrowLeft,
  Trash2, UserRound, Sparkles, Plus, Search, ListChecks, ChevronDown, Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  AuditDetail, CheckpointResponse, DisciplineRollup,
  CRITICALITY_CHIP, CRITICALITY_FALLBACK, PlantUser, apiErrorMessage,
  GradeAwarded, ComplianceStatus, RiskGrade,
  GRADE_META, GRADE_ORDER, GRADE_TO_VALUE, STATUS_META, STATUS_ORDER,
  RISK_META, RISK_ORDER, REQUIREMENT_TYPE_META,
  SCORE_CHOICES, FULL_SCORE, suggestScore, suggestStatus, requiresRiskGrade,
} from "../../lib";
import {
  uploadAuditAttachment, deleteAuditAttachment, IMAGE_ACCEPT, DOCUMENT_ACCEPT,
} from "../../upload-attachment";
import { AttachmentStrip } from "../../attachment-tile";
// WP-44: annotation + QR jump. Both reuse existing platform pieces rather
// than introducing a second markup surface or a second QR scheme.
import { PhotoAnnotator } from "@/components/assurance/photo-annotator";
import { QrJumpButton } from "@/components/assurance/qr-jump";

type Resp = CheckpointResponse;
/** "ungraded" filters on the absence of a grade; the rest are grade codes. */
type GradeFilter = "all" | "ungraded" | GradeAwarded;
type Bucket = "passed" | "partial" | "failed" | "na";

const SEVERITIES = ["critical", "major", "minor", "observation"] as const;
const PAGE = 40;

const GRADE_TABS: { key: GradeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ungraded", label: "Not graded" },
  ...GRADE_ORDER.map((g) => ({ key: g as GradeFilter, label: GRADE_META[g].short })),
];

// Grade → rollup bucket key (null = not graded). The rollup still counts in the
// engine's four buckets, so the navigator and the RAG bars keep working exactly
// as before — the grade is a richer face on the same verdict.
function bucketOfGrade(g: GradeAwarded | null | undefined): Bucket | null {
  if (!g) return null;
  const v = GRADE_TO_VALUE[g];
  if (v === "pass") return "passed";
  if (v === "partial") return "partial";
  if (v === "fail") return "failed";
  return "na";
}

export function ConductScreen({ audit, users = [] }: { audit: AuditDetail; users?: PlantUser[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const me = (session?.user as { id?: string } | undefined)?.id;
  // Multi-auditor: when a co-auditor is assigned disciplines, "My disciplines"
  // narrows the worklist to the checkpoints assigned to the current auditor.
  const isCoAuditor = !!me && me !== audit.leadAuditorUserId
    && (audit.coAuditors ?? []).some((c) => (typeof c === "string" ? c : c.userId) === me);
  const [mineOnly, setMineOnly] = useState(false);

  // Names come from the AUDIT first, the plant directory second.
  //
  // `users` is fetched as /users?plantId=<the audit's plant>, so it can only
  // ever name people who work at that plant — and a checkpoint may legitimately
  // be assigned to someone who does not. That is how the EMS and EnMS
  // disciplines came to read "Unknown user" on every checkpoint while QMS and
  // OHS looked fine: their owners simply belonged to a different site.
  //
  // `audit.userNames` is built server-side from everyone named on this audit,
  // whatever their plant, so it is the authoritative map; the directory is kept
  // as a fallback for anyone the payload predates.
  const userName = useMemo(() => {
    const m = new Map<string, string>(users.map((u) => [u.id, u.name] as const));
    for (const [id, name] of Object.entries(audit.userNames ?? {})) m.set(id, name);
    return (id: string | null | undefined) => (id ? m.get(id) ?? "Unknown user" : null);
  }, [users, audit.userNames]);

  // Live discipline rollup (drives the navigator + overall progress). Seeded
  // from the slim detail payload and kept in sync as responses are saved.
  const [rollup, setRollup] = useState<DisciplineRollup[]>(() =>
    [...(audit.disciplineRollup ?? [])].sort((a, b) => a.categoryName.localeCompare(b.categoryName)),
  );

  // Selected discipline ("ALL" = across disciplines) + filters.
  const [disciplineId, setDisciplineId] = useState<string>(() => {
    const firstOpen = (audit.disciplineRollup ?? []).find((c) => c.answered < c.total);
    return firstOpen?.categoryId ?? audit.disciplineRollup?.[0]?.categoryId ?? "ALL";
  });
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [q, setQ] = useState("");
  // WP-44: a captured photo held for markup before it is attached. The
  // ORIGINAL is always uploaded; the annotated copy is uploaded alongside it.
  const [pendingPhoto, setPendingPhoto] = useState<{ item: Resp; file: File; url: string } | null>(null);
  const [qDebounced, setQDebounced] = useState("");

  // Paged checkpoint slice for the current discipline + filter + search.
  const [items, setItems] = useState<Resp[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);

  const answeredTotal = rollup.reduce((s, c) => s + c.answered, 0);
  const grandTotal = rollup.reduce((s, c) => s + c.total, 0);
  const pct = grandTotal ? Math.round((answeredTotal / grandTotal) * 100) : 0;
  const selectedDisc = rollup.find((c) => c.categoryId === disciplineId);

  // Debounce search.
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const fetchPage = useCallback(
    async (reset: boolean, cur: string | null) => {
      const params = new URLSearchParams();
      if (disciplineId !== "ALL") params.set("disciplineId", disciplineId);
      // "Not graded" is still the engine's unanswered filter — a checkpoint has
      // no grade for exactly as long as it has no verdict.
      if (gradeFilter === "ungraded") params.set("value", "unanswered");
      else if (gradeFilter !== "all") params.set("grade", gradeFilter);
      if (qDebounced) params.set("q", qDebounced);
      if (mineOnly) params.set("mine", "true");
      params.set("limit", String(PAGE));
      if (!reset && cur) params.set("cursor", cur);
      if (reset) setLoading(true); else setLoadingMore(true);
      try {
        const res = await fetch(`/api/audit-compliance/${audit.id}/checkpoints?${params.toString()}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          toast({ variant: "error", title: "Couldn't load checkpoints", description: apiErrorMessage(j, res.status) });
          return;
        }
        const j = await res.json();
        setTotal(j.total ?? 0);
        setCursor(j.nextCursor ?? null);
        setItems((prev) => (reset ? j.items : [...prev, ...j.items]));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [audit.id, disciplineId, gradeFilter, qDebounced, mineOnly, toast],
  );

  // Refetch when scope/filter/search changes.
  useEffect(() => {
    fetchPage(true, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disciplineId, gradeFilter, qDebounced, mineOnly]);

  function patchItem(id: string, fn: (r: Resp) => Resp) {
    setItems((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));
  }

  // Apply a grading change to the live rollup (keeps navigator + progress +
  // discipline score live without a refetch). oldB/newB are rollup bucket keys
  // (or null = not graded); the score deltas are points.
  function applyDelta(
    catId: string, oldB: Bucket | null, newB: Bucket | null, crit: boolean,
    scoreDelta = 0, allottedDelta = 0,
  ) {
    if (oldB === newB && !scoreDelta && !allottedDelta) return;
    setRollup((prev) => prev.map((c) => {
      if (c.categoryId !== catId) return c;
      const n = { ...c };
      if (oldB !== newB) {
        if (oldB) { n[oldB] = Math.max(0, n[oldB] - 1); n.answered = Math.max(0, n.answered - 1); if (oldB === "failed" && crit) n.criticalFailed = Math.max(0, n.criticalFailed - 1); }
        if (newB) { n[newB] = n[newB] + 1; n.answered = n.answered + 1; if (newB === "failed" && crit) n.criticalFailed = n.criticalFailed + 1; }
      }
      n.scoreObtained += scoreDelta;
      n.scoreAllotted += allottedDelta;
      // Recomputed rather than nudged: the percentage is a ratio of two running
      // totals, and drifting it independently is how a live number stops
      // matching the one the server would return.
      n.scorePct = n.scoreAllotted
        ? Math.round((n.scoreObtained / n.scoreAllotted) * 1000) / 10
        : 0;
      return n;
    }));
  }

  const saveField = useCallback(
    async (item: Resp, body: Record<string, unknown>, optimistic: (r: Resp) => Resp) => {
      patchItem(item.id, (r) => { const o = optimistic(r); return { ...o, auditorResponse: { ...(o.auditorResponse ?? { value: null }), is_saved: false } }; });
      setSavingIds((s) => new Set(s).add(item.id));
      try {
        const doPost = () => fetch(`/api/audit-compliance/${audit.id}/responses`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ checkpointCode: item.checkpointCode, ...body }),
        }).catch(() => null);
        let r = await doPost();
        if (!r || r.status >= 500) { await new Promise((res) => setTimeout(res, 500)); r = await doPost(); }
        if (!r) { toast({ variant: "error", title: "Network error", description: "Your last change wasn't saved." }); return false; }
        if (!r.ok) { const j = await r.json().catch(() => ({})); toast({ variant: "error", title: "Couldn't save", description: apiErrorMessage(j, r.status) }); return false; }
        patchItem(item.id, (rr) => ({ ...rr, auditorResponse: { ...(rr.auditorResponse ?? { value: null }), is_saved: true } }));
        return true;
      } finally {
        setSavingIds((s) => { const n = new Set(s); n.delete(item.id); return n; });
      }
    },
    [audit.id, toast],
  );

  /**
   * Column C — the grade, and everything that follows from it.
   *
   * Tapping the current grade again clears it, matching the old verdict
   * buttons. Clearing takes the status, score and risk grade with it: a
   * checkpoint with a Non Compliance status and no grade is a state the
   * workbook has no row for, and leaving one behind would quietly keep the
   * checkpoint in the score denominator.
   */
  async function setGrade(item: Resp, g: GradeAwarded) {
    const cur = item.gradeAwarded ?? null;
    const next = cur === g ? null : g;
    const oldB = bucketOfGrade(cur), newB = bucketOfGrade(next);

    // Status is only auto-suggested when the auditor has not already chosen
    // one — re-grading must never downgrade a Repeated Non Compliance.
    const status = next === null ? null : (item.complianceStatus ?? suggestStatus(next));
    const score = suggestScore(next, status);
    const allotted = next === null || next === "NA" ? null : FULL_SCORE;
    const risk = requiresRiskGrade(next) ? item.riskGrade : null;

    const ok = await saveField(
      item,
      { gradeAwarded: next, complianceStatus: status, riskGrade: risk },
      (r) => ({
        ...r, gradeAwarded: next, complianceStatus: status, riskGrade: risk,
        scoreObtained: score, scoreAllotted: allotted,
        auditorResponse: { ...(r.auditorResponse ?? { value: null }), value: next ? GRADE_TO_VALUE[next] : null },
      }),
    );
    if (ok) {
      applyDelta(
        item.categoryId, oldB, newB, item.criticality === "critical",
        (score ?? 0) - (item.scoreObtained ?? 0),
        (allotted ?? 0) - (item.scoreAllotted ?? 0),
      );
    }
  }

  /** Column F. Changing to (or away from) a Repeated status re-derives the
   *  score, which is where the workbook's −1 comes from. */
  async function setStatus(item: Resp, s: ComplianceStatus) {
    const next = item.complianceStatus === s ? null : s;
    const score = suggestScore(item.gradeAwarded ?? null, next);
    const ok = await saveField(
      item,
      { complianceStatus: next },
      (r) => ({ ...r, complianceStatus: next, scoreObtained: score }),
    );
    if (ok) applyDelta(item.categoryId, null, null, false, (score ?? 0) - (item.scoreObtained ?? 0), 0);
  }

  /** Column H — the auditor's read on the finding. */
  async function setRiskGrade(item: Resp, rg: RiskGrade) {
    const next = item.riskGrade === rg ? null : rg;
    await saveField(item, { riskGrade: next }, (r) => ({ ...r, riskGrade: next }));
  }

  /** Column E — the override. Sent explicitly so the server keeps it rather
   *  than re-deriving from the grade ladder. */
  async function setScore(item: Resp, score: number) {
    const ok = await saveField(item, { scoreObtained: score }, (r) => ({ ...r, scoreObtained: score }));
    if (ok) applyDelta(item.categoryId, null, null, false, score - (item.scoreObtained ?? 0), 0);
  }

  // Debounced audit-findings save (column G).
  const obsTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  function setObservation(item: Resp, text: string) {
    patchItem(item.id, (r) => ({ ...r, auditorResponse: { ...(r.auditorResponse ?? { value: null }), text_observation: text } }));
    const m = obsTimers.current;
    if (m.get(item.id)) clearTimeout(m.get(item.id)!);
    m.set(item.id, setTimeout(() => saveField(item, { auditFindings: text }, (r) => r), 700));
  }

  // Offer markup first. Images only — a document has nothing to draw on, so it
  // goes straight up rather than opening a canvas over a blank frame.
  function addPhoto(item: Resp, file: File) {
    if (file.type.startsWith("image/")) {
      setPendingPhoto({ item, file, url: URL.createObjectURL(file) });
      return;
    }
    void uploadPhoto(item, file);
  }

  async function uploadPhoto(item: Resp, file: File, annotated?: Blob) {
    const isDoc = !file.type.startsWith("image/");
    const res = await uploadAuditAttachment(file, { auditId: audit.id, checkpointCode: item.checkpointCode });
    if (!res.ok) {
      toast({ variant: "error", title: isDoc ? "Document upload failed" : "Photo upload failed", description: res.error });
      return;
    }

    // One capture = ONE attachment. Both objects are still stored — the marked
    // copy is what the checkpoint shows, the untouched original hangs off it
    // via originalStoragePath — because two identical-looking thumbnails per
    // photo read as a duplication bug, while silently discarding the unmarked
    // evidence would be the worse trade.
    let photo = res.attachment;
    if (annotated) {
      const marked = new File([annotated], `annotated-${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
        type: "image/jpeg",
      });
      const res2 = await uploadAuditAttachment(marked, { auditId: audit.id, checkpointCode: item.checkpointCode });
      // If only the derivative fails, keep the original as the attachment
      // rather than losing the capture over a failed re-encode.
      if (res2.ok) {
        photo = { ...res2.attachment, originalStoragePath: res.attachment.storagePath, originalUrl: res.attachment.url };
      }
    }

    const photos = [...(item.auditorResponse?.photos ?? []), photo];
    await saveField(item, { photos }, (r) => ({ ...r, auditorResponse: { ...(r.auditorResponse ?? { value: null }), photos } }));
    toast({
      variant: "success",
      title: annotated ? "Annotated photo attached" : isDoc ? "Document attached" : "Photo attached",
      description: annotated
        ? "The unmarked original is retained on the record."
        : isDoc ? photo.fileName : undefined,
    });
  }

  function dataUrlToBlob(dataUrl: string): Blob {
    const [head, b64] = dataUrl.split(",");
    const mime = /:(.*?);/.exec(head)?.[1] ?? "image/jpeg";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  async function removePhoto(item: Resp, i: number) {
    const photos = item.auditorResponse?.photos ?? [];
    const removed = photos[i];
    const next = photos.filter((_, idx) => idx !== i);
    await saveField(item, { photos: next }, (r) => ({ ...r, auditorResponse: { ...(r.auditorResponse ?? { value: null }), photos: next } }));
    void deleteAuditAttachment(removed?.storagePath);
    // An annotated attachment owns two objects. Dropping only the marked copy
    // would orphan the original in storage with nothing left referencing it.
    void deleteAuditAttachment(removed?.originalStoragePath);
  }

  async function bulkMark(value: "pass" | "na") {
    if (disciplineId === "ALL" || !selectedDisc) { toast({ variant: "error", title: "Pick a discipline", description: "Bulk actions apply to one discipline at a time." }); return; }
    setBulkBusy(value);
    const res = await fetch(`/api/audit-compliance/${audit.id}/responses/bulk`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ value, disciplineId, onlyUnanswered: true }),
    });
    setBulkBusy(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast({ variant: "error", title: "Bulk update failed", description: apiErrorMessage(j, res.status) }); return; }
    const j = await res.json();
    const moved = j.updated ?? 0;
    const bucket: Bucket = value === "pass" ? "passed" : "na";
    // Bulk-marking grades too: Pass becomes Effective (3 of 3), N/A becomes
    // N/A (nothing of nothing). The rollup has to move both the counts and the
    // points or the discipline would read "complete" at 0%.
    const points = value === "pass" ? moved * FULL_SCORE : 0;
    setRollup((prev) => prev.map((c) => {
      if (c.categoryId !== disciplineId) return c;
      const n = { ...c, [bucket]: c[bucket] + moved, answered: c.answered + moved };
      n.scoreObtained += points;
      n.scoreAllotted += points;
      n.scorePct = n.scoreAllotted ? Math.round((n.scoreObtained / n.scoreAllotted) * 1000) / 10 : 0;
      return n;
    }));
    toast({
      variant: "success",
      title: `Marked ${moved} checkpoint${moved === 1 ? "" : "s"} ${value === "pass" ? "Effective" : "N/A"}`,
      description: selectedDisc.categoryName,
    });
    fetchPage(true, null);
  }

  async function doSubmit() {
    setSubmitting(true);
    const res = await fetch(`/api/audit-compliance/${audit.id}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const j = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (res.ok) {
      const caps = j.capasSpawned ?? 0;
      toast({ variant: "success", title: "Audit submitted", description: `Overall compliance ${j.score?.overall_score_pct ?? "—"}%. Findings routed to auditees${caps ? ` · ${caps} CAPA${caps > 1 ? "s" : ""} auto-raised` : ""}.` });
      router.push(`/cams/audits/${audit.id}`);
      router.refresh();
    } else {
      setShowSubmit(false);
      toast({ variant: "error", title: "Couldn't submit audit", description: apiErrorMessage(j, res.status) });
    }
  }

  // Live audit score in the header — the workbook's own arithmetic, summed
  // across disciplines. Shown as points AND percent because a percentage on
  // its own is not checkable against the sheet the customer already keeps.
  const scoreObtained = rollup.reduce((s, c) => s + (c.scoreObtained ?? 0), 0);
  const scoreAllotted = rollup.reduce((s, c) => s + (c.scoreAllotted ?? 0), 0);
  const scorePct = scoreAllotted ? Math.round((scoreObtained / scoreAllotted) * 1000) / 10 : null;

  return (
    <div className="mx-auto max-w-6xl pb-28">
      {/* Header + overall progress */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-t-xl">
        <div className="flex items-center gap-2">
          <Link href={`/cams/audits/${audit.id}`} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><ArrowLeft size={18} /></Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800">{audit.title}</div>
            <div className="text-[11px] text-slate-400">{audit.auditNumber}</div>
          </div>
          <div className="flex items-center gap-3 text-right">
            {scorePct !== null && (
              <div className="border-r border-slate-200 pr-3">
                <div className={cn("text-sm font-bold tabular-nums",
                  scorePct >= 90 ? "text-emerald-600" : scorePct >= 80 ? "text-amber-600" : "text-rose-600")}>
                  {scorePct}%
                </div>
                <div className="text-[11px] tabular-nums text-slate-400">{scoreObtained}/{scoreAllotted} pts</div>
              </div>
            )}
            <div>
              <div className="text-sm font-bold tabular-nums text-violet-700">{pct}%</div>
              <div className="text-[11px] tabular-nums text-slate-400">{answeredTotal}/{grandTotal}</div>
            </div>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[230px_1fr]">
        {/* Discipline navigator */}
        <aside className="space-y-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <DiscButton label="All disciplines" active={disciplineId === "ALL"} answered={answeredTotal} total={grandTotal} failed={rollup.reduce((s, c) => s + c.failed, 0)} onClick={() => setDisciplineId("ALL")} />
          {rollup.map((c) => (
            <DiscButton key={c.categoryId} label={c.categoryName} color={c.categoryColor} active={disciplineId === c.categoryId}
              answered={c.answered} total={c.total} failed={c.failed} onClick={() => setDisciplineId(c.categoryId)} />
          ))}
          <Button type="button" variant="outline" onClick={() => setShowAdd(true)}
            className="mt-1 h-auto w-full justify-start gap-1.5 rounded-lg border-dashed border-violet-300 px-3 py-2 text-[12px] font-medium text-violet-600 hover:bg-violet-50">
            <Plus size={13} /> Add custom checkpoint
          </Button>
        </aside>

        {/* Worklist */}
        <main className="min-w-0">
          {/* Toolbar */}
          <div className="mb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {GRADE_TABS.map((t) => (
                <Button key={t.key} type="button" variant="ghost" onClick={() => setGradeFilter(t.key)}
                  className={cn("h-auto rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                    gradeFilter === t.key ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
                  {t.label}
                </Button>
              ))}
              {isCoAuditor && (
                <Button type="button" variant="ghost" onClick={() => setMineOnly((v) => !v)}
                  className={cn("ml-auto h-auto rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                    mineOnly ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
                  <UserRound size={11} className="mr-1 inline" /> My disciplines
                </Button>
              )}
              <div className={cn("flex items-center gap-2", isCoAuditor ? "" : "ml-auto")}>
                {/* WP-44: scanning an area sticker filters to that area's
                    checkpoints instead of leaving the auditor to find them in a
                    list of 1,500. Same sticker the Field Capture PWA reads. */}
                <QrJumpButton
                  knownAreaIds={audit.scopeAreas ?? []}
                  label="Scan area"
                  className="h-7 shrink-0 text-xs"
                  onJump={(r) => {
                    const token = r.areaId ?? r.equipmentId;
                    if (token) setQ(token);
                  }}
                />
                <div className="relative">
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code / question…" className="h-7 w-48 pl-7 text-xs" />
                </div>
              </div>
            </div>
            {disciplineId !== "ALL" && selectedDisc && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px]">
                <span className="font-medium text-slate-700">{selectedDisc.categoryName}</span>
                <span className="text-slate-400">{selectedDisc.answered}/{selectedDisc.total} graded</span>
                {selectedDisc.scoreAllotted > 0 && (
                  <span className="tabular-nums text-slate-500">
                    {selectedDisc.scoreObtained}/{selectedDisc.scoreAllotted} pts · {selectedDisc.scorePct}%
                  </span>
                )}
                {selectedDisc.failed > 0 && <span className="rounded-full bg-rose-100 px-1.5 text-rose-700">{selectedDisc.failed}✕</span>}
                {selectedDisc.repeatFindings > 0 && (
                  <span className="rounded-full bg-rose-200 px-1.5 font-medium text-rose-900">
                    {selectedDisc.repeatFindings} repeat
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Mark remaining:</span>
                  <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]" disabled={!!bulkBusy || selectedDisc.answered >= selectedDisc.total} onClick={() => bulkMark("pass")}>
                    {bulkBusy === "pass" ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Effective
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]" disabled={!!bulkBusy || selectedDisc.answered >= selectedDisc.total} onClick={() => bulkMark("na")}>
                    N/A
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400"><Loader2 size={18} className="mr-2 animate-spin" /> Loading…</div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
              <ListChecks size={22} className="mx-auto mb-2 text-slate-300" />
              No checkpoints match this filter.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-400">
                {total} checkpoint{total === 1 ? "" : "s"}
                {gradeFilter !== "all" && ` · ${GRADE_TABS.find((t) => t.key === gradeFilter)?.label ?? gradeFilter}`}
              </div>
              {items.map((item) => (
                <CheckpointCard key={item.id} item={item} saving={savingIds.has(item.id)} ownerName={userName(item.assignedOwnerId)}
                  onGrade={(g) => setGrade(item, g)} onStatus={(s) => setStatus(item, s)}
                  onRiskGrade={(r) => setRiskGrade(item, r)} onScore={(n) => setScore(item, n)}
                  onObservation={(t) => setObservation(item, t)}
                  onAddPhoto={(f) => addPhoto(item, f)} onRemovePhoto={(i) => removePhoto(item, i)} />
              ))}
              {cursor && (
                <Button type="button" variant="outline" className="w-full" onClick={() => fetchPage(false, cursor)} disabled={loadingMore}>
                  {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />} Load more ({total - items.length} remaining)
                </Button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="flex-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{answeredTotal}</span>/{grandTotal} answered · {grandTotal - answeredTotal} remaining
          </div>
          <Button type="button" onClick={() => setShowSubmit(true)}>Submit Audit</Button>
        </div>
      </div>

      <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Submit audit?</DialogTitle>
            <DialogDescription className="sr-only">Review and submit the audit; failed/partial checkpoints route to auditees.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {answeredTotal === grandTotal ? "All checkpoints graded." : `${grandTotal - answeredTotal} checkpoint(s) are ungraded and will be marked not assessed.`}
            {scorePct !== null && <> Score stands at <span className="font-semibold text-slate-800">{scoreObtained}/{scoreAllotted} ({scorePct}%)</span>.</>}
            {" "}Every checkpoint below Effective routes to its auditee; critical ones auto-spawn CAPA. Each needs audit findings and a risk grade — the server will flag any that don&apos;t.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowSubmit(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={doSubmit} disabled={submitting}>
              {submitting && <Loader2 size={14} className="animate-spin" />} Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAdd && (
        <AddCheckpointDialog
          auditId={audit.id}
          disciplines={rollup.map((c) => ({ code: c.categoryId, name: c.categoryName }))}
          defaultDiscipline={disciplineId !== "ALL" ? disciplineId : rollup[0]?.categoryId ?? ""}
          canPromote={!!audit.templateId}
          onClose={() => setShowAdd(false)}
          onAdded={(cp) => {
            setShowAdd(false);
            setRollup((prev) => prev.map((c) => c.categoryId === cp.categoryId ? { ...c, total: c.total + 1 } : c));
            if (cp.categoryId === disciplineId || disciplineId === "ALL") fetchPage(true, null);
            toast({ variant: "success", title: "Custom checkpoint added", description: `${cp.checkpointCode} added to ${cp.categoryName}.` });
          }}
        />
      )}
      {/* WP-44 — markup before attach. Closing discards: a dismissed dialog
          that attached the photo anyway looked like a phantom upload, and a
          control labelled close has to mean it. Nothing is uploaded until
          Attach, so discarding costs a network round-trip of nothing. */}
      {pendingPhoto && (
        <PhotoAnnotator
          src={pendingPhoto.url}
          onDiscard={() => {
            const p = pendingPhoto;
            setPendingPhoto(null);
            URL.revokeObjectURL(p.url);
            toast({ title: "Photo discarded", description: "Nothing was attached to this checkpoint." });
          }}
          onAttachWithoutMarkup={() => {
            const p = pendingPhoto;
            setPendingPhoto(null);
            URL.revokeObjectURL(p.url);
            void uploadPhoto(p.item, p.file);
          }}
          onSave={({ annotated }) => {
            const p = pendingPhoto;
            setPendingPhoto(null);
            URL.revokeObjectURL(p.url);
            void uploadPhoto(p.item, p.file, dataUrlToBlob(annotated));
          }}
        />
      )}
    </div>

  );
}

function DiscButton({ label, color, active, answered, total, failed, onClick }: {
  label: string; color?: string; active: boolean; answered: number; total: number; failed: number; onClick: () => void;
}) {
  const done = total > 0 && answered >= total;
  const cpct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <Button type="button" variant="ghost" onClick={onClick}
      className={cn("h-auto w-full justify-start gap-2 rounded-lg border px-3 py-2 text-left text-[12px] transition",
        active ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white hover:bg-slate-50")}>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color || "#94a3b8" }} />
      <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{label}</span>
      {failed > 0 && <span className="rounded-full bg-rose-100 px-1 text-[10px] font-bold text-rose-700">{failed}✕</span>}
      {done && failed === 0 ? <Check size={13} className="text-emerald-600" /> : <span className="text-[10px] tabular-nums text-slate-400">{cpct}%</span>}
    </Button>
  );
}

function CheckpointCard({ item, saving, ownerName, onGrade, onStatus, onRiskGrade, onScore, onObservation, onAddPhoto, onRemovePhoto }: {
  item: Resp; saving: boolean; ownerName: string | null;
  onGrade: (g: GradeAwarded) => void;
  onStatus: (s: ComplianceStatus) => void;
  onRiskGrade: (r: RiskGrade) => void;
  onScore: (n: number) => void;
  onObservation: (t: string) => void;
  onAddPhoto: (f: File) => void; onRemovePhoto: (i: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const grade = item.gradeAwarded ?? null;
  const photos = item.auditorResponse?.photos ?? [];
  // "Adverse" = anything below Effective that is not N/A: the grades that
  // produce a finding, and therefore the ones that owe findings text and a
  // risk grade before the audit can be submitted.
  const isAdverse = requiresRiskGrade(grade);
  const findingsMissing = isAdverse && !(item.auditorResponse?.text_observation ?? "").trim();
  const riskMissing = isAdverse && !item.riskGrade;
  const needsPhoto = item.requiresPhotoOnFail && isAdverse && photos.length === 0;
  const reqType = item.requirementType ? REQUIREMENT_TYPE_META[item.requirementType] : null;
  const scoreOverridden =
    item.scoreObtained !== null && item.scoreObtained !== suggestScore(grade, item.complianceStatus ?? null);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setUploading(true); await onAddPhoto(file); setUploading(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{item.checkpointCode}</span>
        {/* Column I — master data, so it is a label and not a control. */}
        {reqType && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", reqType.chip)} title={reqType.label}>
            {reqType.short}
          </span>
        )}
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", CRITICALITY_CHIP[item.criticality] ?? CRITICALITY_FALLBACK)}>
          {item.criticality === "critical" && <AlertTriangle size={11} />} {item.criticality}
        </span>
        {item.isAdHoc && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-700"><Sparkles size={11} /> Custom</span>
        )}
        <span className="ml-auto text-[11px] text-slate-400">
          {saving ? <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> saving…</span>
            : item.auditorResponse?.is_saved ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check size={12} /> saved</span> : null}
        </span>
      </div>

      <h3 className="text-sm font-semibold leading-snug text-slate-900">{item.checkpointQuestion}</h3>
      {item.guidance && <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600"><span className="font-medium text-slate-500">Guidance: </span>{item.guidance}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        {item.requirementReference && <span>📋 {item.requirementReference}</span>}
        {item.standard && <span>· {item.standard}</span>}
        {item.linkedSafeopsModule && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-sky-700"><Link2 size={11} /> {item.linkedSafeopsModule}</span>}
        {ownerName && <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-slate-500"><UserRound size={11} /> {ownerName}</span>}
      </div>

      {/* Column C — Grade Awarded. The one control that drives the rest. */}
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-slate-600">Grade Awarded <span className="text-rose-500">*</span></label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {GRADE_ORDER.map((g) => {
            const meta = GRADE_META[g]; const on = grade === g;
            return (
              <Button key={g} type="button" variant="outline" onClick={() => onGrade(g)} title={meta.label}
                className={cn("h-auto flex-col gap-1 rounded-xl border-2 py-2 text-[11px] font-semibold leading-tight",
                  on ? meta.ring : "border-slate-200 text-slate-500")}>
                <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-bold text-white", on ? meta.dot : "bg-slate-200")}>
                  {meta.score === null ? "–" : meta.score}
                </span>
                {meta.short}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Columns D–F, H. Only unfold once a grade exists — an ungraded
          checkpoint has nothing to say about status, score or risk. */}
      {grade && (
        <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2">
          {/* Column F — Status */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-slate-600">Status</Label>
            <Select value={item.complianceStatus ?? ""} onChange={(e) => onStatus(e.target.value as ComplianceStatus)} className="h-8 text-xs">
              <option value="">— select —</option>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </Select>
            {item.complianceStatus && STATUS_META[item.complianceStatus].isRepeat && (
              <p className="text-[10px] font-medium text-rose-600">Repeat finding — scored −1.</p>
            )}
          </div>

          {/* Columns D + E — Score obtained out of allotted */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-slate-600">
              Score {item.scoreAllotted === null ? <span className="text-slate-400">(not scored)</span> : <span className="text-slate-400">out of {item.scoreAllotted}</span>}
            </Label>
            {item.scoreAllotted === null ? (
              <div className="flex h-8 items-center rounded-md border border-slate-200 bg-slate-100 px-2 text-xs text-slate-500">NA</div>
            ) : (
              <Select value={String(item.scoreObtained ?? "")} onChange={(e) => onScore(Number(e.target.value))} className="h-8 text-xs">
                {SCORE_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            )}
            {scoreOverridden && item.scoreAllotted !== null && (
              <p className="text-[10px] text-amber-700">Overridden — the grade suggests {suggestScore(grade, item.complianceStatus ?? null)}.</p>
            )}
          </div>

          {/* Column H — Risk Grade. Only a finding carries one. */}
          {isAdverse && (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px] font-medium text-slate-600">Risk Grade <span className="text-rose-500">*</span></Label>
              <div className="grid grid-cols-3 gap-2">
                {RISK_ORDER.map((r) => {
                  const meta = RISK_META[r]; const on = item.riskGrade === r;
                  return (
                    <Button key={r} type="button" variant="outline" size="sm" onClick={() => onRiskGrade(r)}
                      className={cn("h-7 rounded-lg border-2 text-[11px] font-semibold",
                        on ? meta.ring : riskMissing ? "border-rose-200 text-slate-500" : "border-slate-200 text-slate-500")}>
                      {meta.label}
                    </Button>
                  );
                })}
              </div>
              {riskMissing && <p className="text-[10px] text-rose-600">A risk grade is required before this audit can be submitted.</p>}
            </div>
          )}
        </div>
      )}

      {/* Column G — Audit Findings (the auditor's comment) */}
      {(isAdverse || (item.auditorResponse?.text_observation ?? "").length > 0) && (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">Audit Findings {isAdverse && <span className="text-rose-500">*</span>}</label>
          <Textarea defaultValue={item.auditorResponse?.text_observation ?? ""} onChange={(e) => onObservation(e.target.value)} rows={2}
            placeholder={isAdverse ? `Required for a ${GRADE_META[grade!].label.toLowerCase()} grade — what did you observe?` : "What did you observe?"}
            className={cn("min-h-[54px]", findingsMissing && "border-rose-300 focus-visible:ring-rose-300")} />
          {findingsMissing && <p className="mt-1 text-[11px] text-rose-600">Audit findings are required for a {GRADE_META[grade!].label} grade.</p>}
        </div>
      )}

      {/* Evidence — photographs and documents.
          Two pickers, not one, because they are different acts with different
          hardware: "Add photo" carries `capture="environment"` so a phone opens
          the rear camera directly, which is the whole point on a shop floor.
          Putting documents behind that same input would make every licence
          upload start with a camera viewfinder — and dropping `capture` to allow
          both would cost the auditor a tap on every single photograph. */}
      <div className="mt-2.5">
        <AttachmentStrip attachments={photos} onRemove={onRemovePhoto} className="mb-2" />
        <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} capture="environment" className="hidden" onChange={onPhoto} />
        <input ref={docRef} type="file" accept={DOCUMENT_ACCEPT} className="hidden" onChange={onPhoto} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className={cn(needsPhoto && "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100")}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} {uploading ? "Uploading…" : "Add photo"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => docRef.current?.click()} disabled={uploading}
            title="Attach a PDF, Word, Excel, CSV or text file — a licence, certificate, test report or register extract">
            <Paperclip size={14} /> Attach document
          </Button>
          {/* The rule is EVIDENCE, and a licence scan satisfies it as well as a
              photograph — `photos` holds both, so the requirement clears either
              way. Worded to say so, because "photo required" next to a working
              document button reads as a rule the auditor has already met. */}
          {needsPhoto && <span className="text-[11px] text-rose-600">Evidence required for this grade — a photo or a document</span>}
        </div>
      </div>
    </div>
  );
}

function AddCheckpointDialog({ auditId, disciplines, defaultDiscipline, canPromote, onClose, onAdded }: {
  auditId: string; disciplines: { code: string; name: string }[]; defaultDiscipline: string;
  canPromote: boolean; onClose: () => void; onAdded: (cp: Resp) => void;
}) {
  const { toast } = useToast();
  const [disciplineId, setDisciplineId] = useState(defaultDiscipline);
  const [question, setQuestion] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("major");
  const [guidance, setGuidance] = useState("");
  const [standardClauseRef, setStandard] = useState("");
  const [evidenceRequiredOnFail, setEvidence] = useState(false);
  const [promoteToTemplate, setPromote] = useState(false);
  const [busy, setBusy] = useState(false);
  const questionError = question.trim().length < 4 ? "Question must be at least 4 characters." : null;

  async function submit() {
    if (questionError) { toast({ variant: "error", title: "Question too short", description: questionError }); return; }
    setBusy(true);
    const res = await fetch(`/api/audit-compliance/${auditId}/checkpoints`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ disciplineId, question, severity, guidance, standardClauseRef, evidenceRequiredOnFail, promoteToTemplate: canPromote && promoteToTemplate }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast({ variant: "error", title: "Couldn't add checkpoint", description: apiErrorMessage(j, res.status) }); return; }
    const j = await res.json();
    onAdded(j.checkpoint as Resp);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base"><Sparkles size={16} className="text-violet-600" /> Add custom checkpoint</DialogTitle>
          <DialogDescription className="sr-only">Add an ad-hoc custom checkpoint to this audit.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Discipline</Label>
              <Select value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)}>
                {disciplines.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Severity</Label>
              <Select value={severity} onChange={(e) => setSeverity(e.target.value as (typeof SEVERITIES)[number])}>
                {SEVERITIES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Question<span className="ml-0.5 text-rose-500">*</span></Label>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} placeholder="What should the auditor verify?" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Guidance (optional)</Label>
            <Textarea value={guidance} onChange={(e) => setGuidance(e.target.value)} rows={2} placeholder="How to assess this checkpoint." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Standard / clause reference (optional)</Label>
            <Input value={standardClauseRef} onChange={(e) => setStandard(e.target.value)} placeholder="e.g. ISO 45001 §8.1.2 · NFPA 101" />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-slate-600">
            <Checkbox checked={evidenceRequiredOnFail} onChange={(e) => setEvidence(e.target.checked)} />
            Require an evidence photo on a fail / partial
          </label>
          {canPromote && (
            <label className="flex items-center gap-2 text-[13px] text-slate-600">
              <Checkbox checked={promoteToTemplate} onChange={(e) => setPromote(e.target.checked)} />
              Also save to the template (forks a new version for future audits)
            </label>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" onClick={submit} disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />} Add checkpoint</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
