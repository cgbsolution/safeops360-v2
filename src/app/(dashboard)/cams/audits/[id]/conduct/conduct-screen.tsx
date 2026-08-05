"use client";

// ──────────────────────────────────────────────────────────────────────
// THE SHOWPIECE — on-site conduct UI engineered for LARGE audits (≈1500
// checkpoints). Discipline-scoped, server-paginated worklist: the screen never
// holds more than one discipline's page in memory. Left/top discipline
// navigator (from the rollup — no row load), status filter + search, inline
// Pass/Partial/Fail/NA per card with auto-save, and bulk "mark discipline" fast
// paths. Every checkpoint is reachable; nothing is rendered until scoped to.
// ──────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Check, Camera, AlertTriangle, Link2, Loader2, X, ArrowLeft,
  Trash2, UserRound, Sparkles, Plus, Search, ListChecks, ChevronDown,
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
  AuditDetail, CheckpointResponse, AuditValue, DisciplineRollup,
  CRITICALITY_CHIP, CRITICALITY_FALLBACK, VALUE_META, PlantUser, apiErrorMessage,
} from "../../lib";
import { uploadAuditPhoto, deleteAuditPhoto } from "../../upload-photo";
// WP-44: annotation + QR jump. Both reuse existing platform pieces rather
// than introducing a second markup surface or a second QR scheme.
import { PhotoAnnotator } from "@/components/assurance/photo-annotator";
import { QrJumpButton } from "@/components/assurance/qr-jump";

type Resp = CheckpointResponse;
type StatusFilter = "all" | "unanswered" | "pass" | "partial" | "fail" | "na";
type Bucket = "passed" | "partial" | "failed" | "na";

const SEVERITIES = ["critical", "major", "minor", "observation"] as const;
const PAGE = 40;

// auditorResponse.value → rollup bucket key (null = unanswered).
function bucketOf(v: AuditValue | undefined | null): Bucket | null {
  if (v === "pass" || v === "yes") return "passed";
  if (v === "partial") return "partial";
  if (v === "fail" || v === "no") return "failed";
  if (v === "na") return "na";
  return null;
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

  const userName = useMemo(() => {
    const m = new Map(users.map((u) => [u.id, u.name] as const));
    return (id: string | null | undefined) => (id ? m.get(id) ?? "Unknown user" : null);
  }, [users]);

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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
      if (statusFilter !== "all") params.set("value", statusFilter);
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
    [audit.id, disciplineId, statusFilter, qDebounced, mineOnly, toast],
  );

  // Refetch when scope/filter/search changes.
  useEffect(() => {
    fetchPage(true, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disciplineId, statusFilter, qDebounced, mineOnly]);

  function patchItem(id: string, fn: (r: Resp) => Resp) {
    setItems((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));
  }

  // Apply a verdict change to the live rollup (keeps navigator + progress live
  // without a refetch). oldB/newB are rollup bucket keys (or null=unanswered).
  function applyDelta(catId: string, oldB: Bucket | null, newB: Bucket | null, crit: boolean) {
    if (oldB === newB) return;
    setRollup((prev) => prev.map((c) => {
      if (c.categoryId !== catId) return c;
      const n = { ...c };
      if (oldB) { n[oldB] = Math.max(0, n[oldB] - 1); n.answered = Math.max(0, n.answered - 1); if (oldB === "failed" && crit) n.criticalFailed = Math.max(0, n.criticalFailed - 1); }
      if (newB) { n[newB] = n[newB] + 1; n.answered = n.answered + 1; if (newB === "failed" && crit) n.criticalFailed = n.criticalFailed + 1; }
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

  async function setVerdict(item: Resp, v: AuditValue) {
    const cur = item.auditorResponse?.value ?? null;
    const next = cur === v ? null : v;
    const oldB = bucketOf(cur), newB = bucketOf(next);
    const ok = await saveField(item, { value: next }, (r) => ({ ...r, auditorResponse: { ...(r.auditorResponse ?? { value: null }), value: next } }));
    if (ok) applyDelta(item.categoryId, oldB, newB, item.criticality === "critical");
  }

  // Debounced observation save.
  const obsTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  function setObservation(item: Resp, text: string) {
    patchItem(item.id, (r) => ({ ...r, auditorResponse: { ...(r.auditorResponse ?? { value: null }), text_observation: text } }));
    const m = obsTimers.current;
    if (m.get(item.id)) clearTimeout(m.get(item.id)!);
    m.set(item.id, setTimeout(() => saveField(item, { textObservation: text }, (r) => r), 700));
  }

  // Offer markup first. Images only — a PDF has nothing to draw on, so it
  // goes straight up rather than opening a canvas over a blank frame.
  function addPhoto(item: Resp, file: File) {
    if (file.type.startsWith("image/")) {
      setPendingPhoto({ item, file, url: URL.createObjectURL(file) });
      return;
    }
    void uploadPhoto(item, file);
  }

  async function uploadPhoto(item: Resp, file: File, annotated?: Blob) {
    const res = await uploadAuditPhoto(file, { auditId: audit.id, checkpointCode: item.checkpointCode });
    if (!res.ok) { toast({ variant: "error", title: "Photo upload failed", description: res.error }); return; }

    // One capture = ONE attachment. Both objects are still stored — the marked
    // copy is what the checkpoint shows, the untouched original hangs off it
    // via originalStoragePath — because two identical-looking thumbnails per
    // photo read as a duplication bug, while silently discarding the unmarked
    // evidence would be the worse trade.
    let photo = res.photo;
    if (annotated) {
      const marked = new File([annotated], `annotated-${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
        type: "image/jpeg",
      });
      const res2 = await uploadAuditPhoto(marked, { auditId: audit.id, checkpointCode: item.checkpointCode });
      // If only the derivative fails, keep the original as the attachment
      // rather than losing the capture over a failed re-encode.
      if (res2.ok) {
        photo = { ...res2.photo, originalStoragePath: res.photo.storagePath, originalUrl: res.photo.url };
      }
    }

    const photos = [...(item.auditorResponse?.photos ?? []), photo];
    await saveField(item, { photos }, (r) => ({ ...r, auditorResponse: { ...(r.auditorResponse ?? { value: null }), photos } }));
    toast({
      variant: "success",
      title: annotated ? "Annotated photo attached" : "Photo attached",
      description: annotated ? "The unmarked original is retained on the record." : undefined,
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
    void deleteAuditPhoto(removed?.storagePath);
    // An annotated attachment owns two objects. Dropping only the marked copy
    // would orphan the original in storage with nothing left referencing it.
    void deleteAuditPhoto(removed?.originalStoragePath);
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
    setRollup((prev) => prev.map((c) => c.categoryId === disciplineId ? { ...c, [bucket]: c[bucket] + moved, answered: c.answered + moved } : c));
    toast({ variant: "success", title: `Marked ${moved} checkpoint${moved === 1 ? "" : "s"} ${value === "pass" ? "Pass" : "N/A"}`, description: selectedDisc.categoryName });
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

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" }, { key: "unanswered", label: "Unanswered" },
    { key: "pass", label: "Pass" }, { key: "partial", label: "Partial" },
    { key: "fail", label: "Fail" }, { key: "na", label: "N/A" },
  ];

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
          <div className="text-right">
            <div className="text-sm font-bold tabular-nums text-violet-700">{pct}%</div>
            <div className="text-[11px] tabular-nums text-slate-400">{answeredTotal}/{grandTotal}</div>
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
              {STATUS_TABS.map((t) => (
                <Button key={t.key} type="button" variant="ghost" onClick={() => setStatusFilter(t.key)}
                  className={cn("h-auto rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                    statusFilter === t.key ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
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
                <span className="text-slate-400">{selectedDisc.answered}/{selectedDisc.total} assessed</span>
                {selectedDisc.failed > 0 && <span className="rounded-full bg-rose-100 px-1.5 text-rose-700">{selectedDisc.failed}✕</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Mark remaining:</span>
                  <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]" disabled={!!bulkBusy || selectedDisc.answered >= selectedDisc.total} onClick={() => bulkMark("pass")}>
                    {bulkBusy === "pass" ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Pass
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
              <div className="text-[11px] text-slate-400">{total} checkpoint{total === 1 ? "" : "s"}{statusFilter !== "all" ? ` · ${statusFilter}` : ""}</div>
              {items.map((item) => (
                <CheckpointCard key={item.id} item={item} saving={savingIds.has(item.id)} ownerName={userName(item.assignedOwnerId)}
                  onVerdict={(v) => setVerdict(item, v)} onObservation={(t) => setObservation(item, t)}
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
            {answeredTotal === grandTotal ? "All checkpoints answered." : `${grandTotal - answeredTotal} checkpoint(s) are unanswered and will be marked not assessed.`}
            {" "}Failed and partial checkpoints route to auditees; critical failures auto-spawn CAPA. Fail/partial checkpoints must have an observation — the server will flag any that don&apos;t.
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

function CheckpointCard({ item, saving, ownerName, onVerdict, onObservation, onAddPhoto, onRemovePhoto }: {
  item: Resp; saving: boolean; ownerName: string | null;
  onVerdict: (v: AuditValue) => void; onObservation: (t: string) => void;
  onAddPhoto: (f: File) => void; onRemovePhoto: (i: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const cval = item.auditorResponse?.value ?? null;
  const photos = item.auditorResponse?.photos ?? [];
  const isAdverse = cval === "fail" || cval === "partial";
  const obsMissing = isAdverse && !(item.auditorResponse?.text_observation ?? "").trim();
  const needsPhoto = item.requiresPhotoOnFail && isAdverse && photos.length === 0;

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setUploading(true); await onAddPhoto(file); setUploading(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{item.checkpointCode}</span>
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

      {/* Verdict buttons */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {(["pass", "partial", "fail", "na"] as const).map((v) => {
          const meta = VALUE_META[v]; const on = cval === v;
          return (
            <Button key={v} type="button" variant="outline" onClick={() => onVerdict(v)}
              className={cn("h-auto flex-col gap-1 rounded-xl border-2 py-2.5 text-xs font-semibold",
                on ? v === "pass" ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                  : v === "partial" ? "border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-50"
                    : v === "fail" ? "border-rose-500 bg-rose-50 text-rose-700 hover:bg-rose-50"
                      : "border-slate-400 bg-slate-100 text-slate-600 hover:bg-slate-100"
                  : "border-slate-200 text-slate-500")}>
              <span className={cn("flex size-5 items-center justify-center rounded-full text-white", on ? meta.dot : "bg-slate-200")}>
                {v === "pass" ? <Check size={13} /> : v === "fail" ? <X size={13} /> : v === "partial" ? "~" : "–"}
              </span>
              {meta.label}
            </Button>
          );
        })}
      </div>

      {/* Observation (required on fail/partial) */}
      {(isAdverse || (item.auditorResponse?.text_observation ?? "").length > 0) && (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">Observation {isAdverse && <span className="text-rose-500">*</span>}</label>
          <Textarea defaultValue={item.auditorResponse?.text_observation ?? ""} onChange={(e) => onObservation(e.target.value)} rows={2}
            placeholder={isAdverse ? "Required for a fail / partial — what did you observe?" : "What did you observe?"}
            className={cn("min-h-[54px]", obsMissing && "border-rose-300 focus-visible:ring-rose-300")} />
          {obsMissing && <p className="mt-1 text-[11px] text-rose-600">An observation is required for a {cval} response.</p>}
        </div>
      )}

      {/* Photos */}
      <div className="mt-2.5">
        {photos.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative size-14 overflow-hidden rounded-lg border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <a href={p.url} target="_blank" rel="noreferrer" className="block size-full hover:ring-2 hover:ring-violet-300"><img src={p.url} alt={p.caption || `photo ${i + 1}`} className="size-full object-cover" /></a>
                <Button type="button" variant="destructive" size="icon" onClick={() => onRemovePhoto(i)} className="absolute right-0.5 top-0.5 size-4 rounded-full shadow ring-1 ring-white"><Trash2 size={9} /></Button>
              </div>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className={cn(needsPhoto && "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100")}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} {uploading ? "Uploading…" : "Add photo"}
          </Button>
          {needsPhoto && <span className="text-[11px] text-rose-600">Evidence photo required for this {cval}</span>}
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
