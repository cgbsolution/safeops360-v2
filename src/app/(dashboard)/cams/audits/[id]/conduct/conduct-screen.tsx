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
import { usePermission } from "@/components/auth/can";
import Link from "next/link";
import {
  Check, Camera, AlertTriangle, Link2, Loader2, X, ArrowLeft,
  Trash2, UserRound, Sparkles, Plus, Search, ListChecks, ChevronDown, Paperclip,
  CopyPlus, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useSidebar } from "@/components/ui/sidebar";
import { useToast } from "@/components/ui/toast";
import {
  AuditDetail, CheckpointResponse, DisciplineRollup, StreamRollup,
  CRITICALITY_CHIP, CRITICALITY_FALLBACK, PlantUser, apiErrorMessage,
  GradeAwarded, ComplianceStatus, RiskGrade,
  GRADE_META, GRADE_ORDER, GRADE_TO_VALUE, STATUS_META, STATUS_ORDER,
  RISK_META, RISK_ORDER, REQUIREMENT_TYPE_META,
  SCORE_CHOICES, FULL_SCORE, suggestScore, suggestStatus,
  requiresRiskGrade, carriesRiskGrade,
  Conformance, StreamCode, CONFORMANCE_META, CONFORMANCE_ORDER, conformanceOf,
  STREAM_META, STREAM_ORDER, pairCheckpoints,
} from "../../lib";
import {
  uploadAuditAttachment, deleteAuditAttachment, IMAGE_ACCEPT, DOCUMENT_ACCEPT,
} from "../../upload-attachment";
import { AttachmentStrip } from "../../attachment-tile";
// WP-44: annotation + QR jump. Both reuse existing platform pieces rather
// than introducing a second markup surface or a second QR scheme.
import { PhotoAnnotator } from "@/components/assurance/photo-annotator";
import { QrJumpButton } from "@/components/assurance/qr-jump";
import { SelectField } from "@/components/ui/select-field";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Resp = CheckpointResponse;
/** "ungraded" filters on the absence of a grade; the rest are grade codes. */
type GradeFilter = "all" | "ungraded" | GradeAwarded;
type Bucket = "passed" | "partial" | "failed" | "na";
/** Which report's checkpoints the worklist is showing. Department audits only. */
type StreamFilter = "all" | StreamCode;

/**
 * One department that holds the same workbook line, and what state it is in.
 * `wouldOverwrite` is what the confirm dialog counts before it asks; `locked`
 * is a finding already in flight with its auditee, which replication never
 * touches at all.
 */
type ReplicationTarget = {
  checkpointCode: string;
  departmentId: string;
  departmentName: string;
  assessmentStatus: string;
  conformance: Conformance | null;
  gradeAwarded: GradeAwarded | null;
  locked: boolean;
  wouldOverwrite: boolean;
};

const SEVERITIES = ["critical", "major", "minor", "observation"] as const;
const PAGE = 40;

/**
 * A paired checkpoint materialises as TWO rows spanning ~40 positions in the
 * sequence — the IMS sheet's row 1 and the EnMS sheet's row 1. The worklist
 * pages on sequence, so a page of 40 would routinely hold one half of a pair
 * and not the other, and the card would render a toggle whose other side does
 * not exist. Paging in pairs keeps both halves in the same page for every
 * department this library ships.
 *
 * Bounded by the endpoint's own 200 cap, and only paid for on an audit that
 * actually has streams — a discipline audit keeps the original page size.
 */
const PAGE_PAIRED = 200;

const GRADE_TABS: { key: GradeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ungraded", label: "Not graded" },
  ...GRADE_ORDER.map((g) => ({ key: g as GradeFilter, label: GRADE_META[g].short })),
];

/**
 * The same filter row, in the customer's vocabulary.
 *
 * A filter has to offer the words the cards answer in. Showing "Unsat. / Major
 * Imp. / Some Imp. / Effective" over a department audit whose cards say
 * Conformance / Non-Conformance / Observation asks the auditor to translate
 * between two vocabularies to find their own findings.
 *
 * The KEYS are still grade codes, so this needs no new server filter — each
 * parameter maps 1:1 onto the grade it writes, which is exactly what
 * `CONFORMANCE_META[c].grade` already says.
 */
const TRISTATE_TABS: { key: GradeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ungraded", label: "Not graded" },
  ...CONFORMANCE_ORDER.map((c) => ({
    key: CONFORMANCE_META[c].grade as GradeFilter,
    label: CONFORMANCE_META[c].label,
  })),
  { key: "NA", label: "N/A" },
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
  // Opens ON for anyone held to their allocated disciplines, i.e. anyone
  // WITHOUT AUDIT_COMPLIANCE.ALLOCATE. A plain co-auditor previously landed on
  // all 206 checkpoints across every discipline, including the ones allocated
  // to someone else, with "My disciplines" an opt-in nobody pressed — so the
  // allocation they were given was invisible in the one screen it governs.
  // Still a toggle, not a cage: the server is what refuses the write now, and
  // seeing the rest of the audit is legitimate context.
  const mayAllocate = usePermission("AUDIT_COMPLIANCE.ALLOCATE");
  const [mineOnly, setMineOnly] = useState(false);
  // Deferred to an effect rather than seeded into useState: permissions arrive
  // asynchronously (null until the fetch lands), and seeding from a value that
  // is null on the server and populated on the client is the hydration mismatch
  // `usePermissions` documents. `pinned` makes it a one-shot default so a user
  // who switches it off is not overridden on the next render.
  const [minePinned, setMinePinned] = useState(false);
  useEffect(() => {
    if (minePinned || mayAllocate) return;
    setMineOnly(true);
    setMinePinned(true);
  }, [mayAllocate, minePinned]);

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

  // ── Department audits: two reports out of one conduct ─────────────────
  //
  // Present only when the audit's checkpoints carry a stream, which is the
  // PAGE_IMS department library and nothing else. Every branch below reads the
  // data rather than a flag about which library this is.
  const streams: StreamRollup[] = audit.streamRollup ?? [];
  const isDeptAudit = streams.length > 0;
  const [streamFilter, setStreamFilter] = useState<StreamFilter>("all");
  const pageSize = isDeptAudit ? PAGE_PAIRED : PAGE;
  // The filter offers the words the cards answer in. Keyed off the AUDIT's
  // conformance mode (server-derived from its own materialised rows) rather
  // than off `isDeptAudit`, so it stays correct for any future tristate
  // checklist that is not department-segregated — and for a mixed audit, where
  // the server answers FULL because that is the only vocabulary every card can
  // be found by.
  const isTristateAudit = audit.conformanceMode === "TRISTATE";
  const gradeTabs = isTristateAudit ? TRISTATE_TABS : GRADE_TABS;
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

  // Where the content column starts, so the fixed action bar can stop at the
  // sidebar instead of covering it. Both widths are the shell's own CSS
  // variables rather than copied numbers, so a change to `SIDEBAR_WIDTH` moves
  // this with it; on mobile the sidebar is an off-canvas sheet over the
  // content, so there is nothing to clear.
  const { state: sidebarState, isMobile: sidebarIsMobile } = useSidebar();
  const sidebarInset = sidebarIsMobile
    ? 0
    : sidebarState === "collapsed"
      ? "var(--sidebar-width-icon)"
      : "var(--sidebar-width)";

  // ── What is actually on the server, and what is not ───────────────────
  //
  // Every write here is an autosave, and an autosave that fails quietly is
  // indistinguishable from one that worked — which is how graded checkpoints
  // came back blank with a "saved" tick still on the card. Three states are
  // tracked so the screen can never claim more than it knows:
  //
  //   savedIds   confirmed by a 2xx in THIS session
  //   failedIds  a write that was attempted and did not land
  //   pendingText  audit findings typed but not yet posted (700ms debounce)
  //
  // `failedIds` is deliberately sticky: a toast can be missed, and the one
  // thing the auditor must not be able to miss is that their work is not on
  // the server. It clears only when a later write for that row succeeds.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const pendingText = useRef<Map<string, { item: Resp; text: string }>>(new Map());
  const [pendingCount, setPendingCount] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);

  const answeredTotal = rollup.reduce((s, c) => s + c.answered, 0);
  const grandTotal = rollup.reduce((s, c) => s + c.total, 0);
  // What is still owed, and by whom. Submit ends fieldwork for the WHOLE audit
  // — one button, one status flip — so a co-auditor pressing it while two
  // others are mid-discipline freezes the score over whatever happened to be
  // graded. The server refuses that now; this is the same answer shown before
  // the click, naming the person rather than just a count, because "204
  // ungraded" does not tell anyone whose turn it is.
  const outstanding = useMemo(
    () =>
      rollup
        .filter((c) => c.total - c.answered > 0)
        .map((c) => ({
          id: c.categoryId,
          name: c.categoryName,
          remaining: c.total - c.answered,
          total: c.total,
          who:
            users.find((u) => u.id === c.auditorUserId)?.name
            ?? (c.auditorMixed ? "several auditors" : "unallocated"),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rollup, users],
  );
  const readyToSubmit = outstanding.length === 0 && grandTotal > 0;
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
      if (streamFilter !== "all") params.set("stream", streamFilter);
      params.set("limit", String(pageSize));
      if (!reset && cur) params.set("cursor", cur);
      if (reset) setLoading(true); else setLoadingMore(true);
      try {
        // `no-store`, not politeness: this GET is what the auditor sees when
        // they come BACK to a department they have already graded. A response
        // replayed from the browser cache renders their saved verdicts as
        // blank cards — work that is on the server and looks lost.
        const res = await fetch(
          `/api/audit-compliance/${audit.id}/checkpoints?${params.toString()}`,
          { cache: "no-store" },
        );
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
    [audit.id, disciplineId, gradeFilter, qDebounced, mineOnly, streamFilter, pageSize, toast],
  );

  // Refetch when scope/filter/search changes.
  //
  // Pending text is flushed FIRST. Changing department replaces every row on
  // screen, so a debounce still in flight would be posting against cards the
  // auditor can no longer see — and if it failed, against cards they could not
  // get back to.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await flushPending();
      if (!cancelled) fetchPage(true, null);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disciplineId, gradeFilter, qDebounced, mineOnly, streamFilter]);

  /**
   * The worklist as CARDS. Ten requirements are asked on both sheets and
   * materialise as two rows; the auditor sees one card with an IMS / EnMS
   * toggle rather than the same question twice, forty rows apart.
   *
   * Not applied while a stream filter is on: "show me the EnMS checkpoints"
   * has to show EnMS rows, and folding each into a card that opens on its IMS
   * half would answer a different question.
   */
  const cards = useMemo(
    () => (streamFilter === "all" ? pairCheckpoints(items) : items.map((i) => [i])),
    [items, streamFilter],
  );

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
      setSavedIds((s) => { const n = new Set(s); n.delete(item.id); return n; });
      try {
        const doPost = () => fetch(`/api/audit-compliance/${audit.id}/responses`, {
          method: "POST", headers: { "content-type": "application/json" },
          // A verdict must never be answered from a cached response — a 200 the
          // browser replayed would mark the card saved without the server ever
          // hearing about it.
          cache: "no-store",
          body: JSON.stringify({ checkpointCode: item.checkpointCode, ...body }),
        }).catch(() => null);
        let r = await doPost();
        if (!r || r.status >= 500) { await new Promise((res) => setTimeout(res, 500)); r = await doPost(); }
        const fail = (title: string, description: string) => {
          // Sticky, not just a toast: the card keeps a "Not saved" badge and the
          // footer keeps a count, because a toast that scrolled past is exactly
          // how unsaved work looks identical to saved work.
          setFailedIds((s) => new Set(s).add(item.id));
          toast({ variant: "error", title, description });
          return false;
        };
        if (!r) return fail("Not saved — network error", `${item.checkpointCode} is still only on this device. Use “Save now” once you are back online.`);
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          return fail("Not saved", `${item.checkpointCode}: ${apiErrorMessage(j, r.status)}`);
        }
        setFailedIds((s) => { const n = new Set(s); n.delete(item.id); return n; });
        setSavedIds((s) => new Set(s).add(item.id));
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
    //
    // N/A is the exception, and it has to be: marking a checkpoint not
    // applicable is a statement that it was never assessed, so keeping the
    // status it carried before would leave the row reading "Complied" and
    // "Not applicable" at once — and on a tristate card BOTH controls would
    // light up. Preserving a status the grade contradicts is not caution.
    const status = next === null ? null
      : next === "NA" ? "NA"
      : (item.complianceStatus ?? suggestStatus(next));
    const score = suggestScore(next, status);
    const allotted = next === null || next === "NA" ? null : FULL_SCORE;
    const risk = carriesRiskGrade(next) ? item.riskGrade : null;

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

  /**
   * The three-parameter control — Conformance / Non-Conformance / Observation,
   * the header of column E on both of the customer's sheets.
   *
   * ONE field is sent. The server rewrites it into the grade and status
   * underneath, so this is a narrower face on the same verdict rather than a
   * second thing to keep in step; the optimistic patch below mirrors that
   * mapping only so the card settles before the round-trip returns.
   *
   * Tapping the current parameter again clears it, matching the grade buttons.
   */
  async function setConformance(item: Resp, c: Conformance) {
    const cur = item.conformance ?? conformanceOf(item.complianceStatus);
    const next = cur === c ? null : c;
    const meta = next ? CONFORMANCE_META[next] : null;
    const oldB = bucketOfGrade(item.gradeAwarded ?? null);
    const newB = bucketOfGrade(meta?.grade ?? null);
    const allotted = meta ? FULL_SCORE : null;
    const score = meta ? meta.score : null;

    const ok = await saveField(
      item,
      { conformance: next },
      (r) => ({
        ...r, conformance: next,
        gradeAwarded: meta?.grade ?? null, complianceStatus: meta?.status ?? null,
        scoreObtained: score, scoreAllotted: allotted,
        riskGrade: meta && carriesRiskGrade(meta.grade) ? r.riskGrade : null,
        auditorResponse: {
          ...(r.auditorResponse ?? { value: null }),
          value: meta ? GRADE_TO_VALUE[meta.grade] : null,
        },
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

  // ── Audit findings (column G) — debounced, but never abandoned ────────
  //
  // Typing posts 700ms after the last keystroke. That window is the single
  // biggest way work was being lost: an auditor who typed a finding and
  // immediately tapped back left the sentence in a timer that the unmounting
  // component then threw away. The text is now ALSO held in `pendingText`, so
  // it can be flushed on demand — by the Save button, by leaving the screen, by
  // switching department, and by the browser trying to close the tab.
  const obsTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const syncPendingCount = useCallback(() => setPendingCount(pendingText.current.size), []);

  function setObservation(item: Resp, text: string) {
    patchItem(item.id, (r) => ({ ...r, auditorResponse: { ...(r.auditorResponse ?? { value: null }), text_observation: text } }));
    pendingText.current.set(item.checkpointCode, { item, text });
    syncPendingCount();
    const m = obsTimers.current;
    if (m.get(item.id)) clearTimeout(m.get(item.id)!);
    m.set(item.id, setTimeout(() => { void flushOne(item.checkpointCode); }, 700));
  }

  const flushOne = useCallback(async (code: string) => {
    const entry = pendingText.current.get(code);
    if (!entry) return true;
    // Removed BEFORE the await so a keystroke landing mid-flight re-queues the
    // newer text rather than being cancelled by this write finishing.
    pendingText.current.delete(code);
    setPendingCount(pendingText.current.size);
    const ok = await saveField(entry.item, { auditFindings: entry.text }, (r) => r);
    if (!ok && !pendingText.current.has(code)) {
      // Failed and nothing newer replaced it — keep it queued so "Save now"
      // and the leave-guard can still rescue the text.
      pendingText.current.set(code, entry);
      setPendingCount(pendingText.current.size);
    }
    return ok;
  }, [saveField]);

  /** Post everything still sitting in a debounce timer. Returns false if any
   *  write failed, so a caller about to navigate can stop and say so. */
  const flushPending = useCallback(async () => {
    for (const t of obsTimers.current.values()) clearTimeout(t);
    obsTimers.current.clear();
    const codes = [...pendingText.current.keys()];
    if (codes.length === 0) return true;
    setFlushing(true);
    try {
      const results = await Promise.all(codes.map((c) => flushOne(c)));
      return results.every(Boolean);
    } finally {
      setFlushing(false);
    }
  }, [flushOne]);

  const unsavedCount = pendingCount + failedIds.size;

  // The browser's own guard, for the tab-close and hard-navigation cases React
  // never sees. Only armed when there is something to lose.
  useEffect(() => {
    if (unsavedCount === 0 && savingIds.size === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsavedCount, savingIds.size]);

  // Backgrounding the tab on a phone is the commonest way a shop-floor auditor
  // leaves this screen, and it fires no navigation event at all.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flushPending(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flushPending]);

  /** Leave the screen, but not before the typing is on the server. */
  const leaveTo = useCallback(async (href: string) => {
    const ok = await flushPending();
    if (!ok) {
      toast({
        variant: "error",
        title: "Some changes didn't save",
        description: "Staying on this screen so nothing is lost — try “Save now”.",
      });
      return;
    }
    router.push(href);
  }, [flushPending, router, toast]);

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

  // ── Replicate a verdict across departments ────────────────────────────
  //
  // 40 of the 60 IMS lines and all 22 EnMS lines are common to HR, Admin and
  // OHC, so the audit asks the same question three times. Answering it three
  // times by hand is the rework the customer asked us to remove — and the way
  // three copies of one shared record end up disagreeing.
  //
  // Two steps, not one: the targets are read first so the dialog can NAME what
  // it is about to overwrite rather than reporting the damage afterwards.
  const [replicating, setReplicating] = useState<{
    item: Resp;
    targets: ReplicationTarget[];
  } | null>(null);
  const [replicateBusy, setReplicateBusy] = useState<string | null>(null);

  async function openReplicate(item: Resp) {
    setReplicateBusy(item.id);
    const res = await fetch(
      `/api/audit-compliance/${audit.id}/responses/replication-targets?checkpointCode=${encodeURIComponent(item.checkpointCode)}`,
    );
    setReplicateBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Couldn't check the other departments", description: apiErrorMessage(j, res.status) });
      return;
    }
    const j = await res.json();
    const targets: ReplicationTarget[] = j.targets ?? [];
    if (targets.length === 0) {
      toast({
        title: "Nothing to replicate to",
        description: `${item.checkpointCode} is specific to ${item.categoryName} — no other department is audited on it.`,
      });
      return;
    }
    setReplicating({ item, targets });
  }

  async function doReplicate(
    item: Resp, departments: string[], includeFindings: boolean, overwrite: boolean,
  ) {
    setReplicateBusy(item.id);
    const res = await fetch(`/api/audit-compliance/${audit.id}/responses/replicate`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        checkpointCode: item.checkpointCode, targetDepartments: departments,
        includeFindings, overwrite,
      }),
    });
    setReplicateBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Couldn't replicate", description: apiErrorMessage(j, res.status) });
      return;
    }
    const j = await res.json();
    setReplicating(null);
    const n = j.updated ?? 0;
    const skipped = (j.skipped ?? []).length;
    toast({
      variant: n ? "success" : "error",
      title: n ? `Copied to ${n} department${n === 1 ? "" : "s"}` : "Nothing was copied",
      description: skipped
        ? `${skipped} already graded and left as they were — tick "replace" to overwrite.`
        : undefined,
    });
    // Replication moved rows in departments this page may not even be showing,
    // so the rollup is re-read from the server rather than nudged. Replaying a
    // delta across three departments is exactly where the live navigator and
    // the server's numbers would drift apart, and the navigator is what the
    // auditor trusts to tell them what is left.
    await refreshRollup();
    fetchPage(true, null);
  }

  const refreshRollup = useCallback(async () => {
    const res = await fetch(`/api/audit-compliance/${audit.id}`, { cache: "no-store" });
    if (!res.ok) return;
    const j = await res.json();
    if (Array.isArray(j.disciplineRollup)) {
      setRollup(
        [...j.disciplineRollup].sort((a: DisciplineRollup, b: DisciplineRollup) =>
          a.categoryName.localeCompare(b.categoryName)),
      );
    }
  }, [audit.id]);

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
    // `pb-28` reserves room for the fixed action bar, which floats over the
    // content rather than occupying flow space.
    <div className="mx-auto max-w-6xl pb-28">
      {/* Header + overall progress */}
      <Card className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-t-xl shadow-none">
        <div className="flex items-center gap-2">
          {/* Back is a BUTTON, not a bare link: leaving is the moment a
              700ms debounce gets thrown away, so it flushes first and refuses
              to leave if a write is still failing. */}
          <Button type="button" variant="ghost" aria-label="Back to the audit"
            onClick={() => void leaveTo(`/cams/audits/${audit.id}`)}
            className="h-auto rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <ArrowLeft size={18} />
          </Button>
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
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[230px_1fr]">
        {/* Department / discipline navigator. The label follows the data: on a
            department audit "All disciplines" over HR / Admin / OHC is simply
            a false statement on screen. */}
        <aside className="space-y-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          {isDeptAudit && (
            <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <Building2 size={11} /> Departments
            </div>
          )}
          <DiscButton label={isDeptAudit ? "All departments" : "All disciplines"} active={disciplineId === "ALL"} answered={answeredTotal} total={grandTotal} failed={rollup.reduce((s, c) => s + c.failed, 0)} onClick={() => setDisciplineId("ALL")} />
          {rollup.map((c) => (
            <DiscButton key={c.categoryId} label={c.categoryName} color={c.categoryColor} active={disciplineId === c.categoryId}
              answered={c.answered} total={c.total} failed={c.failed} onClick={() => setDisciplineId(c.categoryId)} />
          ))}

          {/* Per-report progress. Two documents come out of this one conduct,
              and each is issued against its own standards — so the auditor
              needs to see where each of them stands, not only the total. */}
          {isDeptAudit && (
            <Card className="!mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-2 shadow-none">
              <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Reports
              </div>
              <div className="space-y-1">
                {streams.map((s) => {
                  const spct = s.total ? Math.round((s.answered / s.total) * 100) : 0;
                  return (
                    <div key={s.code} className="rounded-md bg-white px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("size-2 shrink-0 rounded-full", STREAM_META[s.code].dot)} />
                        <span className="flex-1 truncate text-[12px] font-medium text-slate-700">{s.label}</span>
                        <span className="text-[10px] tabular-nums text-slate-400">{s.answered}/{s.total}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn("h-full rounded-full", STREAM_META[s.code].dot)} style={{ width: `${spct}%` }} />
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-slate-400" title={s.standards}>{s.standards}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Button type="button" variant="outline" onClick={() => setShowAdd(true)}
            className="mt-1 h-auto w-full justify-start gap-1.5 rounded-lg border-dashed border-violet-300 px-3 py-2 text-[12px] font-medium text-violet-600 hover:bg-violet-50">
            <Plus size={13} /> Add custom checkpoint
          </Button>
        </aside>

        {/* Worklist */}
        <main className="min-w-0">
          {/* Toolbar */}
          <div className="mb-3 space-y-2">
            {/* Which report's checkpoints to work through. "Both" is the
                default because the two sheets share ten requirements and the
                paired card answers them together — filtering to one stream
                splits those pairs, which is why the cards un-pair below. */}
            {isDeptAudit && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Report</span>
                <Button type="button" variant="ghost" onClick={() => setStreamFilter("all")}
                  className={cn("h-auto rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                    streamFilter === "all" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
                  Both
                </Button>
                {STREAM_ORDER.filter((s) => streams.some((r) => r.code === s)).map((s) => (
                  <Button key={s} type="button" variant="ghost" onClick={() => setStreamFilter(s)}
                    title={STREAM_META[s].standards}
                    className={cn("h-auto rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                      streamFilter === s ? cn(STREAM_META[s].ring, "border-2") : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
                    <span className={cn("mr-1 inline-block size-1.5 rounded-full align-middle", STREAM_META[s].dot)} />
                    {STREAM_META[s].label}
                  </Button>
                ))}
                {streamFilter !== "all" && (
                  <span className="text-[11px] text-slate-400">
                    Paired checkpoints show one side only while a report is selected.
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {gradeTabs.map((t) => (
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
                  <UserRound size={11} className="mr-1 inline" /> {isDeptAudit ? "My departments" : "My disciplines"}
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
              <Card className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] shadow-none">
                <span className="font-medium text-slate-700">{selectedDisc.categoryName}</span>
                <span className="text-slate-400">{selectedDisc.answered}/{selectedDisc.total} graded</span>
                {selectedDisc.scoreAllotted > 0 && (
                  <span className="tabular-nums text-slate-500">
                    {selectedDisc.scoreObtained}/{selectedDisc.scoreAllotted} pts · {selectedDisc.scorePct}%
                  </span>
                )}
                {selectedDisc.failed > 0 && <Badge variant="danger" className="rounded-full bg-rose-100 px-1.5 text-rose-700">{selectedDisc.failed}✕</Badge>}
                {selectedDisc.repeatFindings > 0 && (
                  <Badge variant="danger" className="rounded-full bg-rose-200 px-1.5 font-medium text-rose-900">
                    {selectedDisc.repeatFindings} repeat
                  </Badge>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Mark remaining:</span>
                  <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]" disabled={!!bulkBusy || selectedDisc.answered >= selectedDisc.total} onClick={() => bulkMark("pass")}>
                    {bulkBusy === "pass" ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    {isDeptAudit ? "Conformance" : "Effective"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]" disabled={!!bulkBusy || selectedDisc.answered >= selectedDisc.total} onClick={() => bulkMark("na")}>
                    N/A
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400"><Loader2 size={18} className="mr-2 animate-spin" /> Loading…</div>
          ) : items.length === 0 ? (
            <Card className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400 shadow-none">
              <ListChecks size={22} className="mx-auto mb-2 text-slate-300" />
              No checkpoints match this filter.
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-400">
                {total} checkpoint{total === 1 ? "" : "s"}
                {cards.length !== items.length && ` · ${cards.length} card${cards.length === 1 ? "" : "s"}`}
                {gradeFilter !== "all" && ` · ${GRADE_TABS.find((t) => t.key === gradeFilter)?.label ?? gradeFilter}`}
              </div>
              {cards.map((card) => (
                <CheckpointCard key={card[0].id} card={card}
                  savingIds={savingIds} failedIds={failedIds} ownerName={userName}
                  replicateBusy={replicateBusy} replicationCounts={audit.replicationCounts ?? {}}
                  onGrade={setGrade} onStatus={setStatus} onConformance={setConformance}
                  onRiskGrade={setRiskGrade} onScore={setScore}
                  onObservation={setObservation}
                  onAddPhoto={addPhoto} onRemovePhoto={removePhoto}
                  onReplicate={openReplicate} />
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

      {/* Action bar — progress, save state, submit.
          Grading autosaves, but "it saves as you go" is only believable if the
          screen says so out loud and offers a way to force it. This is the one
          place an auditor can answer "is my work safe?" without guessing.

          It has to stay pinned to the viewport while a 200-card worklist
          scrolls, so `fixed` it is — `sticky` does not work in this shell,
          because `SidebarInset` is `overflow-hidden` and therefore a scroll
          container that never scrolls, and a sticky child would have nothing to
          stick against.

          But a bar fixed to the VIEWPORT spans the whole window and covers the
          navigation, which is what it was doing. The left edge is therefore
          offset by the sidebar's own width, read live from `useSidebar()` so it
          tracks the icon-collapse and drops to zero on mobile (where the
          sidebar is an off-canvas sheet, not a column). Three other screens
          hardcode `sm:left-64` for this; that is the expanded width only, and
          leaves a 13rem hole the moment the sidebar is collapsed. */}
      <div
        style={{ left: sidebarInset }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-20 border-t p-3 backdrop-blur transition-[background-color,border-color,left]",
          unsavedCount > 0 ? "border-amber-300 bg-amber-50/95" : "border-slate-200 bg-white/95",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <div className="flex-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{answeredTotal}</span>/{grandTotal} answered · {grandTotal - answeredTotal} remaining
          </div>

          <div className="flex items-center gap-2 text-xs">
            {savingIds.size > 0 || flushing ? (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <Loader2 size={13} className="animate-spin" /> Saving…
              </span>
            ) : unsavedCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                <AlertTriangle size={13} />
                {unsavedCount} change{unsavedCount === 1 ? "" : "s"} not saved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-emerald-600">
                <Check size={13} /> All changes saved
              </span>
            )}
            <Button type="button" variant="outline" size="sm"
              disabled={flushing || savingIds.size > 0 || unsavedCount === 0}
              onClick={async () => {
                const ok = await flushPending();
                // A retry also has to clear rows whose LAST failure was a
                // verdict rather than typed text — those carry no pending
                // entry, so they are re-read from the server instead.
                if (failedIds.size > 0) { await refreshRollup(); fetchPage(true, null); }
                toast(ok
                  ? { variant: "success", title: "Saved", description: "Everything on this screen is on the server." }
                  : { variant: "error", title: "Some changes still aren't saved", description: "Check your connection and try again." });
              }}>
              {flushing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save now
            </Button>
          </div>

          <Button type="button" onClick={async () => { await flushPending(); setShowSubmit(true); }}>
            Submit Audit
          </Button>
        </div>
      </div>

      <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {readyToSubmit ? "Submit audit?" : "Not ready to submit"}
            </DialogTitle>
            <DialogDescription className="sr-only">Review and submit the audit; failed/partial checkpoints route to auditees.</DialogDescription>
          </DialogHeader>
          {/* The blocking view. Submit ends fieldwork for everyone, so it waits
              until every discipline is graded — by whoever holds it. Named per
              discipline so the lead knows who to chase, not just that something
              is missing. */}
          {!readyToSubmit && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Submitting ends fieldwork for the whole audit and freezes the score, so it
                waits until every discipline is graded. Still outstanding:
              </p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-amber-200 bg-amber-50/60">
                {outstanding.map((o) => (
                  <li key={o.id} className="flex items-baseline gap-2 px-3 py-2 text-[12px]">
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{o.name}</span>
                    <span className="flex-shrink-0 tabular-nums text-amber-700">
                      {o.remaining} of {o.total} left
                    </span>
                    <span className="flex-shrink-0 text-slate-500">{o.who}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-400">
                A checkpoint that does not apply still needs a grade — mark it Not Applicable.
              </p>
            </div>
          )}
          {readyToSubmit && (
          <p className="text-sm text-slate-600">
            All checkpoints graded.
            {scorePct !== null && <> Score stands at <span className="font-semibold text-slate-800">{scoreObtained}/{scoreAllotted} ({scorePct}%)</span>.</>}
            {isDeptAudit ? (
              <>
                {" "}Every Non-Conformance and Observation routes to its auditee; critical ones
                auto-spawn CAPA. Each needs audit findings — the server will flag any that don&apos;t.
              </>
            ) : (
              <>
                {" "}Every checkpoint below Effective routes to its auditee; critical ones auto-spawn
                CAPA. Each needs audit findings and a risk grade — the server will flag any that don&apos;t.
              </>
            )}
          </p>
          )}
          {/* Two documents come out of this, and each is issued separately
              after submission. Saying so here is what stops "I submitted it,
              where is the EnMS report?" */}
          {isDeptAudit && (
            <Card className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[12px] text-slate-600 shadow-none">
              <div className="mb-1 font-medium text-slate-700">Two reports will be issued from this audit</div>
              {streams.map((s) => (
                <div key={s.code} className="flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", STREAM_META[s.code].dot)} />
                  <span className="font-medium">{s.label}</span>
                  <span className="text-slate-400">· {s.answered}/{s.total} answered · {s.standards}</span>
                </div>
              ))}
            </Card>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowSubmit(false)}>
              {readyToSubmit ? "Cancel" : "Close"}
            </Button>
            <Button type="button" size="sm" onClick={doSubmit} disabled={submitting || !readyToSubmit}
              title={readyToSubmit ? undefined : "Every discipline must be graded first."}>
              {submitting && <Loader2 size={14} className="animate-spin" />} Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {replicating && (
        <ReplicateDialog
          item={replicating.item}
          targets={replicating.targets}
          busy={replicateBusy === replicating.item.id}
          onClose={() => setReplicating(null)}
          onConfirm={(depts, includeFindings, overwrite) =>
            doReplicate(replicating.item, depts, includeFindings, overwrite)}
        />
      )}

      {showAdd && (
        <AddCheckpointDialog
          auditId={audit.id}
          disciplines={rollup.map((c) => ({ code: c.categoryId, name: c.categoryName }))}
          defaultDiscipline={disciplineId !== "ALL" ? disciplineId : rollup[0]?.categoryId ?? ""}
          axisLabel={isDeptAudit ? "Department" : "Discipline"}
          streams={isDeptAudit ? streams.map((s) => ({ code: s.code, label: s.label })) : []}
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
      {failed > 0 && <Badge variant="danger" className="rounded-full bg-rose-100 px-1 text-[10px] font-bold text-rose-700">{failed}✕</Badge>}
      {done && failed === 0 ? <Check size={13} className="text-emerald-600" /> : <span className="text-[10px] tabular-nums text-slate-400">{cpct}%</span>}
    </Button>
  );
}

/**
 * One card. Usually one checkpoint; on a department audit, sometimes TWO — the
 * same requirement asked once against ISO 9001/14001/45001 and again against
 * ISO 50001, which the two sheets both carry.
 *
 * The pair is two ROWS (the score, the routing and the two reports are all
 * per-stream) rendered as one card with an IMS / EnMS toggle, so the auditor
 * answers "Previous Audit and NC Closure Status" once in each management
 * system rather than meeting the same sentence twice, forty rows apart.
 *
 * The handlers take the ACTIVE row rather than being bound to a fixed one:
 * with two rows behind one card, a closed-over `item` would send every EnMS
 * verdict to the IMS row.
 */
function CheckpointCard({
  card, savingIds, failedIds, ownerName, replicateBusy, replicationCounts,
  onGrade, onStatus, onConformance, onRiskGrade, onScore, onObservation,
  onAddPhoto, onRemovePhoto, onReplicate,
}: {
  card: Resp[];
  savingIds: Set<string>;
  /** Rows whose last write did not reach the server. Sticky until one does. */
  failedIds: Set<string>;
  /** replicationKey → departments holding it, audit-wide. Absent key = none. */
  replicationCounts: Record<string, number>;
  ownerName: (id: string | null | undefined) => string | null;
  replicateBusy: string | null;
  onGrade: (item: Resp, g: GradeAwarded) => void;
  onStatus: (item: Resp, s: ComplianceStatus) => void;
  onConformance: (item: Resp, c: Conformance) => void;
  onRiskGrade: (item: Resp, r: RiskGrade) => void;
  onScore: (item: Resp, n: number) => void;
  onObservation: (item: Resp, t: string) => void;
  onAddPhoto: (item: Resp, f: File) => void;
  onRemovePhoto: (item: Resp, i: number) => void;
  onReplicate: (item: Resp) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Which half of a pair is showing. Opens on the first stream the card holds
  // — IMS on a full pair — and is keyed by checkpoint code rather than index so
  // a refetch that reorders the page cannot silently swap which one is active.
  const [activeCode, setActiveCode] = useState(card[0].checkpointCode);
  const item = card.find((c) => c.checkpointCode === activeCode) ?? card[0];
  const isPaired = card.length > 1;
  const saving = savingIds.has(item.id);
  const failed = failedIds.has(item.id);
  const answered = item.assessmentStatus !== "NOT_ASSESSED";

  // Which conformance control this row offers. Read per ROW, not per audit: one
  // register can legitimately hold both (an internal audit and an IMS audit at
  // the same site), and a card must render the control its own checkpoint was
  // materialised with.
  const isTristate = item.conformanceMode === "TRISTATE";
  const conformance = item.conformance ?? conformanceOf(item.complianceStatus);

  const grade = item.gradeAwarded ?? null;
  const photos = item.auditorResponse?.photos ?? [];
  // "Adverse" = anything below Effective that is not N/A: the grades that
  // produce a finding, and therefore the ones that owe findings text before the
  // audit can be submitted. A risk grade is owed too — except in TRISTATE,
  // whose source form has no risk column.
  const isAdverse = carriesRiskGrade(grade);
  const findingsMissing = isAdverse && !(item.auditorResponse?.text_observation ?? "").trim();
  const riskMissing = requiresRiskGrade(grade, item.conformanceMode) && !item.riskGrade;
  const needsPhoto = item.requiresPhotoOnFail && isAdverse && photos.length === 0;
  const reqType = item.requirementType ? REQUIREMENT_TYPE_META[item.requirementType] : null;
  const scoreOverridden =
    item.scoreObtained !== null && item.scoreObtained !== suggestScore(grade, item.complianceStatus ?? null);
  const canReplicate = !!item.replicationKey;
  // How many OTHER departments hold this same workbook line. The map counts
  // every department holding the key including this one, so subtract our own;
  // a key absent from the map reaches nobody else.
  const replicationSiblings = Math.max(
    0, (replicationCounts[item.replicationKey ?? ""] ?? 0) - 1,
  );

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setUploading(true); await onAddPhoto(item, file); setUploading(false);
  }

  return (
    <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-none">
      {/* The IMS / EnMS toggle. Each side shows its own answered state, so the
          auditor can see at a glance that they have done one and not the other
          — the failure this card exists to prevent. */}
      {isPaired && (
        <div className="mb-3 flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {card.map((r) => {
            const code = (r.streamCode ?? "IMS") as StreamCode;
            const meta = STREAM_META[code];
            const on = r.checkpointCode === activeCode;
            const answered = r.assessmentStatus !== "NOT_ASSESSED";
            const rc = r.conformance ?? conformanceOf(r.complianceStatus);
            return (
              <Button key={r.checkpointCode} type="button" variant="ghost"
                onClick={() => setActiveCode(r.checkpointCode)}
                title={meta.standards}
                className={cn("h-auto flex-1 justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition",
                  on ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                <span className={cn("size-1.5 rounded-full", meta.dot)} />
                {meta.label}
                {answered && rc ? (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", CONFORMANCE_META[rc].chip)}>
                    {CONFORMANCE_META[rc].short}
                  </span>
                ) : answered ? (
                  <Check size={12} className="text-emerald-600" />
                ) : (
                  <span className="text-[10px] text-slate-400">not answered</span>
                )}
              </Button>
            );
          })}
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="neutral" className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{item.checkpointCode}</Badge>
        {/* On an unpaired row the stream is still worth naming — it decides
            which of the two reports this finding will be printed in. */}
        {item.streamCode && !isPaired && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STREAM_META[item.streamCode].chip)}
            title={STREAM_META[item.streamCode].standards}>
            {STREAM_META[item.streamCode].label}
          </span>
        )}
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
          <Badge variant="violet" className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-700"><Sparkles size={11} /> Custom</Badge>
        )}
        {/* The save badge reports the ROW, not the last request.
            It used to read `auditorResponse.is_saved`, which a server echoes
            back on any write — so an ungraded checkpoint that had once received
            an observation-only autosave displayed a green "saved" tick beside
            empty controls. "Saved" now requires there to be a verdict to have
            saved, and a failed write says so and keeps saying so. */}
        <span className="ml-auto text-[11px] text-slate-400">
          {saving ? (
            <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> saving…</span>
          ) : failed ? (
            <span className="inline-flex items-center gap-1 font-medium text-rose-600"><AlertTriangle size={12} /> not saved</span>
          ) : answered ? (
            <span className="inline-flex items-center gap-1 text-emerald-600"><Check size={12} /> saved</span>
          ) : null}
        </span>
      </div>

      <h3 className="text-sm font-semibold leading-snug text-slate-900">{item.checkpointQuestion}</h3>
      {item.guidance && <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600"><span className="font-medium text-slate-500">Guidance: </span>{item.guidance}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        {item.requirementReference && <span>📋 {item.requirementReference}</span>}
        {item.standard && <span>· {item.standard}</span>}
        {item.linkedSafeopsModule && <Badge variant="info" className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-sky-700"><Link2 size={11} /> {item.linkedSafeopsModule}</Badge>}
        {ownerName(item.assignedOwnerId) && <Badge variant="neutral" className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-slate-500"><UserRound size={11} /> {ownerName(item.assignedOwnerId)}</Badge>}
      </div>

      {isTristate ? (
        /* The three parameters the customer's IMS/EnMS sheet carries, verbatim
           from column E of both tabs. One control, writing the grade and status
           underneath — the score, the routing and both reports read those and
           need no branch of their own. */
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <Label className="block text-xs font-medium text-slate-600">
              Conformance <span className="text-rose-500">*</span>
            </Label>
            {/* N/A is an APPLICABILITY flag, not a fourth conformance parameter
                — a checkpoint that does not apply to this department was never
                conforming or non-conforming. Kept visually secondary for that
                reason, and it is what takes the row out of the score
                denominator. Without it the "N/A" filter would be a chip that
                can never match anything. */}
            <Button type="button" variant="ghost" onClick={() => onGrade(item, "NA")}
              title="This checkpoint does not apply to this department — excluded from the score"
              className={cn("h-auto rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
                grade === "NA"
                  ? "border-slate-400 bg-slate-100 text-slate-700"
                  : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50")}>
              {grade === "NA" && <Check size={11} className="mr-1 inline" />}
              Not applicable
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CONFORMANCE_ORDER.map((c) => {
              const meta = CONFORMANCE_META[c]; const on = conformance === c;
              return (
                <Button key={c} type="button" variant="outline" onClick={() => onConformance(item, c)}
                  className={cn("h-auto justify-center gap-2 rounded-xl border-2 py-2.5 text-[12px] font-semibold leading-tight",
                    on ? meta.ring : "border-slate-200 text-slate-500")}>
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white", on ? meta.dot : "bg-slate-200")}>
                    {meta.score}
                  </span>
                  {meta.label}
                </Button>
              );
            })}
          </div>
          {grade === "NA" && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Marked not applicable — excluded from this department&apos;s score. Pick a
              parameter above to bring it back in.
            </p>
          )}
        </div>
      ) : (
        /* Column C — Grade Awarded. The one control that drives the rest. */
        <div className="mt-3">
          <Label className="mb-1 block text-xs font-medium text-slate-600">Grade Awarded <span className="text-rose-500">*</span></Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {GRADE_ORDER.map((g) => {
              const meta = GRADE_META[g]; const on = grade === g;
              return (
                <Button key={g} type="button" variant="outline" onClick={() => onGrade(item, g)} title={meta.label}
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
      )}

      {/* Replicate across departments.
          40 of the 60 IMS lines and all 22 EnMS ones are asked identically in
          HR, Admin and OHC, and re-typing the same answer three times is both
          the rework this removes and how the three copies come to disagree.

          Shown on every checkpoint that HAS a counterpart, and disabled until
          there is a verdict to copy — not hidden. Hiding it until the card was
          answered made the feature look like it existed in one department only:
          whichever one happened to have been graded first. An affordance an
          auditor has to discover by accident is one most of them never find.

          Conversely it is not rendered at all on the 20 STP/ETP lines that are
          Admin's alone, where its only possible outcome is "nothing to
          replicate to". A control that cannot act is worse than an absent one. */}
      {canReplicate && replicationSiblings > 0 && (
        <div className="mt-2">
          <Button type="button" variant="outline" size="sm"
            onClick={() => onReplicate(item)}
            disabled={replicateBusy === item.id || !answered}
            title={answered
              ? `Copy this verdict to the same checkpoint in the other ${replicationSiblings === 1 ? "department" : `${replicationSiblings} departments`}`
              : "Answer this checkpoint first — there is nothing to copy yet"}
            className={cn(
              "h-7 gap-1.5 border-dashed text-[11px] font-medium",
              answered
                ? "border-violet-300 text-violet-700 hover:bg-violet-50"
                : "border-slate-200 text-slate-400",
            )}>
            {replicateBusy === item.id
              ? <Loader2 size={12} className="animate-spin" />
              : <CopyPlus size={12} />}
            Apply to the other {replicationSiblings === 1 ? "department" : "departments"}
          </Button>
        </div>
      )}

      {/* Columns D–F, H. Only unfold once a grade exists — an ungraded
          checkpoint has nothing to say about status, score or risk.

          Hidden entirely in TRISTATE: status and score are settled by the three
          parameters above, and N/A + the repeat variants are unreachable there,
          so a dropdown offering seven statuses would let an auditor write a row
          the card cannot render back. */}
      {grade && !isTristate && (
        <Card className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2 shadow-none">
          {/* Column F — Status */}
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-slate-600">Status</Label>
            <SelectField value={item.complianceStatus ?? ""} onChange={(value) => onStatus(item, value as ComplianceStatus)} className="h-8 text-xs"
              placeholder="— select —"
              options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))}
            />
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
              <Card className="flex h-8 items-center rounded-md border border-slate-200 bg-slate-100 px-2 text-xs text-slate-500 shadow-none">NA</Card>
            ) : (
              <SelectField value={String(item.scoreObtained ?? "")} onChange={(value) => onScore(item, Number(value))} className="h-8 text-xs"
                options={SCORE_CHOICES.map((n) => ({ value: String(n), label: String(n) }))}
              />
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
                    <Button key={r} type="button" variant="outline" size="sm" onClick={() => onRiskGrade(item, r)}
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
        </Card>
      )}

      {/* Column G — Audit Findings (the auditor's comment).
          Keyed by checkpoint code so flipping the IMS / EnMS toggle swaps the
          textarea's content: it is uncontrolled (`defaultValue`, so typing is
          not debounced through React state), and without the key React would
          reuse the same DOM node and show the IMS comment against the EnMS
          verdict. */}
      {(isAdverse || (item.auditorResponse?.text_observation ?? "").length > 0) && (
        <div className="mt-3">
          <Label className="mb-1 block text-xs font-medium text-slate-600">Audit Findings {isAdverse && <span className="text-rose-500">*</span>}</Label>
          <Textarea key={item.checkpointCode}
            defaultValue={item.auditorResponse?.text_observation ?? ""} onChange={(e) => onObservation(item, e.target.value)} rows={2}
            placeholder={isAdverse
              ? isTristate
                ? `Required for a ${(CONFORMANCE_META[conformance!] ?? CONFORMANCE_META.OBSERVATION).label} — what did you observe?`
                : `Required for a ${GRADE_META[grade!].label.toLowerCase()} grade — what did you observe?`
              : "What did you observe?"}
            className={cn("min-h-[54px]", findingsMissing && "border-rose-300 focus-visible:ring-rose-300")} />
          {findingsMissing && (
            <p className="mt-1 text-[11px] text-rose-600">
              Audit findings are required for a {isTristate && conformance
                ? CONFORMANCE_META[conformance].label
                : GRADE_META[grade!].label}
              {isTristate ? "." : " grade."}
            </p>
          )}
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
        <AttachmentStrip attachments={photos} onRemove={(i) => onRemovePhoto(item, i)} className="mb-2" />
        <Input ref={fileRef} type="file" accept={IMAGE_ACCEPT} capture="environment" className="hidden" onChange={onPhoto} />
        <Input ref={docRef} type="file" accept={DOCUMENT_ACCEPT} className="hidden" onChange={onPhoto} />
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
    </Card>
  );
}

/**
 * Copy one checkpoint's verdict onto the same workbook line in the other
 * departments of this audit.
 *
 * Reads the targets BEFORE asking, so it can name what it is about to
 * overwrite. A dialog that reported "3 departments updated" and then revealed
 * it had replaced two deliberate findings would be worse than no feature: the
 * auditor may have found Admin genuinely different from HR, and that judgement
 * is the whole value of auditing three departments separately.
 */
function ReplicateDialog({ item, targets, busy, onClose, onConfirm }: {
  item: Resp;
  targets: ReplicationTarget[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (departments: string[], includeFindings: boolean, overwrite: boolean) => void;
}) {
  const open = targets.filter((t) => !t.locked);
  const locked = targets.filter((t) => t.locked);
  const [selected, setSelected] = useState<string[]>(() => open.map((t) => t.departmentId));
  const [includeFindings, setIncludeFindings] = useState(true);
  const [overwrite, setOverwrite] = useState(false);

  const chosen = open.filter((t) => selected.includes(t.departmentId));
  const clashes = chosen.filter((t) => t.wouldOverwrite);
  const willWrite = overwrite ? chosen.length : chosen.length - clashes.length;
  const conformance = item.conformance ?? conformanceOf(item.complianceStatus);
  const verdictLabel = conformance
    ? CONFORMANCE_META[conformance].label
    : item.gradeAwarded ? GRADE_META[item.gradeAwarded].label : "this verdict";

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CopyPlus size={16} className="text-violet-600" /> Apply to the other departments
          </DialogTitle>
          <DialogDescription className="sr-only">
            Copy this checkpoint&apos;s verdict onto the same checkpoint in other departments.
          </DialogDescription>
        </DialogHeader>

        <Card className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[12px] shadow-none">
          <div className="font-mono text-[11px] text-slate-500">{item.checkpointCode}</div>
          <div className="mt-0.5 font-medium leading-snug text-slate-800">{item.checkpointQuestion}</div>
          <div className="mt-1.5 flex items-center gap-1.5">
            {conformance && (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", CONFORMANCE_META[conformance].chip)}>
                {CONFORMANCE_META[conformance].label}
              </span>
            )}
            <span className="text-slate-400">from {item.categoryName}</span>
          </div>
        </Card>

        <div className="space-y-1.5">
          {open.map((t) => (
            <Label key={t.departmentId}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] hover:bg-slate-50">
              <Checkbox checked={selected.includes(t.departmentId)} onChange={() => toggle(t.departmentId)} />
              <span className="flex-1 font-medium text-slate-700">{t.departmentName}</span>
              {t.wouldOverwrite ? (
                <Badge variant="warning" className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  already {t.conformance ? CONFORMANCE_META[t.conformance].short : "graded"}
                </Badge>
              ) : (
                <span className="text-[11px] text-slate-400">not answered</span>
              )}
            </Label>
          ))}
          {/* A finding already with its auditee is not replaceable at all —
              re-grading underneath a live iteration would rewrite the question
              they are currently answering. Listed rather than hidden, so the
              auditor knows why a department is absent from the list. */}
          {locked.map((t) => (
            <Card key={t.departmentId}
              className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-2.5 py-2 text-[13px] text-slate-400 shadow-none">
              <span className="flex-1">{t.departmentName}</span>
              <span className="text-[11px]">with its auditee — can&apos;t be changed</span>
            </Card>
          ))}
        </div>

        <Label className="flex items-center gap-2 text-[13px] text-slate-600">
          <Checkbox checked={includeFindings} onChange={(e) => setIncludeFindings(e.target.checked)} />
          Copy the audit findings text too
        </Label>
        {includeFindings && (
          <p className="-mt-2 pl-6 text-[11px] text-slate-400">
            A Non-Conformance copied without the sentence explaining it is a finding nobody can act
            on — and the audit will not submit until each one has some.
          </p>
        )}

        {clashes.length > 0 && (
          <Label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[13px] text-amber-900">
            <Checkbox checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="mt-0.5" />
            <span>
              Replace the {clashes.length} department{clashes.length === 1 ? "" : "s"} already answered
              <span className="block text-[11px] text-amber-700">
                {clashes.map((t) => t.departmentName).join(", ")} — their current verdict will be
                overwritten.
              </span>
            </span>
          </Label>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" disabled={busy || willWrite <= 0}
            onClick={() => onConfirm(selected, includeFindings, overwrite)}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            {willWrite > 0
              ? `Apply ${verdictLabel} to ${willWrite} department${willWrite === 1 ? "" : "s"}`
              : "Nothing to apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddCheckpointDialog({ auditId, disciplines, defaultDiscipline, axisLabel, streams, canPromote, onClose, onAdded }: {
  auditId: string; disciplines: { code: string; name: string }[]; defaultDiscipline: string;
  /** "Department" on a department audit, "Discipline" everywhere else. */
  axisLabel: string;
  /** The reports this audit issues. Empty when it issues one, in which case the
   *  stream selector is not rendered at all. */
  streams: { code: StreamCode; label: string }[];
  canPromote: boolean; onClose: () => void; onAdded: (cp: Resp) => void;
}) {
  const { toast } = useToast();
  const [disciplineId, setDisciplineId] = useState(defaultDiscipline);
  const [streamCode, setStreamCode] = useState<StreamCode | "">(streams[0]?.code ?? "");
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
      body: JSON.stringify({
        disciplineId, question, severity, guidance, standardClauseRef, evidenceRequiredOnFail,
        promoteToTemplate: canPromote && promoteToTemplate,
        ...(streamCode ? { streamCode } : {}),
      }),
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
          <div className={cn("grid gap-3", streams.length ? "grid-cols-3" : "grid-cols-2")}>
            <div className="space-y-1">
              <Label className="text-xs">{axisLabel}</Label>
              <SelectField value={disciplineId} onChange={setDisciplineId}
                options={disciplines.map((d) => ({ value: d.code, label: d.name }))}
              />
            </div>
            {/* Which report this line joins. Asked rather than inferred: on a
                department audit "add a checkpoint" is genuinely ambiguous, and
                one that landed in neither report would be present in the
                register and absent from both documents. */}
            {streams.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Report</Label>
                <SelectField value={streamCode} onChange={(value) => setStreamCode(value as StreamCode)}
                  options={streams.map((s) => ({ value: s.code, label: s.label }))}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Severity</Label>
              <SelectField value={severity} onChange={(value) => setSeverity(value as (typeof SEVERITIES)[number])}
                options={SEVERITIES.map((s) => ({ value: s, label: s }))}
              />
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
          <Label className="flex items-center gap-2 text-[13px] text-slate-600">
            <Checkbox checked={evidenceRequiredOnFail} onChange={(e) => setEvidence(e.target.checked)} />
            Require an evidence photo on a fail / partial
          </Label>
          {canPromote && (
            <Label className="flex items-center gap-2 text-[13px] text-slate-600">
              <Checkbox checked={promoteToTemplate} onChange={(e) => setPromote(e.target.checked)} />
              Also save to the template (forks a new version for future audits)
            </Label>
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
