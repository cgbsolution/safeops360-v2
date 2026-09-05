"use client";

// "My Reports" — the technician's own history (incl. their anonymous reports,
// matched server-side via anonHash). Big touch rows, bilingual status chips.
// Slice 2 prepends locally-queued (offline) items to this list.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronLeft, Clock, Mic, Plus } from "lucide-react";
import type { Lang, MsgKey } from "@/lib/capture/i18n";
import { getStoredLang, labelPair, t, tPair } from "@/lib/capture/i18n";
import type { SubmissionOut } from "@/lib/capture/types";
import { captureDb, onOutboxChanged, type OutboxEntry } from "@/lib/capture/db";
import { taxonomyIcon } from "./icons";
import { SyncChip } from "./sync-chip";
import { BigButton, MX } from "./ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const STATUS_KEY: Record<SubmissionOut["status"], MsgKey> = {
  submitted: "status_submitted",
  triaged: "status_triaged",
  converted: "status_converted",
  closed: "status_closed",
  rejected: "status_rejected",
};

const STATUS_COLOR: Record<SubmissionOut["status"], string> = {
  submitted: MX.navy,
  triaged: "#B7791F",
  converted: MX.green,
  closed: "#5A6273",
  rejected: MX.red,
};

export function MyReports() {
  const router = useRouter();
  const [lang] = useState<Lang>(() => getStoredLang() ?? "hi");
  const [items, setItems] = useState<SubmissionOut[] | null>(null);
  const [queued, setQueued] = useState<OutboxEntry[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadQueued = () => {
      captureDb.outbox
        .orderBy("createdAt")
        .reverse()
        .toArray()
        .then((rows) => {
          if (!cancelled) setQueued(rows);
        })
        .catch(() => undefined);
    };
    loadQueued();
    const offOutbox = onOutboxChanged(loadQueued);
    fetch("/api/capture/submissions/mine")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { items: SubmissionOut[] };
        if (!cancelled) setItems(data.items);
      })
      .catch(() => {
        // offline: the queued rows above still render — only flag an error
        // when there is nothing at all to show
        if (!cancelled) setItems([]);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      offOutbox();
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-6 pt-4">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/capture"
          aria-label={t("back", lang)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8EEF7] text-[#0B1F4D] active:scale-95"
        >
          <ChevronLeft className="h-7 w-7" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-[#0B1F4D]" style={{ fontFamily: "Georgia, serif" }}>
            {t("myReports", lang)}
          </h1>
          {lang !== "en" ? <p className="text-xs text-[#5A6273]">{t("myReports", "en")}</p> : null}
        </div>
        <SyncChip />
      </header>

      {items === null && !error ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" tone="gold" />
        </div>
      ) : null}

      {error ? <p className="py-10 text-center text-base text-[#C0392B]">{t("failed", lang)}</p> : null}

      {items !== null && items.length === 0 && queued.length === 0 ? (
        <p className="py-10 text-center text-lg text-[#5A6273]">{t("noReports", lang)}</p>
      ) : null}

      <div className="flex flex-col gap-3">
        {/* locally-queued reports (offline outbox) render first, amber */}
        {queued.map((entry) => {
          const Icon = taxonomyIcon(entry.summary.iconKey);
          const lp = entry.summary.categoryLabels ? labelPair(entry.summary.categoryLabels, lang) : null;
          return (
            <Card
              key={entry.clientSubmissionId}
              className="flex min-h-[72px] items-center gap-3 rounded-2xl border-2 border-dashed border-[#B7791F]/50 bg-[#B7791F]/5 p-3 shadow-none">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#B7791F]/15">
                <Icon className="h-6 w-6 text-[#B7791F]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-[#0B1F4D]">
                  {lp?.primary ?? entry.summary.type.replace("_", " ")}
                </p>
                <p className="text-xs text-[#5A6273]">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
              <Badge className="shrink-0 border-transparent bg-[#B7791F] px-3 py-1.5 text-sm text-white">
                <Clock className="h-4 w-4" />
                {t("status_queued", lang)}
              </Badge>
            </Card>
          );
        })}
        {(items ?? []).map((sub) => {
          const l1 = sub.categorySnapshot?.l1;
          const Icon = taxonomyIcon(l1?.iconKey);
          const lp = l1 ? labelPair(l1.labels, lang) : null;
          const statusKey = STATUS_KEY[sub.status];
          return (
            <Card key={sub.id} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-[#D9E1EF] bg-white p-3 shadow-none">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E8EEF7]">
                <Icon className="h-6 w-6 text-[#0B1F4D]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-[#0B1F4D]">{lp?.primary ?? sub.number}</p>
                <p className="truncate font-mono text-xs text-[#5A6273]">
                  {sub.number}
                  {sub.createdAt ? ` · ${new Date(sub.createdAt).toLocaleDateString()}` : ""}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[#5A6273]">
                  {sub.attachments.some((a) => a.kind === "PHOTO" || a.kind === "VIDEO") ? <Camera className="h-4 w-4" /> : null}
                  {sub.attachments.some((a) => a.kind === "VOICE") ? <Mic className="h-4 w-4" /> : null}
                </div>
              </div>
              <span
                className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-white"
                style={{ background: STATUS_COLOR[sub.status] }}
              >
                {t(statusKey, lang)}
              </span>
            </Card>
          );
        })}
      </div>

      <div className="mt-auto pt-6">
        <BigButton
          primary={t("newReport", lang)}
          secondary={tPair("newReport", lang).secondary}
          variant="gold"
          icon={Plus}
          onClick={() => router.push("/capture")}
        />
      </div>
    </div>
  );
}
