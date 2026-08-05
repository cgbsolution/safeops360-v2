"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { BandBadge } from "@/components/erm/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtDate } from "../../lib";
import {
  OBLIGATION_STATUS_CHIP,
  TASK_STATUS_CHIP,
  type ComplianceTask,
  type ObligationDetail,
} from "../../lib-p2";

const TABS = ["Overview", "Tasks", "Evidence", "Audit"] as const;
type Tab = (typeof TABS)[number];

function typeLabel(token: string | null | undefined): string {
  if (!token) return "—";
  return token.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ObligationDetailView({ obligation }: { obligation: ObligationDetail }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">{obligation.obligationCode}</span>
              <h1 className="text-lg font-bold text-slate-900">{obligation.title}</h1>
              <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                {typeLabel(obligation.obligationType)}
              </span>
              <span className={"rounded border px-2 py-0.5 text-[11px] font-medium " + (OBLIGATION_STATUS_CHIP[obligation.status] ?? "")}>
                {obligation.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Regulator <b>{obligation.regulatorName || "—"}</b> · Owner <b>{obligation.ownerName ?? "—"}</b>
              {obligation.siteName && <> · {obligation.siteName}</>} · {typeLabel(obligation.frequency)}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Valid until</div>
            <div className="text-sm font-semibold text-slate-800">{fmtDate(obligation.validUntil)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Button
            key={t}
            type="button"
            variant="ghost"
            onClick={() => setTab(t)}
            className={cn(
              "h-auto border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t ? "border-primary-700 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {t}
            {t === "Tasks" && obligation.tasks.length > 0 && <span className="ml-1 text-[10px] text-slate-400">{obligation.tasks.length}</span>}
            {t === "Evidence" && obligation.attachments.length > 0 && <span className="ml-1 text-[10px] text-slate-400">{obligation.attachments.length}</span>}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {tab === "Overview" && <OverviewTab obligation={obligation} />}
        {tab === "Tasks" && <TasksTab obligation={obligation} onChanged={() => router.refresh()} />}
        {tab === "Evidence" && <EvidenceTab obligation={obligation} />}
        {tab === "Audit" && (
          <p className="py-10 text-center text-sm text-slate-400">Audit trail will surface here in a later pass.</p>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm text-slate-700">{value}</div>
    </div>
  );
}

function OverviewTab({ obligation }: { obligation: ObligationDetail }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Meta label="Statute reference" value={obligation.statuteReference || "—"} />
        <Meta label="Regulator" value={obligation.regulatorName || "—"} />
        <Meta label="Frequency" value={typeLabel(obligation.frequency)} />
        <Meta label="Renewal lead days" value={obligation.renewalLeadDays} />
        <Meta label="Valid from" value={fmtDate(obligation.validFrom)} />
        <Meta label="Valid until" value={fmtDate(obligation.validUntil)} />
        <Meta label="Owner" value={obligation.ownerName ?? "—"} />
        <Meta label="Site" value={obligation.siteName ?? "—"} />
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Conditions</h3>
        {obligation.conditions.length === 0 ? (
          <p className="text-xs text-slate-400">No conditions recorded.</p>
        ) : (
          <ul className="space-y-1.5">
            {obligation.conditions.map((c, i) => (
              <li key={i} className="rounded-md border border-slate-100 bg-slate-50/50 px-3 py-1.5 text-sm text-slate-700">
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Linked risks</h3>
        {obligation.linkedRisks.length === 0 ? (
          <p className="text-xs text-slate-400">No linked enterprise risks.</p>
        ) : (
          <ul className="space-y-2">
            {obligation.linkedRisks.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <Link href={`/erm/register/${r.id}`} className="font-medium text-primary-700 hover:underline">
                  {r.riskCode}
                </Link>
                <span className="truncate text-slate-600">{r.title}</span>
                <span className="ml-auto">
                  <BandBadge band={r.residualBand} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EvidenceTab({ obligation }: { obligation: ObligationDetail }) {
  const sorted = [...obligation.attachments].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
  if (sorted.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No evidence uploaded yet — add it from a task.</p>;
  }
  return (
    <ul className="space-y-2">
      {sorted.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-800">{a.fileName}</div>
            {a.caption && <div className="text-xs text-slate-500">{a.caption}</div>}
            {a.mimeType && <div className="text-[10px] uppercase text-slate-400">{a.mimeType}</div>}
          </div>
          <div className="shrink-0 text-right text-[11px] text-slate-400">
            <div>{a.uploadedByName ?? "—"}</div>
            <div>{fmtDate(a.uploadedAt)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TasksTab({ obligation, onChanged }: { obligation: ObligationDetail; onChanged: () => void }) {
  if (obligation.tasks.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No compliance tasks generated for this obligation.</p>;
  }
  return (
    <Table className="min-w-[960px]">
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Attested</TableHead>
          <TableHead>Verified</TableHead>
          <TableHead>Evidence</TableHead>
          <TableHead>CAPA</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {obligation.tasks.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="text-slate-700">{typeLabel(t.taskType)}</TableCell>
            <TableCell className="text-xs text-slate-600">{t.periodLabel}</TableCell>
            <TableCell className="text-xs tabular-nums text-slate-500">
              {fmtDate(t.dueDate)}
              {t.overdueDays > 0 && (
                <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700">{t.overdueDays}d</span>
              )}
            </TableCell>
            <TableCell>
              <span className={"inline-block rounded border px-2 py-0.5 text-[11px] " + (TASK_STATUS_CHIP[t.status] ?? "")}>
                {t.status}
              </span>
            </TableCell>
            <TableCell className="text-xs text-slate-600">{t.attestedByName ?? "—"}</TableCell>
            <TableCell className="text-xs text-slate-600">{t.verifiedByName ?? "—"}</TableCell>
            <TableCell className="text-center text-xs tabular-nums text-slate-600">{t.attachmentCount}</TableCell>
            <TableCell className="text-xs">
              {t.capaId ? (
                <Link href={`/capa/${t.capaId}`} className="font-medium text-primary-700 hover:underline">
                  CAPA ↗
                </Link>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <TaskActions task={t} onChanged={onChanged} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Task actions (shared semantics with My Tasks) ────────────────────────────
export function TaskActions({ task, onChanged }: { task: ComplianceTask; onChanged: () => void }) {
  const [modal, setModal] = useState<null | "evidence" | "attest" | "waive">(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function post(path: string, body?: any) {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/erm/compliance/tasks/${task.id}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.detail || j.error || `Failed (${res.status})`);
      return false;
    }
    setModal(null);
    onChanged();
    return true;
  }

  const st = task.status;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(st === "PENDING" || st === "OVERDUE") && (
        <>
          <ActionBtn onClick={() => setModal("evidence")} disabled={busy}>
            Add evidence
          </ActionBtn>
          <ActionBtn onClick={() => setModal("attest")} disabled={busy} primary>
            Attest
          </ActionBtn>
        </>
      )}
      {st === "OVERDUE" && (
        <ActionBtn onClick={() => post("raise-capa")} disabled={busy}>
          Raise CAPA
        </ActionBtn>
      )}
      {st === "SUBMITTED" && (
        <>
          <ActionBtn onClick={() => post("verify")} disabled={busy} primary>
            Verify
          </ActionBtn>
          <ActionBtn onClick={() => setModal("waive")} disabled={busy}>
            Waive
          </ActionBtn>
        </>
      )}
      {(st === "VERIFIED" || st === "WAIVED") && <span className="text-xs text-slate-400">—</span>}

      {err && (
        <span className="block w-full text-[11px] font-medium text-rose-600">{err}</span>
      )}

      {modal === "evidence" && (
        <EvidenceModal
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(b) => post("attachments", b)}
        />
      )}
      {modal === "attest" && (
        <RemarksModal
          title="Attest task"
          label="Remarks (optional)"
          confirmLabel="Attest"
          busy={busy}
          required={false}
          onClose={() => setModal(null)}
          onSubmit={(remarks) => post("attest", { remarks })}
        />
      )}
      {modal === "waive" && (
        <RemarksModal
          title="Waive task"
          label="Waiver justification (required)"
          confirmLabel="Waive"
          busy={busy}
          required
          onClose={() => setModal(null)}
          onSubmit={(waiverJustification) => post("waive", { waiverJustification })}
        />
      )}
    </div>
  );
}

export function ActionBtn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-auto rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
        primary ? "bg-primary-700 text-white hover:bg-primary-800" : "border border-slate-300 bg-white text-slate-700 hover:border-primary-500"
      )}
    >
      {children}
    </Button>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EvidenceModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: { fileName: string; mimeType: string; fileSize: number; caption: string }) => void;
}) {
  const [fileName, setFileName] = useState("");
  const [caption, setCaption] = useState("");
  return (
    <ModalShell title="Add evidence" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">File name (required)</label>
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="e.g. factory-licence-2026.pdf"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Caption</label>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            placeholder="What does this evidence demonstrate?"
          />
        </div>
        <Button
          variant="default"
          disabled={busy || !fileName.trim()}
          onClick={() =>
            onSubmit({
              fileName: fileName.trim(),
              mimeType: guessMime(fileName),
              fileSize: 0,
              caption: caption.trim(),
            })
          }
          className="w-full"
        >
          {busy ? "Saving…" : "Attach evidence"}
        </Button>
      </div>
    </ModalShell>
  );
}

export function RemarksModal({
  title,
  label,
  confirmLabel,
  busy,
  required,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  confirmLabel: string;
  busy: boolean;
  required: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        </div>
        <Button
          variant="default"
          disabled={busy || (required && !text.trim())}
          onClick={() => onSubmit(text.trim())}
          className="w-full"
        >
          {busy ? "Saving…" : confirmLabel}
        </Button>
      </div>
    </ModalShell>
  );
}

function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[ext] ?? "application/octet-stream";
}
