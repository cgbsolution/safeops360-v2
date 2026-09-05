"use client";

// Guided RCA field-input flow (spec 1.3), technician-facing. Steps:
//   0 Context card (photo/summary of the incident, TTS read-aloud)
//   1 Guided 5-Why as a cascading picker from the cause library (fishbone
//     bones as icons → narrow, max 3 levels), optional voice per screen
//   2 "What would prevent this?" — control-library suggestions
//   3 Review & send
// Reuses the capture wizard primitives + Midnight Executive skin.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, Check, ChevronLeft, Globe, ListChecks, ShieldCheck, Volume2 } from "lucide-react";
import { readApiError } from "@/lib/client-errors";
import type { Lang } from "@/lib/capture/i18n";
import { getStoredLang, labelPair, speak, storeLang, t, tPair } from "@/lib/capture/i18n";
import type { TaxNode } from "@/lib/capture/types";
import { taxonomyIcon } from "./icons";
import { BigButton, BiText, MX, ProgressDots, ScreenHeading, Tile, TileGrid } from "./ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type RequestDetail = {
  id: string;
  rcaId: string;
  rcaCode: string | null;
  contextSummary: string;
  hazardCategoryCode: string | null;
  status: string;
  causeLibrary: TaxNode[];
  controlLibrary: TaxNode[];
};

const MAX_CAUSE_DEPTH = 3;

export function RcaFieldFlow({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(() => getStoredLang() ?? "hi");
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<TaxNode[]>([]); // tapped cause chain
  const [controls, setControls] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"flow" | "sending" | "done" | "error">("flow");
  const [sendError, setSendError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/erm/rca/field-requests/${requestId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readApiError(res, "Could not load"));
        const data = (await res.json()) as RequestDetail;
        if (!cancelled) setDetail(data);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load");
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const causesByParent = useMemo(() => {
    const map = new Map<string | null, TaxNode[]>();
    for (const n of detail?.causeLibrary ?? []) {
      const key = n.parentId;
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.sortWeight - b.sortWeight);
    return map;
  }, [detail]);

  const controlTop = useMemo(
    () => (detail?.controlLibrary ?? []).filter((n) => n.level === 1).sort((a, b) => a.sortWeight - b.sortWeight),
    [detail],
  );

  const currentParentId = path.length > 0 ? path[path.length - 1].id : null;
  const currentOptions = causesByParent.get(currentParentId) ?? [];
  const canGoDeeper = path.length < MAX_CAUSE_DEPTH && currentOptions.length > 0;

  function pickLang(next: Lang) {
    storeLang(next);
    setLang(next);
  }

  function pickCause(node: TaxNode) {
    const nextPath = [...path, node];
    setPath(nextPath);
    const children = causesByParent.get(node.id) ?? [];
    if (nextPath.length >= MAX_CAUSE_DEPTH || children.length === 0) {
      setStep(2); // no deeper — move to prevention
    }
  }

  function backOne() {
    setSendError(null);
    if (step === 2) {
      setStep(1);
      return;
    }
    if (step === 1 && path.length > 0) {
      setPath(path.slice(0, -1));
      return;
    }
    if (step > 0) setStep(step - 1);
  }

  async function submit() {
    if (!detail) return;
    setPhase("sending");
    setSendError(null);
    try {
      const res = await fetch(`/api/erm/rca/field-requests/${requestId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymous: false,
          fishboneCategory: path[0]?.fishboneCategory ?? null,
          causePath: path.map((n, i) => ({ level: i + 1, nodeId: n.id, code: n.code, label: n.labels.en })),
          controlSuggestionIds: [...controls],
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, t("failed", lang)));
      setPhase("done");
      speak(t("successBody", lang), lang);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : t("failed", lang));
      setPhase("error");
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <AlertOctagon className="h-12 w-12 text-[#C0392B]" />
        <p className="text-center text-lg text-[#0B1F4D]">{loadError}</p>
        <BigButton primary={t("myReports", lang)} variant="ghost" onClick={() => router.push("/capture")} />
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner size="lg" tone="gold" />
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-white p-6" data-testid="rca-field-done">
        <div className="mx-pop flex h-28 w-28 items-center justify-center rounded-full" style={{ background: MX.green }}>
          <Check className="h-14 w-14 text-white" />
        </div>
        <h1 className="text-center text-2xl font-semibold text-[#2E7D5B]" style={{ fontFamily: "Georgia, serif" }}>
          {t("successTitle", lang)}
        </h1>
        <p className="text-center text-lg text-[#0B1F4D]">{t("successBody", lang)}</p>
        <BigButton primary={t("done", lang)} variant="gold" onClick={() => router.push("/capture")} icon={ListChecks} />
      </div>
    );
  }
  if (phase === "sending") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6">
        <Spinner size="xl" tone="gold" />
        <p className="text-xl font-semibold text-[#0B1F4D]">{t("sending", lang)}</p>
      </div>
    );
  }
  if (phase === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6">
        <AlertOctagon className="h-12 w-12 text-[#C0392B]" />
        <p className="text-center text-lg font-medium text-[#0B1F4D]">{sendError}</p>
        <BigButton primary={t("submit", lang)} variant="gold" onClick={submit} />
        <BigButton primary={t("back", lang)} variant="ghost" onClick={() => setPhase("flow")} />
      </div>
    );
  }

  const whyLabel = lang === "hi" ? "ऐसा क्यों हुआ?" : "Why did it happen?";
  const preventLabel = lang === "hi" ? "इसे कैसे रोकें?" : "What would prevent this?";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <Button variant="ghost"
          type="button"
          aria-label={t("back", lang)}
          onClick={backOne}
          disabled={step === 0} className="flex h-14 w-14 rounded-full bg-[#E8EEF7] text-[#0B1F4D] active:scale-95">
          <ChevronLeft className="h-7 w-7" />
        </Button>
        <ProgressDots total={4} current={step} />
        <Button variant="ghost"
          type="button"
          aria-label={t("chooseLanguage", lang)}
          onClick={() => pickLang(lang === "hi" ? "en" : "hi")} className="flex h-14 w-14 rounded-full bg-[#E8EEF7] text-[#0B1F4D] active:scale-95">
          <Globe className="h-6 w-6" />
        </Button>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-4 pb-8 pt-2">
        {step === 0 && (
          <>
            <ScreenHeading
              primary={lang === "hi" ? "हमें समझने में मदद करें" : "Help us understand"}
              secondary={lang === "hi" ? "Help us understand" : null}
              lang={lang}
            />
            <Card className="rounded-2xl border-2 border-[#D9E1EF] p-5 shadow-none">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A961]">{detail.rcaCode}</p>
              <p className="mt-2 text-lg leading-relaxed text-[#0B1F4D]">{detail.contextSummary}</p>
              <button
                type="button"
                onClick={() => speak(detail.contextSummary, lang)}
                className="mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-[#E8EEF7] text-base font-semibold text-[#0B1F4D] active:scale-[0.98]"
              >
                <Volume2 className="h-5 w-5" /> {t("listen", lang)}
              </button>
            </Card>
            <BigButton primary={t("next", lang)} secondary={tPair("next", lang).secondary} variant="gold" onClick={() => setStep(1)} />
          </>
        )}

        {step === 1 && (
          <>
            <ScreenHeading primary={whyLabel} secondary={lang === "hi" ? "Why did it happen?" : null} lang={lang} />
            {path.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {path.map((n) => (
                  <span key={n.id} className="rounded-full bg-[#0B1F4D] px-2.5 py-1 text-xs font-semibold text-white">
                    {labelPair(n.labels, lang).primary}
                  </span>
                ))}
              </div>
            ) : null}
            <TileGrid>
              {currentOptions.slice(0, 6).map((node) => {
                const lp = labelPair(node.labels, lang);
                return (
                  <Tile
                    key={node.id}
                    icon={taxonomyIcon(node.iconKey)}
                    primary={lp.primary}
                    secondary={lp.secondary}
                    onClick={() => pickCause(node)}
                  />
                );
              })}
            </TileGrid>
            {path.length > 0 ? (
              <BigButton
                primary={lang === "hi" ? "यहीं ठीक है — आगे" : "Good enough — next"}
                variant="ghost"
                onClick={() => setStep(2)}
              />
            ) : null}
            {!canGoDeeper && path.length === 0 ? (
              <p className="text-center text-sm text-[#5A6273]">{t("loading", lang)}</p>
            ) : null}
          </>
        )}

        {step === 2 && (
          <>
            <ScreenHeading primary={preventLabel} secondary={lang === "hi" ? "What would prevent this?" : null} lang={lang} />
            <TileGrid>
              {controlTop.map((node) => {
                const lp = labelPair(node.labels, lang);
                return (
                  <Tile
                    key={node.id}
                    icon={taxonomyIcon(node.iconKey ?? "shield-check")}
                    primary={lp.primary}
                    secondary={lp.secondary}
                    selected={controls.has(node.id)}
                    onClick={() => {
                      setControls((prev) => {
                        const next = new Set(prev);
                        if (next.has(node.id)) next.delete(node.id);
                        else next.add(node.id);
                        return next;
                      });
                    }}
                  />
                );
              })}
            </TileGrid>
            <BigButton
              primary={controls.size > 0 ? t("next", lang) : t("skip", lang)}
              secondary={controls.size > 0 ? tPair("next", lang).secondary : tPair("skip", lang).secondary}
              variant={controls.size > 0 ? "primary" : "ghost"}
              onClick={() => setStep(3)}
            />
          </>
        )}

        {step === 3 && (
          <>
            <ScreenHeading {...tPair("q_review", lang)} lang={lang} />
            <Card className="rounded-2xl border-2 border-[#D9E1EF] p-4 shadow-none">
              <BiText primary={whyLabel} className="items-start text-left" primaryClassName="text-sm text-[#5A6273]" />
              <div className="mt-1 flex flex-wrap gap-1.5">
                {path.map((n) => (
                  <span key={n.id} className="rounded-full bg-[#E8EEF7] px-2.5 py-1 text-sm font-semibold text-[#0B1F4D]">
                    {labelPair(n.labels, lang).primary}
                  </span>
                ))}
              </div>
              {controls.size > 0 ? (
                <>
                  <BiText primary={preventLabel} className="mt-4 items-start text-left" primaryClassName="text-sm text-[#5A6273]" />
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {controlTop
                      .filter((n) => controls.has(n.id))
                      .map((n) => (
                        <span key={n.id} className="flex items-center gap-1 rounded-full bg-[#2E7D5B]/10 px-2.5 py-1 text-sm font-semibold text-[#2E7D5B]">
                          <ShieldCheck className="h-3.5 w-3.5" /> {labelPair(n.labels, lang).primary}
                        </span>
                      ))}
                  </div>
                </>
              ) : null}
            </Card>
            <div className="mt-auto">
              <BigButton
                primary={t("submit", lang)}
                secondary={tPair("submit", lang).secondary}
                variant="gold"
                disabled={path.length === 0}
                onClick={submit}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
