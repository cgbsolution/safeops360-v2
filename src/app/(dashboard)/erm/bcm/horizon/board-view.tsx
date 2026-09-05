"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";
import { SIGNAL_CHIP, SCENARIO_CATEGORIES, type HorizonItem } from "@/app/(dashboard)/erm/lib-p3";
import { fmtDate } from "@/app/(dashboard)/erm/lib";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const SIGNALS = ["WEAK", "EMERGING", "STRONG"] as const;
type Signal = (typeof SIGNALS)[number];

const SIGNAL_LABEL: Record<string, string> = { WEAK: "Weak", EMERGING: "Emerging", STRONG: "Strong" };

const CATEGORY_LABEL: Record<string, string> = {
  NATURAL_DISASTER: "Natural Disaster",
  CYBER_ATTACK: "Cyber Attack",
  SUPPLY_DISRUPTION: "Supply Disruption",
  UTILITY_FAILURE: "Utility Failure",
  PANDEMIC_WORKFORCE: "Pandemic / Workforce",
  MARKET_SHOCK: "Market Shock",
  REGULATORY_SHOCK: "Regulatory Shock",
  REPUTATIONAL_EVENT: "Reputational Event",
  GEOPOLITICAL: "Geopolitical",
};

const DISPOSITION_CHIP: Record<string, string> = {
  PROMOTED_TO_SCENARIO: "bg-indigo-100 text-indigo-800 border-indigo-200",
  PROMOTED_TO_RISK: "bg-violet-100 text-violet-800 border-violet-200",
  DISMISSED: "bg-slate-200 text-slate-500 border-slate-300",
};

const DISPOSITION_LABEL: Record<string, string> = {
  PROMOTED_TO_SCENARIO: "Promoted → Scenario",
  PROMOTED_TO_RISK: "Promoted → Risk",
  DISMISSED: "Dismissed",
};

export function HorizonBoard({ items }: { items: HorizonItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<HorizonItem | null>(null);

  const bySignal: Record<Signal, HorizonItem[]> = { WEAK: [], EMERGING: [], STRONG: [] };
  for (const it of items) {
    const s = (it.signalStrength as Signal) ?? "WEAK";
    if (bySignal[s]) bySignal[s].push(it);
    else bySignal.WEAK.push(it);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Watch item
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {SIGNALS.map((sig) => (
          <Card key={sig} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 shadow-none">
            <div className="mb-3 flex items-center justify-between">
              <span
                className={
                  "rounded border px-2 py-0.5 text-[11px] font-semibold " +
                  (SIGNAL_CHIP[sig] ?? "bg-slate-100 text-slate-600 border-slate-200")
                }
              >
                {SIGNAL_LABEL[sig]}
              </span>
              <span className="text-xs tabular-nums text-slate-400">{bySignal[sig].length}</span>
            </div>
            <div className="space-y-2">
              {bySignal[sig].length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">No {SIGNAL_LABEL[sig].toLowerCase()} signals.</p>
              ) : (
                bySignal[sig].map((it) => (
                  <Button variant="outline"
                    key={it.id}
                    onClick={() => setActive(it)} className="h-auto whitespace-normal block w-full rounded-lg p-3 text-left transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{it.title}</h3>
                      {it.disposition && (
                        <span
                          className={
                            "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium " +
                            (DISPOSITION_CHIP[it.disposition] ?? "bg-slate-100 text-slate-600 border-slate-200")
                          }
                        >
                          {DISPOSITION_LABEL[it.disposition] ?? it.disposition.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                        {CATEGORY_LABEL[it.category] ?? it.category.replace(/_/g, " ")}
                      </span>
                      <span>{it.watchedByName ?? "—"}</span>
                      <span>· Review {fmtDate(it.reviewDate)}</span>
                      {it.reviewOverdue && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">OVERDUE</span>
                      )}
                    </div>
                  </Button>
                ))
              )}
            </div>
          </Card>
        ))}
      </div>

      {open && <WatchItemModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} />}
      {active && (
        <ItemDrawer
          item={active}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
}

function WatchItemModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("GEOPOLITICAL");
  const [signalStrength, setSignalStrength] = useState<string>("WEAK");
  const [reviewDate, setReviewDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/erm/bcm/horizon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          signalStrength,
          potentialCategoryIds: [],
          reviewDate: reviewDate || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to add watch item (${res.status}).`);
        setBusy(false);
        return;
      }
      onDone();
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Watch item" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. New chemical import tariff under consultation"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Category</Label>
            <SelectField value={category} onChange={setCategory}
              options={SCENARIO_CATEGORIES.map((c) => ({ value: c, label: `${CATEGORY_LABEL[c] ?? c.replace(/_/g, " ")}` }))}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium text-slate-600">Signal strength</Label>
            <SelectField value={signalStrength} onChange={setSignalStrength}
              options={SIGNALS.map((s) => ({ value: s, label: `${SIGNAL_LABEL[s]}` }))}
            />
          </div>
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Review date</Label>
          <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-slate-600">Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What is the signal and why is it worth watching…"
          />
        </div>
        {error && (
          <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</Alert>
        )}
        <Button type="button" onClick={submit} disabled={busy || !title.trim()} className="w-full">
          {busy ? "Saving…" : "Add to watchlist"}
        </Button>
      </div>
    </ModalShell>
  );
}

const DISPOSITIONS = ["PROMOTED_TO_SCENARIO", "PROMOTED_TO_RISK", "DISMISSED"] as const;

function ItemDrawer({
  item,
  onClose,
  onDone,
}: {
  item: HorizonItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const [disposition, setDisposition] = useState<string>("PROMOTED_TO_SCENARIO");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disposed = !!item.disposition;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/erm/bcm/horizon/${item.id}/disposition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disposition, note: note.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.detail || j.error || `Failed to set disposition (${res.status}).`);
        setBusy(false);
        return;
      }
      onDone();
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
      setBusy(false);
    }
  }

  return (
    <ModalShell title={item.title} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              "rounded border px-2 py-0.5 text-[11px] font-semibold " +
              (SIGNAL_CHIP[item.signalStrength] ?? "bg-slate-100 text-slate-600 border-slate-200")
            }
          >
            {SIGNAL_LABEL[item.signalStrength] ?? item.signalStrength}
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {CATEGORY_LABEL[item.category] ?? item.category.replace(/_/g, " ")}
          </span>
          {item.reviewOverdue && (
            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
              REVIEW OVERDUE
            </span>
          )}
        </div>

        <p className="text-sm text-slate-700">{item.description || "—"}</p>
        <p className="text-xs text-slate-500">
          Watched by <b>{item.watchedByName ?? "—"}</b> · Review {fmtDate(item.reviewDate)}
        </p>

        {disposed ? (
          <Card className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-none">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Disposition (audit trail)</p>
            <p className="mt-1 text-sm">
              <span
                className={
                  "rounded border px-2 py-0.5 text-[11px] font-medium " +
                  (DISPOSITION_CHIP[item.disposition!] ?? "bg-slate-100 text-slate-600 border-slate-200")
                }
              >
                {DISPOSITION_LABEL[item.disposition!] ?? item.disposition!.replace(/_/g, " ")}
              </span>
            </p>
            {item.promotedEntityId && (
              <p className="mt-2 text-xs text-slate-600">
                Promoted entity: <span className="font-medium">{item.promotedEntityId}</span>
              </p>
            )}
            {item.dispositionNote && <p className="mt-1 text-xs italic text-slate-500">{item.dispositionNote}</p>}
          </Card>
        ) : (
          <Card className="rounded-lg border border-slate-200 p-3 shadow-none">
            <Label className="mb-1.5 block text-xs font-medium text-slate-600">Disposition</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {DISPOSITIONS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="ghost"
                  onClick={() => setDisposition(d)}
                  className={cn(
                    "h-auto rounded-lg border px-2 py-2 text-xs font-medium",
                    disposition === d ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200",
                  )}
                >
                  {DISPOSITION_LABEL[d]}
                </Button>
              ))}
            </div>
            <Label className="mb-1 mt-3 block text-xs font-medium text-slate-600">Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Rationale for the disposition…"
            />
            {error && (
              <Alert variant="destructive" className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </Alert>
            )}
            <Button type="button" onClick={submit} disabled={busy} className="mt-3 w-full">
              {busy ? "Saving…" : "Apply disposition"}
            </Button>
          </Card>
        )}
      </div>
    </ModalShell>
  );
}
