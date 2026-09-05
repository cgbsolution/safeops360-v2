"use client";

// Guided Field Capture wizard — screens 0–6 (spec 1.2), Slice 1 (online path).
// One question per screen; icon tiles; bilingual labels; TTS; zero mandatory
// typing. Tap-count + duration are instrumented per submission (spec 1.1.7 —
// happy path must stay <= 8 taps: type, area, category L1, L2, skip evidence,
// severity, skip voice, submit).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  AlertTriangle,
  Camera,
  Check,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Eye,
  Flame,
  Globe,
  Home,
  Images,
  ListChecks,
  MapPin,
  QrCode,
  ShieldAlert,
  Sparkles,
  Trash2,
  Video,
  Volume2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { readApiError } from "@/lib/client-errors";
import type { Lang, MsgKey } from "@/lib/capture/i18n";
import { getStoredLang, labelPair, speak, storeLang, t, tPair } from "@/lib/capture/i18n";
import { enqueueSubmission, fetchWithBootCache, syncOutbox } from "@/lib/capture/sync";
import { SyncChip } from "./sync-chip";
import type {
  CaptureBootstrap,
  CaptureFireAsset,
  CleanupTextResponse,
  DraftDescriptionResponse,
  SelfSeverity,
  StopCategory,
  StopSubCategory,
  SubmissionOut,
  SubmissionType,
  TaxNode,
  VisionSuggestResponse,
  WizardMedia,
} from "@/lib/capture/types";
import { taxonomyIcon } from "./icons";
import { qrSupported, QrScannerModal } from "./qr-scanner";
import { BigButton, BiText, MX, ProgressDots, ScreenHeading, Tile, TileGrid } from "./ui";
import {
  blobToBase64,
  compressPhoto,
  MAX_FILE_BYTES,
  MAX_VIDEO_SECONDS,
  mediaDuration,
  newClientId,
  uploadMedia,
} from "./upload";
import { VoiceRecorder } from "./voice-recorder";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const APP_VERSION = "capture-1.1.0";
const LAST_TYPE_KEY = "safeops_capture_last_type";

// Each flow renders only the screens it needs (spec §3 — a schema per flow
// type). PTW/FLRA skip the observation-only hazard-category + severity screens
// and show their own field right after location; incident adds an injury step.
type Stage = "type" | "where" | "details" | "category" | "evidence" | "severity" | "describe" | "review";

function stagesFor(t: SubmissionType): Stage[] {
  // The module's OWN screen ("details") comes first after the type is picked —
  // so tapping a different report type immediately shows a different screen,
  // not the shared "Where" screen. Every flow has its own details screen.
  if (t === "ptw" || t === "flra") return ["type", "details", "where", "evidence", "describe", "review"];
  if (t === "incident") return ["type", "details", "where", "category", "evidence", "severity", "describe", "review"];
  return ["type", "details", "where", "category", "evidence", "severity", "describe", "review"];
}

// Short, flow-aware label for each stage — powers the step breadcrumb so the
// sequence is verifiable at a glance (the "details" step is named per flow).
function stageLabel(s: Stage, t: SubmissionType, lang: Lang): string {
  const L = (en: string, hi: string) => (lang === "hi" ? hi : en);
  switch (s) {
    case "type": return L("Type", "प्रकार");
    case "details":
      return t === "ptw" ? L("Permit", "परमिट")
        : t === "flra" ? L("Hazards", "खतरे")
        : t === "incident" ? L("Injury", "चोट")
        : t === "near_miss" ? L("Outcome", "नतीजा")
        : t === "unsafe_condition" ? L("Since", "कब से")
        : L("Kind", "तरह");
    case "where": return L("Where", "कहाँ");
    case "category": return L("Category", "श्रेणी");
    case "evidence": return L("Photo", "फोटो");
    case "severity": return L("Serious", "कितना");
    case "describe": return L("Describe", "बताएँ");
    case "review": return L("Check", "जाँच");
  }
}

const TYPE_TILES: { type: SubmissionType; icon: typeof Eye; key: MsgKey; danger?: boolean }[] = [
  { type: "observation", icon: Eye, key: "type_observation" },
  { type: "near_miss", icon: Zap, key: "type_near_miss" },
  { type: "unsafe_condition", icon: ShieldAlert, key: "type_unsafe_condition" },
  { type: "incident", icon: AlertOctagon, key: "type_incident", danger: true },
  { type: "ptw", icon: ClipboardCheck, key: "type_ptw" },
  { type: "flra", icon: ClipboardList, key: "type_flra" },
];

// Guided "help me write" questions — short, universal, all optional. Sent to
// the AI (labels in English for a stable prompt) with the wizard's category /
// location / severity context; the AI returns a fact-only description in the
// reporter's language for accept/edit (never auto-applied).
const GUIDED_QS: { key: string; msgKey: MsgKey }[] = [
  { key: "what", msgKey: "guided_what" },
  { key: "risk", msgKey: "guided_risk" },
  { key: "action", msgKey: "guided_action" },
];

function readLastType(): SubmissionType | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(LAST_TYPE_KEY);
  return TYPE_TILES.some((tt) => tt.type === v) ? (v as SubmissionType) : null;
}

// ── Per-flow field-delta options (spec §6) ──────────────────────────────────
// Bilingual at data level, kept inline like the flow tiles. `en` doubles as the
// stable value folded into the report description for the officer.
type Opt = { code: string; en: string; hi: string };

const PERMIT_OPTS: Opt[] = [
  { code: "hot_work", en: "Hot work", hi: "गर्म काम (वेल्डिंग/कटिंग)" },
  { code: "confined_space", en: "Confined space", hi: "बंद जगह" },
  { code: "work_at_height", en: "Work at height", hi: "ऊँचाई पर काम" },
  { code: "excavation", en: "Excavation", hi: "खुदाई" },
  { code: "electrical_loto", en: "Electrical / LOTO", hi: "बिजली / LOTO" },
  { code: "general_cold", en: "General work", hi: "सामान्य काम" },
];

const HAZARD_OPTS: Opt[] = [
  { code: "height", en: "Working at height", hi: "ऊँचाई" },
  { code: "electrical", en: "Electrical", hi: "बिजली" },
  { code: "moving_machine", en: "Moving machinery", hi: "चलती मशीन" },
  { code: "hot_work", en: "Fire / hot work", hi: "आग / गर्मी" },
  { code: "chemical", en: "Chemical", hi: "केमिकल" },
  { code: "manual_handling", en: "Lifting / manual", hi: "भार उठाना" },
  { code: "slips_trips", en: "Slip / trip", hi: "फिसलन" },
  { code: "confined_space", en: "Confined space", hi: "बंद जगह" },
];

const CONTROL_OPTS: Opt[] = [
  { code: "ppe", en: "PPE", hi: "PPE (सुरक्षा गियर)" },
  { code: "isolation", en: "Isolation / LOTO", hi: "आइसोलेशन / LOTO" },
  { code: "barricade", en: "Barricading", hi: "बैरिकेडिंग" },
  { code: "permit", en: "Permit taken", hi: "परमिट लिया" },
  { code: "supervision", en: "Supervision", hi: "निगरानी" },
  { code: "harness", en: "Harness / anchor", hi: "हार्नेस" },
  { code: "ventilation", en: "Ventilation", hi: "हवा/वेंटिलेशन" },
];

// Near-miss — "what could have happened?" (distinct from an observation).
const NM_OUTCOME_OPTS: Opt[] = [
  { code: "injury", en: "Someone could be hurt", hi: "किसी को चोट लग सकती थी" },
  { code: "fire", en: "Fire / explosion", hi: "आग / धमाका" },
  { code: "property", en: "Property damage", hi: "सामान का नुकसान" },
  { code: "spill", en: "Spill / leak", hi: "रिसाव" },
  { code: "other", en: "Something else", hi: "कुछ और" },
];

// Unsafe condition — "how long has it been like this?"
const UC_DURATION_OPTS: Opt[] = [
  { code: "now", en: "Just noticed", hi: "अभी देखा" },
  { code: "today", en: "Since today", hi: "आज से" },
  { code: "days", en: "A few days", hi: "कुछ दिनों से" },
  { code: "long", en: "A long time", hi: "बहुत समय से" },
];

function optLabel(opts: Opt[], code: string, lang: Lang): string {
  const o = opts.find((x) => x.code === code);
  return o ? (lang === "hi" ? o.hi : o.en) : code;
}

function Chip({ label, selected, onClick, testId }: { label: string; selected: boolean; onClick: () => void; testId?: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      onClick={onClick}
      className={
        selected
          ? "min-h-[44px] rounded-full border-2 border-[#0B1F4D] bg-[#0B1F4D] px-4 py-2 text-sm font-semibold text-white active:scale-95"
          : "min-h-[44px] rounded-full border-2 border-[#D9E1EF] bg-white px-4 py-2 text-sm font-semibold text-[#0B1F4D] active:scale-95"
      }
    >
      {label}
    </button>
  );
}

type Phase = "boot" | "wizard" | "submitting" | "success" | "queued" | "error";

export function CaptureWizard({
  // Set when the wizard was entered FROM a fire asset rather than by scanning
  // inside it — the "log a finding" path off a fire sticker. The wizard treats
  // it identically to an in-wizard scan, so the asset context arrives the same
  // way regardless of which door the reporter came through.
  initialFireAssetId = null,
}: {
  initialFireAssetId?: string | null;
} = {}) {
  const router = useRouter();

  // ── language (persisted per device; picker on first launch) ──
  const [lang, setLang] = useState<Lang | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);
  useEffect(() => {
    const stored = getStoredLang();
    if (stored) setLang(stored);
    else setShowLangPicker(true);
  }, []);

  // ── bootstrap + taxonomy ──
  const [boot, setBoot] = useState<CaptureBootstrap | null>(null);
  const [hazards, setHazards] = useState<TaxNode[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // network-first with IndexedDB fallback — the wizard must render with
        // zero connectivity once it has booted once (spec 1.4)
        const [bootJson, taxJson] = await Promise.all([
          fetchWithBootCache<CaptureBootstrap>("/api/capture/bootstrap", "bootstrap"),
          fetchWithBootCache<{ version: number; items: TaxNode[] }>(
            "/api/capture/taxonomy?kind=HAZARD",
            "taxonomy:HAZARD",
          ),
        ]);
        if (cancelled) return;
        setBoot(bootJson);
        setHazards(taxJson.items);
      } catch (e) {
        if (!cancelled) setBootError(e instanceof Error ? e.message : "Could not load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── wizard state ──
  const [phase, setPhase] = useState<Phase>("boot");
  const [step, setStep] = useState(0);
  const [type, setType] = useState<SubmissionType>("observation");
  const [anonymous, setAnonymous] = useState(false);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);
  // A scanned fire-register asset. Held separately from `equipmentId` all the
  // way through: FireEquipment and Equipment are different tables, and the id
  // must reach the server in the field that will actually resolve it.
  const [fireAssetId, setFireAssetId] = useState<string | null>(null);
  const [fireAsset, setFireAsset] = useState<CaptureFireAsset | null>(null);
  // A sticker that resolves to nothing is said out loud here rather than
  // dropped. Before this, the wizard advanced as though the scan had worked and
  // the reporter filed a fire finding against no asset at all.
  const [fireAssetError, setFireAssetError] = useState<string | null>(null);
  const [fireAssetLoading, setFireAssetLoading] = useState(false);
  const [qrUsed, setQrUsed] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [l1, setL1] = useState<TaxNode | null>(null);
  const [l2, setL2] = useState<TaxNode | null>(null);
  const [showAllL1, setShowAllL1] = useState(false);
  // ── DuPont STOP taxonomy (the flows that become an Observation) ──
  // Kept separate from the l1/l2 hazard nodes: these come from a different
  // master (ObservationTaxonomy) and are scoped to the act/condition axis, so
  // the Category tiles differ by what the reporter picked on the Kind step.
  const [stopCats, setStopCats] = useState<StopCategory[]>([]);
  const [stopSubs, setStopSubs] = useState<StopSubCategory[]>([]);
  const [stopCat, setStopCat] = useState<StopCategory | null>(null);
  const [stopSub, setStopSub] = useState<StopSubCategory | null>(null);
  const [stopLoading, setStopLoading] = useState(false);
  const [media, setMedia] = useState<WizardMedia[]>([]);
  const [severity, setSeverity] = useState<SelfSeverity | null>(null);
  const [voiceNote, setVoiceNote] = useState<WizardMedia | null>(null);
  const [deviceTranscript, setDeviceTranscript] = useState<string | null>(null);
  // primary description (spec §6 — keyboard + voice on one field); seeded from
  // the voice transcript so the tech can edit/tidy it.
  const [typedDescription, setTypedDescription] = useState("");
  // per-flow field-deltas (spec §6) — each flow renders its own set on the
  // "details" screen (the first screen after picking the report type).
  const [obsKind, setObsKind] = useState<"unsafe_act" | "unsafe_condition" | null>(null); // observation
  const [nmOutcome, setNmOutcome] = useState<string | null>(null); // near-miss: what could have happened
  const [ucDuration, setUcDuration] = useState<string | null>(null); // unsafe condition: how long
  const [injury, setInjury] = useState<boolean | null>(null);
  const [medicalAttention, setMedicalAttention] = useState<boolean | null>(null);
  const [permitType, setPermitType] = useState<string | null>(null);
  const [flraHazards, setFlraHazards] = useState<string[]>([]);
  const [flraControls, setFlraControls] = useState<string[]>([]);
  const [immediateAction, setImmediateAction] = useState(""); // observation / near-miss / incident
  // AI grammar cleanup (spec §7a): holds {original, cleaned} until accept/reject
  const [cleanup, setCleanup] = useState<{ original: string; cleaned: string } | null>(null);
  const [cleaning, setCleaning] = useState(false);
  // AI guided draft (spec §7c): a few guided questions → a fact-only drafted
  // description the reporter accepts/edits (accept-never-silent, like cleanup).
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<{ description: string } | null>(null);
  const [result, setResult] = useState<SubmissionOut | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitStage, setSubmitStage] = useState<"sending" | "media">("sending");

  const tapCount = useRef(0);
  const startedAt = useRef<number>(Date.now());
  const clientSubmissionId = useRef<string>(newClientId());

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // AI vision-suggest (feature-flagged) — confirm card after a photo
  const [aiSuggestion, setAiSuggestion] = useState<VisionSuggestResponse | null>(null);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiAccepted, setAiAccepted] = useState(false);

  useEffect(() => {
    if (boot && hazards.length > 0 && phase === "boot") setPhase("wizard");
  }, [boot, hazards, phase]);

  // ── STOP axis: which act/condition list the Category tiles must show ──
  // Mirrors services/capture.capture_axis. `observation` only resolves once the
  // Kind step is answered — that binding is the whole point. `unsafe_condition`
  // is its own top-level flow and is a condition by definition. Everything else
  // (near-miss, incident, PTW, FLRA) keeps the CaptureTaxonomy hazard tiles.
  const stopAxis: "ACT" | "CONDITION" | null = useMemo(() => {
    if (type === "unsafe_condition") return "CONDITION";
    if (type !== "observation" || !obsKind) return null;
    return obsKind === "unsafe_condition" ? "CONDITION" : "ACT";
  }, [type, obsKind]);
  const usesStop = stopAxis !== null;

  // Categories for the axis. Offline-first like the hazard taxonomy, and cached
  // per axis — a single shared cache key would serve the ACT list to a
  // Condition report, which is exactly the bug being fixed.
  useEffect(() => {
    if (!stopAxis) {
      setStopCats([]);
      return;
    }
    let cancelled = false;
    setStopLoading(true);
    fetchWithBootCache<{ items: StopCategory[] }>(
      `/api/observation-taxonomy/categories?type=${stopAxis}`,
      `observation-taxonomy:categories:${stopAxis}`,
    )
      .then((json) => {
        if (!cancelled) setStopCats(json.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setStopCats([]);
      })
      .finally(() => {
        if (!cancelled) setStopLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stopAxis]);

  // Switching Act ↔ Condition mid-entry drops a category that isn't offered on
  // the new axis (Reactions / Positions of People under Condition) instead of
  // leaving it silently attached.
  useEffect(() => {
    if (!stopAxis || stopCats.length === 0 || !stopCat) return;
    if (!stopCats.some((c) => c.categoryCode === stopCat.categoryCode)) {
      setStopCat(null);
      setStopSub(null);
    }
  }, [stopAxis, stopCats, stopCat]);

  // Sub-categories: only once both the axis and a category are settled.
  useEffect(() => {
    if (!stopAxis || !stopCat) {
      setStopSubs([]);
      return;
    }
    let cancelled = false;
    setStopLoading(true);
    fetchWithBootCache<{ items: StopSubCategory[] }>(
      `/api/observation-taxonomy/subcategories?type=${stopAxis}&category=${encodeURIComponent(stopCat.categoryCode)}`,
      `observation-taxonomy:subcategories:${stopAxis}:${stopCat.categoryCode}`,
    )
      .then((json) => {
        if (!cancelled) setStopSubs(json.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setStopSubs([]);
      })
      .finally(() => {
        if (!cancelled) setStopLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stopAxis, stopCat]);

  const l1Nodes = useMemo(
    () => hazards.filter((n) => n.level === 1).sort((a, b) => a.sortWeight - b.sortWeight),
    [hazards],
  );
  const l2Nodes = useMemo(
    () =>
      l1
        ? hazards.filter((n) => n.parentId === l1.id).sort((a, b) => a.sortWeight - b.sortWeight)
        : [],
    [hazards, l1],
  );
  const knownAreaIds = useMemo(() => new Set((boot?.areas ?? []).map((a) => a.id)), [boot]);

  // Per-flow screen sequence (spec §3) — drives which screens render, the
  // progress dots, and back navigation. `step` is now an index into `stages`.
  const stages = useMemo(() => stagesFor(type), [type]);
  const stage: Stage = stages[Math.min(step, stages.length - 1)];
  function goNext() {
    setStep((i) => Math.min(i + 1, stages.length - 1));
  }

  // recently-used flow type surfaces first (spec screen 2)
  const [lastType, setLastType] = useState<SubmissionType | null>(null);
  useEffect(() => {
    setLastType(readLastType());
  }, []);
  const typeTiles = useMemo(() => {
    if (!lastType) return TYPE_TILES;
    const idx = TYPE_TILES.findIndex((tt) => tt.type === lastType);
    if (idx <= 0) return TYPE_TILES;
    const copy = [...TYPE_TILES];
    const [used] = copy.splice(idx, 1);
    return [used, ...copy];
  }, [lastType]);

  // Context Banner (spec screen 1): area + asset, resolved on-device from the
  // cached bootstrap so it works offline. Falls back to the equipment code,
  // then hides the asset segment if the token is unknown to this plant.
  const areaName = useMemo(
    () => boot?.areas.find((a) => a.id === areaId)?.name ?? null,
    [boot, areaId],
  );
  const assetName = useMemo(() => {
    if (!equipmentId) return null;
    const e = boot?.equipment?.find((x) => x.id === equipmentId);
    return e?.name ?? e?.code ?? null;
  }, [boot, equipmentId]);
  // The fire asset reads as its stencilled tag where there is one — that is the
  // number the reporter can check against the cylinder in front of them, and
  // the platform's own code means nothing to them.
  const fireAssetName = useMemo(() => {
    if (!fireAsset) return fireAssetId ? "Fire asset" : null;
    return fireAsset.allottedSerialNo
      ? `${fireAsset.code} (${fireAsset.allottedSerialNo})`
      : fireAsset.code;
  }, [fireAsset, fireAssetId]);

  // Resolve a scanned fire sticker to the asset it names.
  //
  // Cache first, network second — deliberately that order. The bootstrap ships
  // a plant-scoped fire asset directory precisely so a scan in a corridor with
  // no signal still names the cylinder; the fetch is the fallback for a sticker
  // printed since the cache was built.
  //
  // Returns the asset, or null having set the error. It never resolves
  // silently to nothing: an unresolvable sticker is the reporter's decision to
  // make (rescan, or file without the link), not something to swallow.
  const resolveFireAsset = useCallback(
    async (value: string, { byToken }: { byToken: boolean }): Promise<CaptureFireAsset | null> => {
      // Cache first, network second — deliberately that order, and the reason
      // the bootstrap ships qrToken at all: a sticker is scanned in a corridor,
      // which is where signal is worst.
      const cached = boot?.fireAssets?.find((a) =>
        byToken ? a.qrToken === value : a.id === value,
      );
      if (cached) return cached;
      setFireAssetLoading(true);
      try {
        const path = byToken
          ? `/api/capture/fire-asset/by-token/${encodeURIComponent(value)}`
          : `/api/capture/fire-asset/${encodeURIComponent(value)}`;
        const res = await fetch(path);
        if (!res.ok) return null;
        return (await res.json()) as CaptureFireAsset;
      } catch {
        // Offline AND not in the cache. The id is still carried — the server
        // resolves and snapshots it on sync, and rejects it there if it never
        // resolves. Losing the link here would be the old silent drop.
        return null;
      } finally {
        setFireAssetLoading(false);
      }
    },
    [boot],
  );

  // One entry point for both doors into a fire-asset report: the in-wizard
  // scanner, and arrival from the fire scan route with `?fireAsset=<id>`.
  const applyFireAsset = useCallback(
    async (value: string, { advance, byToken }: { advance: boolean; byToken: boolean }) => {
      setFireAssetError(null);
      // Only an ID may be set optimistically. A scanned TOKEN is not an asset
      // id, and putting one in `fireAssetId` would hand the server a value it
      // would reject on submit — so the id is set from the resolved asset below.
      setFireAssetId(byToken ? null : value);
      setQrUsed(true);
      const asset = await resolveFireAsset(value, { byToken });
      if (asset) {
        setFireAssetId(asset.id);
        setFireAsset(asset);
        // The sticker knows where it is; the reporter should not have to say so
        // again. Pre-filling the area is the point of scanning the thing.
        if (asset.location && !areaId) {
          const match = boot?.areas.find(
            (a) => a.name.toLowerCase() === asset.location?.toLowerCase(),
          );
          if (match) setAreaId(match.id);
        }
        if (advance) goNext();
        return;
      }
      // Unresolved. Online this means the sticker is genuinely not in this
      // site's register, and the reporter is told so and given both choices.
      // Offline it means only that the cache predates the asset — the id is
      // kept and the server has the last word on sync.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        // Offline and not in the cache. An ID can still travel — the server
        // resolves and snapshots it on sync. A TOKEN cannot: `location.fireAssetId`
        // must carry an asset id, and sending a token there would be rejected
        // at sync with the report already written. So the scan is reported as
        // unresolved and the reporter decides, rather than filing something
        // that will fail hours later with nobody watching.
        if (!byToken) {
          if (advance) goNext();
          return;
        }
        setFireAssetId(null);
        setFireAsset(null);
        setFireAssetError(t("fireAssetOffline", lang ?? "en"));
        return;
      }
      setFireAssetId(null);
      setFireAsset(null);
      setFireAssetError(t("fireAssetUnknown", lang ?? "en"));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goNext is defined below and stable per render
    [resolveFireAsset, boot, areaId, lang],
  );

  // Entry by `?fireAsset=<id>`: same handling as a scan, minus the advance —
  // the reporter still has to say what kind of report this is.
  const fireAssetBootstrapped = useRef(false);
  useEffect(() => {
    if (!initialFireAssetId || !boot || fireAssetBootstrapped.current) return;
    fireAssetBootstrapped.current = true;
    void applyFireAsset(initialFireAssetId, { advance: false, byToken: false });
  }, [initialFireAssetId, boot, applyFireAsset]);

  const countTap = useCallback(() => {
    tapCount.current += 1;
  }, []);

  function pickLang(next: Lang) {
    storeLang(next);
    setLang(next);
    setShowLangPicker(false);
  }

  function back() {
    setMediaError(null);
    if (step === 0) {
      // first screen — exit the capture flow back to the dashboard
      router.push("/dashboard");
      return;
    }
    if (stage === "category" && usesStop && stopCat) {
      // inside STOP sub-category → back to the category list
      setStopCat(null);
      setStopSub(null);
      return;
    }
    if (stage === "category" && !usesStop && l1) {
      // inside category level 2 → back to level 1
      setL1(null);
      setL2(null);
      return;
    }
    setStep(step - 1);
  }

  // ── media pickers ──
  // allowAi=false for the 2nd+ file of a multi-select so we don't fire the
  // vision-suggest once per picked photo.
  async function onPhotoPicked(file: File | null, allowAi = true) {
    if (!file) return;
    setMediaError(null);
    if (file.size > MAX_FILE_BYTES) {
      setMediaError(t("fileTooBig", lang ?? "hi"));
      return;
    }
    const blob = await compressPhoto(file);
    const item: WizardMedia = {
      clientMediaId: newClientId(),
      kind: "PHOTO",
      blob,
      fileName: file.name || "photo.jpg",
      mimeType: blob.type || file.type || "image/jpeg",
      previewUrl: URL.createObjectURL(blob),
    };
    setMedia((m) => [...m, item]);
    // AI assist: only when enabled, online, and no category chosen yet
    // (whichever taxonomy this flow is classifying against).
    if (allowAi && boot?.features.aiCaptureAssist && !l1 && !stopCat && navigator.onLine && lang) {
      void runVisionSuggest(blob, lang);
    }
  }

  async function runVisionSuggest(blob: Blob, currentLang: Lang) {
    setAiChecking(true);
    setAiSuggestion(null);
    try {
      const imageB64 = await blobToBase64(blob);
      const res = await fetch("/api/capture/ai/vision-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageB64, mimeType: blob.type || "image/jpeg", lang: currentLang }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as VisionSuggestResponse;
      if (data.ok && data.l1) {
        setAiSuggestion(data);
        // read the draft aloud (spec: description read aloud via TTS)
        speak(`${labelPair(data.l1.labels, currentLang).primary}. ${data.description}`, currentLang);
      }
    } catch {
      /* AI is best-effort — silence means manual selection */
    } finally {
      setAiChecking(false);
    }
  }

  /** The STOP rendering of the current photo suggestion, for the axis in play.
   *  Null on hazard-tree flows, and when the server couldn't resolve one. */
  const aiStopSuggestion = useMemo(
    () => (usesStop && stopAxis ? (aiSuggestion?.stop?.[stopAxis] ?? null) : null),
    [usesStop, stopAxis, aiSuggestion],
  );

  function acceptAiSuggestion() {
    // STOP flows apply the server-resolved STOP pair; the hazard l1/l2 the
    // model actually returned isn't the taxonomy these flows classify against,
    // so setting it would look accepted but change nothing on the tiles.
    if (usesStop) {
      if (!aiStopSuggestion) return;
      setStopCat({
        categoryCode: aiStopSuggestion.categoryCode,
        categoryLabel: aiStopSuggestion.categoryLabel,
        stopReferenceCode: aiStopSuggestion.stopReferenceCode,
      });
      setStopSub({
        subCategoryCode: aiStopSuggestion.subCategoryCode,
        subCategoryLabel: aiStopSuggestion.subCategoryLabel,
        categoryCode: aiStopSuggestion.categoryCode,
        stopReferenceCode: aiStopSuggestion.stopReferenceCode,
      });
      setAiAccepted(true);
      setAiSuggestion(null);
      return;
    }
    if (!aiSuggestion?.l1) return;
    const l1Node: TaxNode = { ...aiSuggestion.l1, kind: "HAZARD", level: 1, parentId: null, fishboneCategory: null, sortWeight: 0 };
    setL1(l1Node);
    if (aiSuggestion.l2) {
      setL2({ ...aiSuggestion.l2, kind: "HAZARD", level: 2, parentId: l1Node.id, fishboneCategory: null, sortWeight: 0 });
    }
    setAiAccepted(true);
    setAiSuggestion(null);
  }

  async function onVideoPicked(file: File | null) {
    if (!file) return;
    setMediaError(null);
    if (file.size > MAX_FILE_BYTES) {
      setMediaError(t("fileTooBig", lang ?? "hi"));
      return;
    }
    const duration = await mediaDuration(file);
    if (duration !== null && duration > MAX_VIDEO_SECONDS + 2) {
      setMediaError(t("videoTooLong", lang ?? "hi"));
      return;
    }
    const item: WizardMedia = {
      clientMediaId: newClientId(),
      kind: "VIDEO",
      blob: file,
      fileName: file.name || "video.mp4",
      mimeType: file.type || "video/mp4",
      durationSec: duration ?? undefined,
    };
    setMedia((m) => [...m, item]);
  }

  // ── AI grammar cleanup (spec §7a — show both, tech must accept) ──
  async function runCleanup() {
    const text = typedDescription.trim();
    if (!lang || text.length < 3) return;
    setCleaning(true);
    setCleanup(null);
    try {
      const res = await fetch("/api/capture/ai/cleanup-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as CleanupTextResponse;
      const cleaned = data.cleaned?.trim();
      // only surface a real change — an identical "cleanup" is noise
      if (data.ok && cleaned && cleaned !== text) {
        setCleanup({ original: text, cleaned });
        speak(cleaned, lang);
      }
    } catch {
      /* AI is best-effort — silence keeps the original text */
    } finally {
      setCleaning(false);
    }
  }

  function acceptCleanup() {
    if (!cleanup) return;
    setTypedDescription(cleanup.cleaned);
    setCleanup(null);
  }

  // ── AI guided draft: guided answers → drafted description (spec §7c) ──
  async function runDraft() {
    if (!lang) return;
    const filled = GUIDED_QS
      .map((q) => ({ q: t(q.msgKey, "en"), a: (answers[q.key] ?? "").trim() }))
      .filter((x) => x.a.length > 0);
    if (filled.length === 0) return;
    setDrafting(true);
    setDraft(null);
    try {
      const res = await fetch("/api/capture/ai/draft-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: type,
          lang,
          categoryLabel: usesStop
            ? stopCat
              ? `${stopCat.categoryLabel}${stopSub ? " — " + stopSub.subCategoryLabel : ""}`
              : null
            : l1
              ? `${labelPair(l1.labels, "en").primary}${l2 ? " — " + labelPair(l2.labels, "en").primary : ""}`
              : null,
          location: [areaName, assetName].filter(Boolean).join(" · ") || null,
          severity: severity ?? null,
          answers: filled,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as DraftDescriptionResponse;
      if (data.ok && data.description) {
        setDraft({ description: data.description });
        speak(data.description, lang);
      }
    } catch {
      /* AI is best-effort — silence just means keep typing */
    } finally {
      setDrafting(false);
    }
  }

  function acceptDraft() {
    if (!draft) return;
    setTypedDescription(draft.description);
    setDraft(null);
    setGuidedOpen(false);
    setAnswers({});
    setCleanup(null);
  }

  // Fold the per-flow deltas into the description (English — stable for the
  // officer/record, mirrors the backend synth_description). No DB change; the
  // officer reads these and re-enters PTW/FLRA specifics at convert.
  function flowSummary(): string {
    const parts: string[] = [];
    if (type === "observation" && obsKind) {
      parts.push(`Type: ${obsKind === "unsafe_act" ? "Unsafe act" : "Unsafe condition"}`);
    }
    // STOP classification reads as a fact in the narrative too — the hazard
    // l1/l2 labels this used to rely on aren't collected on these flows.
    if (usesStop && stopCat) {
      parts.push(
        `Category: ${stopCat.categoryLabel} (${stopCat.stopReferenceCode})` +
          (stopSub ? ` — ${stopSub.subCategoryLabel}` : ""),
      );
    }
    if (type === "near_miss" && nmOutcome) {
      parts.push(`Could have caused: ${NM_OUTCOME_OPTS.find((o) => o.code === nmOutcome)?.en ?? nmOutcome}`);
    }
    if (type === "unsafe_condition" && ucDuration) {
      parts.push(`Existing for: ${UC_DURATION_OPTS.find((o) => o.code === ucDuration)?.en ?? ucDuration}`);
    }
    if (type === "incident" && injury !== null) {
      parts.push(injury ? (medicalAttention ? "Injury: yes (medical attention needed)" : "Injury: yes") : "Injury: no");
    }
    if (type === "ptw" && permitType) {
      parts.push(`Permit type: ${PERMIT_OPTS.find((p) => p.code === permitType)?.en ?? permitType}`);
    }
    if (type === "flra") {
      if (flraHazards.length) parts.push(`Hazards: ${flraHazards.map((h) => HAZARD_OPTS.find((o) => o.code === h)?.en ?? h).join(", ")}`);
      if (flraControls.length) parts.push(`Controls: ${flraControls.map((c) => CONTROL_OPTS.find((o) => o.code === c)?.en ?? c).join(", ")}`);
    }
    if ((type === "observation" || type === "near_miss" || type === "incident") && immediateAction.trim()) {
      parts.push(`Action taken: ${immediateAction.trim()}`);
    }
    return parts.join(". ");
  }

  function composedDescription(): string {
    const summary = flowSummary();
    const body = typedDescription.trim();
    return [summary, body].filter(Boolean).join(summary && body ? " — " : "");
  }

  // ── submit ──
  function buildPayload(offline: boolean): Record<string, unknown> {
    return {
      clientSubmissionId: clientSubmissionId.current,
      type,
      plantId: boot?.plant?.id,
      anonymous,
      // fireAssetId travels in its own field, never folded into equipmentId —
      // the server resolves each against a different table and snapshots the
      // fire asset onto the report.
      location: { areaId, equipmentId, fireAssetId, qrScanned: qrUsed },
      // STOP-classified flows send codes from ObservationTaxonomy; everything
      // else keeps sending CaptureTaxonomy hazard ids. The two never mix — the
      // server snapshots whichever arrives.
      category: usesStop
        ? stopCat && stopSub
          ? { stopCategoryCode: stopCat.categoryCode, stopSubCategoryCode: stopSub.subCategoryCode }
          : null
        : l1
          ? { l1Id: l1.id, l1Code: l1.code, l2Id: l2?.id ?? null, l2Code: l2?.code ?? null, aiSuggested: aiAccepted }
          : null,
      // The act/condition answer itself, so conversion no longer has to guess
      // it from `type` (which is "observation" for both kinds).
      observationKind: type === "observation" ? obsKind : null,
      severity: severity ?? "medium",
      description: composedDescription() || null,
      voice: voiceNote
        ? { langCode: lang, clientMediaId: voiceNote.clientMediaId, transcriptOriginal: deviceTranscript }
        : null,
      capture: {
        tapCount: tapCount.current,
        durationMs: Date.now() - startedAt.current,
        offline,
        appVersion: APP_VERSION,
        deviceLang: lang,
      },
      createdAtClient: new Date().toISOString(),
      taxonomyVersion: boot?.taxonomyVersion,
    };
  }

  // Every flow (including Observation) creates a CaptureSubmission staging
  // report that a safety officer triages on the 5×5 and converts into the real
  // module record — one consistent path for all report types.
  async function submit() {
    if (!boot?.plant || !lang) return;
    setPhase("submitting");
    setSubmitStage("sending");
    setSubmitError(null);
    const allMedia = voiceNote ? [...media, voiceNote] : media;
    try {
      const res = await fetch("/api/capture/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(false)),
      });
      if (!res.ok) throw new Error(await readApiError(res, t("failed", lang)));
      const created = (await res.json()) as SubmissionOut;

      if (allMedia.length > 0) {
        setSubmitStage("media");
        for (const item of allMedia) {
          await uploadMedia(created.id, item); // non-fatal on failure
        }
      }
      setResult(created);
      setPhase("success");
      speak(`${t("successTitle", lang)} ${created.number}. ${t("successBody", lang)}`, lang);
    } catch (e) {
      // network unreachable (fetch throws TypeError) → outbox; a server
      // rejection (HTTP error) stays a real error the user can retry
      if (e instanceof TypeError) {
        try {
          await enqueueSubmission(buildPayload(true), allMedia, {
            type,
            // The outbox card shows what was classified; on STOP flows that's
            // the STOP category, since no hazard node was ever picked.
            categoryLabels: usesStop
              ? stopCat
                ? { en: stopCat.categoryLabel }
                : null
              : (l1?.labels ?? null),
            iconKey: usesStop ? null : (l1?.iconKey ?? null),
            severity: severity ?? "medium",
          });
          setPhase("queued");
          speak(t("offlineSaved", lang), lang);
          void syncOutbox(); // in case connectivity is flapping
          return;
        } catch {
          /* IndexedDB unavailable — fall through to the error screen */
        }
      }
      setSubmitError(e instanceof Error ? e.message : t("failed", lang));
      setPhase("error");
    }
  }

  // "Submit Another" retains the location + asset context and skips re-scanning
  // the QR (spec §5 — three guarding issues on one walk of the same area).
  function resetForAnother(keepLocation = false) {
    setPhase("wizard");
    setStep(0);
    setType("observation");
    setAnonymous(false);
    if (!keepLocation) {
      setAreaId(null);
      setEquipmentId(null);
      setFireAssetId(null);
      setFireAsset(null);
      setQrUsed(false);
    }
    // Cleared either way: an error about the last scan must not survive onto a
    // report that is not using it. "Submit Another" keeping the asset (the
    // three-findings-on-one-cylinder case) keeps a RESOLVED asset, never a
    // failed one.
    setFireAssetError(null);
    setL1(null);
    setL2(null);
    setMedia([]);
    setAiSuggestion(null);
    setAiAccepted(false);
    setSeverity(null);
    setVoiceNote(null);
    setDeviceTranscript(null);
    setTypedDescription("");
    setObsKind(null);
    setStopCat(null);
    setStopSub(null);
    setNmOutcome(null);
    setUcDuration(null);
    setInjury(null);
    setMedicalAttention(null);
    setPermitType(null);
    setFlraHazards([]);
    setFlraControls([]);
    setImmediateAction("");
    setCleanup(null);
    setGuidedOpen(false);
    setAnswers({});
    setDraft(null);
    setResult(null);
    tapCount.current = 0;
    startedAt.current = Date.now();
    clientSubmissionId.current = newClientId();
  }

  // ── overlays ──
  if (showLangPicker || !lang) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-[#0B1F4D] p-6">
        <Globe className="h-14 w-14 text-[#C9A961]" />
        <h1 className="text-center text-2xl font-semibold text-white" style={{ fontFamily: "Georgia, serif" }}>
          अपनी भाषा चुनें
          <span className="mt-1 block text-base font-normal text-white/60">Choose your language</span>
        </h1>
        <div className="flex w-full max-w-sm flex-col gap-4">
          <BigButton primary="हिंदी" secondary="Hindi" variant="gold" onClick={() => pickLang("hi")} testId="btn-lang-hi" />
          <BigButton primary="English" variant="ghost" onClick={() => pickLang("en")} className="border-white/30 bg-transparent text-white" testId="btn-lang-en" />
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <AlertOctagon className="h-12 w-12 text-[#C0392B]" />
        <p className="text-center text-lg text-[#0B1F4D]">{bootError}</p>
        <BigButton primary={t("failed", lang)} variant="ghost" onClick={() => window.location.reload()} />
      </div>
    );
  }

  if (phase === "boot" || !boot) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-lg text-[#5A6273]">{t("loading", lang)}</p>
      </div>
    );
  }

  // ── success / submitting / error ──
  if (phase === "success" && result) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-white p-6" data-testid="screen-success">
        <div className="mx-pop flex h-32 w-32 items-center justify-center rounded-full" style={{ background: MX.green }}>
          <svg viewBox="0 0 52 52" className="h-16 w-16">
            <path className="mx-check" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" d="M14 27l8 8 16-18" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-[#2E7D5B]" style={{ fontFamily: "Georgia, serif" }}>
            {t("successTitle", lang)}
          </h1>
          <p className="mt-1 text-sm text-[#5A6273]">{t("refNumber", lang)}</p>
          <p className="mt-2 rounded-2xl bg-[#E8EEF7] px-6 py-3 font-mono text-3xl font-bold tracking-wide text-[#0B1F4D]" data-testid="ref-number">
            {result.number}
          </p>
          <p className="mt-4 text-lg text-[#0B1F4D]">{t("successBody", lang)}</p>
        </div>
        <Button variant="ghost"
          type="button"
          aria-label={t("listen", lang)}
          onClick={() => speak(`${t("successTitle", lang)} ${result.number}. ${t("successBody", lang)}`, lang)} className="flex h-14 w-14 rounded-full bg-[#E8EEF7] text-[#0B1F4D] active:scale-95">
          <Volume2 className="h-6 w-6" />
        </Button>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <BigButton primary={t("another", lang)} secondary={tPair("another", lang).secondary} variant="gold" onClick={() => resetForAnother(true)} />
          <BigButton primary={t("myReports", lang)} secondary={tPair("myReports", lang).secondary} variant="ghost" onClick={() => router.push("/capture/mine")} icon={ListChecks} />
        </div>
      </div>
    );
  }

  if (phase === "queued") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-white p-6" data-testid="screen-queued">
        <div className="mx-pop flex h-32 w-32 items-center justify-center rounded-full bg-[#B7791F]/15">
          <Clock className="h-16 w-16 text-[#B7791F]" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#B7791F]" style={{ fontFamily: "Georgia, serif" }}>
            {t("offlineSaved", lang)}
          </h1>
          {lang !== "en" ? <p className="mt-1 text-sm text-[#5A6273]">{t("offlineSaved", "en")}</p> : null}
        </div>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <BigButton primary={t("another", lang)} secondary={tPair("another", lang).secondary} variant="gold" testId="btn-another" onClick={() => resetForAnother(true)} />
          <BigButton primary={t("myReports", lang)} secondary={tPair("myReports", lang).secondary} variant="ghost" onClick={() => router.push("/capture/mine")} icon={ListChecks} />
        </div>
      </div>
    );
  }

  if (phase === "submitting") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6">
        <Spinner size="xl" tone="gold" />
        <p className="text-xl font-semibold text-[#0B1F4D]">
          {submitStage === "media" ? t("uploadingMedia", lang) : t("sending", lang)}
        </p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6">
        <AlertOctagon className="h-12 w-12 text-[#C0392B]" />
        <p className="text-center text-lg font-medium text-[#0B1F4D]">{submitError}</p>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <BigButton primary={t("submit", lang)} variant="gold" onClick={submit} />
          <BigButton primary={t("back", lang)} variant="ghost" onClick={() => setPhase("wizard")} />
        </div>
      </div>
    );
  }

  // ── wizard chrome + screens ──
  const areasToShow = showAllAreas ? boot.areas : boot.areas.slice(0, qrSupported() ? 5 : 6);
  const l1ToShow = showAllL1 ? l1Nodes : l1Nodes.slice(0, 5);
  const severityTiles: { value: SelfSeverity; titleKey: MsgKey; bodyKey: MsgKey; color: string }[] = [
    { value: "low", titleKey: "sev_low_title", bodyKey: "sev_low", color: MX.green },
    { value: "medium", titleKey: "sev_medium_title", bodyKey: "sev_medium", color: "#B7791F" },
    { value: "high", titleKey: "sev_high_title", bodyKey: "sev_high", color: MX.red },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col" onPointerDownCapture={countTap}>
      {/* header: back | dots | globe (always visible — spec 1.1.4) */}
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <Button variant="ghost"
          type="button"
          aria-label={step === 0 ? t("goDashboard", lang) : t("back", lang)}
          onClick={back} className="flex h-14 w-14 rounded-full bg-[#E8EEF7] text-[#0B1F4D] active:scale-95">
          {step === 0 ? <Home className="h-6 w-6" /> : <ChevronLeft className="h-7 w-7" />}
        </Button>
        <ProgressDots total={stages.length} current={step} />
        <div className="flex items-center gap-2">
          <SyncChip />
          <Button variant="ghost"
            type="button"
            aria-label={t("chooseLanguage", lang)}
            onClick={() => setShowLangPicker(true)} className="flex h-14 w-14 rounded-full bg-[#E8EEF7] text-[#0B1F4D] active:scale-95">
            <Globe className="h-6 w-6" />
          </Button>
        </div>
      </header>

      {/* Step breadcrumb — named steps for THIS flow, so the sequence is
          verifiable at a glance (e.g. Type › Permit › Where › Photo › …). */}
      <div className="mx-4 mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]" data-testid="flow-breadcrumb">
        {stages.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-[#C6CFDE]">›</span> : null}
            <span
              className={
                i === step
                  ? "rounded bg-[#0B1F4D] px-1.5 py-0.5 font-semibold text-white"
                  : i < step
                  ? "font-medium text-[#2E7D5B]"
                  : "text-[#9AA6BE]"
              }
            >
              {stageLabel(s, type, lang)}
            </span>
          </span>
        ))}
      </div>

      {/* Context Banner — persists once a location/asset is known (spec screen 1) */}
      {areaName || assetName ? (
        <div
          className="mx-4 mb-1 flex items-center gap-2 rounded-xl bg-[#0B1F4D] px-3 py-2 text-white"
          data-testid="context-banner"
        >
          <MapPin className="h-4 w-4 shrink-0 text-[#C9A961]" />
          <span className="truncate text-sm font-semibold">{areaName ?? "—"}</span>
          {assetName ? (
            <>
              <span className="text-white/40">·</span>
              <Wrench className="h-4 w-4 shrink-0 text-[#C9A961]" />
              <span className="truncate text-sm font-semibold">{assetName}</span>
            </>
          ) : null}
        </div>
      ) : null}

      <main className="flex flex-1 flex-col gap-5 px-4 pb-8 pt-2">
        {stage === "type" && (
          <>
            <ScreenHeading {...tPair("q_type", lang)} lang={lang} />
            <TileGrid>
              {typeTiles.map(({ type: tt, icon, key, danger }) => (
                <Tile
                  key={tt}
                  icon={icon}
                  primary={t(key, lang)}
                  secondary={tPair(key, lang).secondary}
                  tone={danger ? "danger" : "ice"}
                  selected={type === tt}
                  testId={`tile-type-${tt}`}
                  onClick={() => {
                    setType(tt);
                    try {
                      window.localStorage.setItem(LAST_TYPE_KEY, tt);
                    } catch {
                      /* storage unavailable — ordering is a nicety, not required */
                    }
                    setLastType(tt);
                    goNext();
                  }}
                />
              ))}
            </TileGrid>
            <Label className="mt-2 flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-[#D9E1EF] bg-white px-4 py-3 font-normal">
              <BiText
                primary={t("anonToggle", lang)}
                secondary={tPair("anonToggle", lang).secondary}
                className="items-start text-left"
              />
              <Switch
                size="lg"
                checked={anonymous}
                onCheckedChange={setAnonymous}
                activeClassName="bg-[#C9A961]"
                className="bg-[#D9E1EF]"
                aria-label={t("anonToggle", lang)}
              />
            </Label>
            {anonymous ? <p className="text-center text-sm font-medium text-[#B7791F]">{t("anonOn", lang)}</p> : null}
            <Link href="/capture/mine" className="mt-auto text-center text-base font-medium text-[#0B1F4D] underline underline-offset-4">
              {t("myReports", lang)}
            </Link>
          </>
        )}

        {stage === "where" && (
          <>
            <ScreenHeading {...tPair("q_where", lang)} lang={lang} />

            {/* A resolved fire sticker, confirmed back to the reporter. They
                scanned a specific cylinder; they need to see the wizard agrees
                which one before they describe a fault on it. */}
            {fireAsset ? (
              <Card
                className="mb-4 rounded-2xl border-2 border-[#C9A961] bg-[#FDF8EE] px-4 py-3 shadow-none"
                data-testid="fire-asset-banner">
                <div className="flex items-start gap-3">
                  <Flame size={22} className="mt-0.5 shrink-0 text-[#B7791F]" />
                  <div className="min-w-0">
                    <BiText
                      primary={t("fireAssetScanned", lang)}
                      secondary={tPair("fireAssetScanned", lang).secondary}
                    />
                    <p className="mt-1 truncate text-lg font-semibold text-[#0B1F4D]">
                      {fireAssetName}
                    </p>
                    {fireAsset.location ? (
                      <p className="truncate text-base text-[#5A6478]">{fireAsset.location}</p>
                    ) : null}
                  </div>
                </div>
              </Card>
            ) : null}

            {fireAssetLoading ? (
              <p className="mb-4 text-center text-base text-[#5A6478]">
                {t("fireAssetLookingUp", lang)}
              </p>
            ) : null}

            {/* The scan failed and the reporter is told, instead of being
                advanced as though it had worked. Both ways out are offered:
                the sticker may be damaged (rescan), or genuinely retired
                (file the finding without the link rather than lose it). */}
            {fireAssetError ? (
              <Card
                className="mb-4 rounded-2xl border-2 border-[#C53030] bg-[#FEF2F2] px-4 py-3 shadow-none"
                role="alert"
                data-testid="fire-asset-error">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={22} className="mt-0.5 shrink-0 text-[#C53030]" />
                  <p className="text-base font-medium text-[#C53030]">{fireAssetError}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-[#0B1F4D] px-4 py-2.5 text-base font-semibold text-white"
                    onClick={() => {
                      setFireAssetError(null);
                      setFireAssetId(null);
                      setShowQr(true);
                    }}
                  >
                    {t("fireAssetRetry", lang)}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border-2 border-[#D9E1EF] px-4 py-2.5 text-base font-medium text-[#0B1F4D]"
                    onClick={() => {
                      // Drops the link on the reporter's say-so — which is the
                      // difference between this and the defect being fixed.
                      setFireAssetError(null);
                      setFireAssetId(null);
                      setFireAsset(null);
                    }}
                  >
                    {t("fireAssetSkip", lang)}
                  </button>
                </div>
              </Card>
            ) : null}

            <TileGrid>
              {qrSupported() ? (
                <Tile icon={QrCode} primary={t("scanQr", lang)} secondary={tPair("scanQr", lang).secondary} tone="gold" onClick={() => setShowQr(true)} />
              ) : null}
              {areasToShow.map((area) => (
                <Tile
                  key={area.id}
                  icon={MapPin}
                  primary={area.name}
                  selected={areaId === area.id}
                  testId={`tile-area-${area.id}`}
                  onClick={() => {
                    setAreaId(area.id);
                    setQrUsed(false);
                    goNext();
                  }}
                />
              ))}
              {!showAllAreas && boot.areas.length > areasToShow.length ? (
                <Tile icon={ListChecks} primary={t("more", lang)} secondary={tPair("more", lang).secondary} onClick={() => setShowAllAreas(true)} />
              ) : null}
            </TileGrid>
          </>
        )}

        {stage === "details" && (
          <>
            <ScreenHeading
              {...tPair(
                type === "ptw" ? "flowPtw"
                  : type === "flra" ? "flowFlra"
                  : type === "incident" ? "flowIncident"
                  : type === "near_miss" ? "flowNearMiss"
                  : type === "unsafe_condition" ? "flowUnsafeCondition"
                  : "flowObservation",
                lang,
              )}
              lang={lang}
            />
            <div className="flex flex-col gap-4">
              {type === "observation" ? (
                <div className="flex flex-wrap gap-2">
                  <Chip testId="obs-act" label={t("obsUnsafeAct", lang)} selected={obsKind === "unsafe_act"} onClick={() => setObsKind(obsKind === "unsafe_act" ? null : "unsafe_act")} />
                  <Chip testId="obs-cond" label={t("obsUnsafeCondition", lang)} selected={obsKind === "unsafe_condition"} onClick={() => setObsKind(obsKind === "unsafe_condition" ? null : "unsafe_condition")} />
                </div>
              ) : null}

              {type === "near_miss" ? (
                <div className="flex flex-wrap gap-2">
                  {NM_OUTCOME_OPTS.map((o) => (
                    <Chip key={o.code} testId={`nm-${o.code}`} label={optLabel(NM_OUTCOME_OPTS, o.code, lang)} selected={nmOutcome === o.code} onClick={() => setNmOutcome(nmOutcome === o.code ? null : o.code)} />
                  ))}
                </div>
              ) : null}

              {type === "unsafe_condition" ? (
                <div className="flex flex-wrap gap-2">
                  {UC_DURATION_OPTS.map((o) => (
                    <Chip key={o.code} testId={`uc-${o.code}`} label={optLabel(UC_DURATION_OPTS, o.code, lang)} selected={ucDuration === o.code} onClick={() => setUcDuration(ucDuration === o.code ? null : o.code)} />
                  ))}
                </div>
              ) : null}

              {type === "incident" ? (
                <>
                  <div className="flex flex-col gap-2">
                    <span className="text-base font-semibold text-[#0B1F4D]">{t("injuryQ", lang)}</span>
                    <div className="flex gap-2">
                      <Chip testId="injury-yes" label={t("yesLabel", lang)} selected={injury === true} onClick={() => setInjury(true)} />
                      <Chip testId="injury-no" label={t("noLabel", lang)} selected={injury === false} onClick={() => { setInjury(false); setMedicalAttention(null); }} />
                    </div>
                  </div>
                  {injury === true ? (
                    <div className="flex flex-col gap-2">
                      <span className="text-base font-semibold text-[#0B1F4D]">{t("medicalQ", lang)}</span>
                      <div className="flex gap-2">
                        <Chip testId="medical-yes" label={t("yesLabel", lang)} selected={medicalAttention === true} onClick={() => setMedicalAttention(true)} />
                        <Chip testId="medical-no" label={t("noLabel", lang)} selected={medicalAttention === false} onClick={() => setMedicalAttention(false)} />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {type === "ptw" ? (
                <div className="flex flex-wrap gap-2">
                  {PERMIT_OPTS.map((o) => (
                    <Chip key={o.code} testId={`permit-${o.code}`} label={optLabel(PERMIT_OPTS, o.code, lang)} selected={permitType === o.code} onClick={() => setPermitType(permitType === o.code ? null : o.code)} />
                  ))}
                </div>
              ) : null}

              {type === "flra" ? (
                <>
                  <span className="text-base font-semibold text-[#0B1F4D]">{t("hazardsQ", lang)}</span>
                  <div className="flex flex-wrap gap-2">
                    {HAZARD_OPTS.map((o) => (
                      <Chip key={o.code} testId={`hazard-${o.code}`} label={optLabel(HAZARD_OPTS, o.code, lang)} selected={flraHazards.includes(o.code)} onClick={() => setFlraHazards((s) => (s.includes(o.code) ? s.filter((x) => x !== o.code) : [...s, o.code]))} />
                    ))}
                  </div>
                  <span className="mt-1 text-base font-semibold text-[#0B1F4D]">{t("controlsQ", lang)}</span>
                  <div className="flex flex-wrap gap-2">
                    {CONTROL_OPTS.map((o) => (
                      <Chip key={o.code} testId={`control-${o.code}`} label={optLabel(CONTROL_OPTS, o.code, lang)} selected={flraControls.includes(o.code)} onClick={() => setFlraControls((s) => (s.includes(o.code) ? s.filter((x) => x !== o.code) : [...s, o.code]))} />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <div className="mt-auto">
              {/* The Kind answer now drives the Category tiles, so it can no
                  longer be skipped past — without it there is no axis to scope
                  the list to. */}
              <BigButton
                primary={t("next", lang)}
                secondary={tPair("next", lang).secondary}
                variant="primary"
                testId="btn-details-next"
                disabled={type === "observation" && !obsKind}
                onClick={goNext}
              />
            </div>
          </>
        )}

        {/* ── STOP category tiles (Observation-bound flows) ──
            Driven by the axis the reporter chose on the Kind step, so an
            Unsafe condition never offers Reactions/Positions of People. The
            list is whatever the API returns for the axis — no filtering here. */}
        {stage === "category" && usesStop && !stopCat && (
          <>
            <ScreenHeading {...tPair("q_category", lang)} lang={lang} />
            <div className="flex items-center gap-2 rounded-xl bg-[#E8EEF7] px-3 py-2">
              <ShieldAlert className="h-5 w-5 text-[#0B1F4D]" />
              <span className="text-sm font-semibold text-[#0B1F4D]">
                {stopAxis === "CONDITION" ? t("obsUnsafeCondition", lang) : t("obsUnsafeAct", lang)}
              </span>
            </div>
            {stopCats.length === 0 ? (
              <p className="px-1 text-sm text-slate-500">
                {stopLoading ? t("loading", lang) : t("categoryUnavailable", lang)}
              </p>
            ) : (
              <TileGrid>
                {stopCats.map((c) => (
                  <Tile
                    key={c.categoryCode}
                    icon={taxonomyIcon(null)}
                    primary={c.categoryLabel}
                    secondary={c.stopReferenceCode}
                    testId={`tile-stop-cat-${c.categoryCode}`}
                    onClick={() => {
                      setStopCat(c);
                      setStopSub(null);
                    }}
                  />
                ))}
              </TileGrid>
            )}
          </>
        )}

        {stage === "category" && usesStop && stopCat && (
          <>
            <ScreenHeading {...tPair("q_category2", lang)} lang={lang} />
            <button
              type="button"
              onClick={() => {
                setStopCat(null);
                setStopSub(null);
              }}
              className="flex w-full items-center gap-2 rounded-xl bg-[#E8EEF7] px-3 py-2 text-left"
            >
              <ShieldAlert className="h-5 w-5 text-[#0B1F4D]" />
              <span className="text-sm font-semibold text-[#0B1F4D]">{stopCat.categoryLabel}</span>
              <ChevronLeft className="ml-auto h-4 w-4 rotate-180 text-[#0B1F4D]" />
            </button>
            <TileGrid>
              {stopSubs.map((s) => (
                <Tile
                  key={s.subCategoryCode}
                  icon={taxonomyIcon(null)}
                  primary={s.subCategoryLabel}
                  selected={stopSub?.subCategoryCode === s.subCategoryCode}
                  testId={`tile-stop-sub-${s.subCategoryCode}`}
                  onClick={() => {
                    setStopSub(s);
                    goNext();
                  }}
                />
              ))}
            </TileGrid>
            <BigButton primary={t("skip", lang)} secondary={tPair("skip", lang).secondary} variant="ghost" onClick={goNext} />
          </>
        )}

        {stage === "category" && !usesStop && !l1 && (
          <>
            <ScreenHeading {...tPair("q_category", lang)} lang={lang} />
            <TileGrid>
              {l1ToShow.map((node) => {
                const lp = labelPair(node.labels, lang);
                return (
                  <Tile
                    key={node.id}
                    icon={taxonomyIcon(node.iconKey)}
                    primary={lp.primary}
                    secondary={lp.secondary}
                    testId={`tile-cat-l1-${node.code}`}
                    onClick={() => {
                      setL1(node);
                      setL2(null);
                      const children = hazards.filter((n) => n.parentId === node.id);
                      if (children.length === 0) goNext();
                    }}
                  />
                );
              })}
              {!showAllL1 && l1Nodes.length > l1ToShow.length ? (
                <Tile icon={ListChecks} primary={t("more", lang)} secondary={tPair("more", lang).secondary} onClick={() => setShowAllL1(true)} />
              ) : null}
            </TileGrid>
          </>
        )}

        {stage === "category" && !usesStop && l1 && (
          <>
            <ScreenHeading {...tPair("q_category2", lang)} lang={lang} />
            <div className="flex items-center gap-2 rounded-xl bg-[#E8EEF7] px-3 py-2">
              {(() => {
                const Icon = taxonomyIcon(l1.iconKey);
                return <Icon className="h-5 w-5 text-[#0B1F4D]" />;
              })()}
              <span className="text-sm font-semibold text-[#0B1F4D]">{labelPair(l1.labels, lang).primary}</span>
            </div>
            <TileGrid>
              {l2Nodes.slice(0, 6).map((node) => {
                const lp = labelPair(node.labels, lang);
                return (
                  <Tile
                    key={node.id}
                    icon={taxonomyIcon(node.iconKey ?? l1.iconKey)}
                    primary={lp.primary}
                    secondary={lp.secondary}
                    selected={l2?.id === node.id}
                    testId={`tile-cat-l2-${node.code}`}
                    onClick={() => {
                      setL2(node);
                      goNext();
                    }}
                  />
                );
              })}
            </TileGrid>
            <BigButton primary={t("skip", lang)} secondary={tPair("skip", lang).secondary} variant="ghost" onClick={goNext} />
          </>
        )}

        {stage === "evidence" && (
          <>
            <ScreenHeading {...tPair("q_evidence", lang)} lang={lang} />
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              data-testid="input-photo"
              className="hidden"
              onChange={(e) => {
                void onPhotoPicked(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void onVideoPicked(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            {/* Gallery picker — NO `capture` attribute, so the phone offers the
                photo library (and multiple selection) instead of forcing the camera. */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              data-testid="input-gallery"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                void (async () => {
                  for (let i = 0; i < files.length; i++) await onPhotoPicked(files[i], i === 0);
                })();
                e.target.value = "";
              }}
            />
            <div className="flex flex-col gap-3">
              <BigButton primary={t("addPhoto", lang)} secondary={tPair("addPhoto", lang).secondary} icon={Camera} onClick={() => photoInputRef.current?.click()} />
              <BigButton primary={t("addFromGallery", lang)} secondary={tPair("addFromGallery", lang).secondary} icon={Images} variant="ghost" onClick={() => galleryInputRef.current?.click()} />
              <BigButton primary={t("addVideo", lang)} secondary={tPair("addVideo", lang).secondary} icon={Video} variant="ghost" onClick={() => videoInputRef.current?.click()} />
            </div>
            {mediaError ? <p className="text-center text-sm font-medium text-[#C0392B]">{mediaError}</p> : null}

            {/* AI vision-suggest confirm card (spec 1.2 screen 3) */}
            {aiChecking ? (
              <Card className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#C9A961]/40 bg-[#C9A961]/5 p-4 shadow-none">
                <Sparkles className="h-5 w-5 animate-pulse text-[#C9A961]" />
                <span className="text-sm font-medium text-[#0B1F4D]">
                  {lang === "hi" ? "फोटो देख रहे हैं…" : "Looking at your photo…"}
                </span>
              </Card>
            ) : null}
            {/* On STOP flows the card only shows when the server could express
                the suggestion in that taxonomy — otherwise "Yes" would appear
                to classify the report and silently do nothing. */}
            {aiSuggestion?.l1 && (!usesStop || aiStopSuggestion) ? (
              <Card className="rounded-2xl border-2 border-[#C9A961] bg-[#C9A961]/10 p-4 shadow-none" data-testid="ai-suggest-card">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#C9A961]" />
                  <span className="text-xs font-bold uppercase tracking-wide text-[#8a6d2f]">
                    {lang === "hi" ? "क्या यह सही है?" : "Is this right?"}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white">
                    {(() => {
                      const Icon = taxonomyIcon(aiSuggestion.l1.iconKey);
                      return <Icon className="h-8 w-8 text-[#0B1F4D]" />;
                    })()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-[#0B1F4D]">
                      {aiStopSuggestion
                        ? `${aiStopSuggestion.categoryLabel} — ${aiStopSuggestion.subCategoryLabel}`
                        : labelPair(aiSuggestion.l1.labels, lang).primary}
                    </p>
                    <p className="text-sm text-[#37415a]">{aiSuggestion.description}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={acceptAiSuggestion}
                    data-testid="ai-confirm"
                    className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-[#2E7D5B] text-lg font-semibold text-white active:scale-[0.98]"
                  >
                    <Check className="h-6 w-6" /> {lang === "hi" ? "हाँ" : "Yes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiSuggestion(null)}
                    className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border-2 border-[#D9E1EF] bg-white text-lg font-semibold text-[#0B1F4D] active:scale-[0.98]"
                  >
                    <X className="h-6 w-6" /> {lang === "hi" ? "बदलें" : "Change"}
                  </button>
                </div>
              </Card>
            ) : null}

            {media.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {media.map((item) => (
                  <Card key={item.clientMediaId} className="relative overflow-hidden rounded-xl border border-[#D9E1EF] bg-[#E8EEF7] shadow-none">
                    {item.kind === "PHOTO" && item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt="" className="h-24 w-full object-cover" />
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center">
                        <Video className="h-8 w-8 text-[#0B1F4D]" />
                      </div>
                    )}
                    <Button variant="ghost"
                      type="button"
                      aria-label={t("remove", lang)}
                      onClick={() => setMedia((m) => m.filter((x) => x.clientMediaId !== item.clientMediaId))} className="absolute right-1 top-1 flex h-9 w-9 rounded-full text-white">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-[#5A6273]">{t("evidenceNudge", lang)}</p>
            )}
            <div className="mt-auto">
              <BigButton
                primary={media.length > 0 ? t("next", lang) : t("skip", lang)}
                secondary={media.length > 0 ? tPair("next", lang).secondary : tPair("skip", lang).secondary}
                variant={media.length > 0 ? "primary" : "ghost"}
                testId="btn-evidence-next"
                onClick={goNext}
              />
            </div>
          </>
        )}

        {stage === "severity" && (
          <>
            <ScreenHeading {...tPair("q_severity", lang)} lang={lang} />
            <div className="flex flex-col gap-3">
              {severityTiles.map(({ value, titleKey, bodyKey, color }) => (
                <Button variant="ghost"
                  key={value}
                  type="button"
                  aria-pressed={severity === value}
                  data-testid={`tile-sev-${value}`}
                  onClick={() => {
                    setSeverity(value);
                    speak(`${t(titleKey, lang)}. ${t(bodyKey, lang)}`, lang);
                    window.setTimeout(() => goNext(), 350);
                  }}
                  className={
                    severity === value
                      ? "flex min-h-[88px] justify-start items-center gap-4 rounded-2xl border-4 p-4 text-left transition-transform active:scale-[0.98]"
                      : "flex min-h-[88px] justify-start items-center gap-4 rounded-2xl border-2 border-[#D9E1EF] bg-white p-4 text-left transition-transform active:scale-[0.98]"
                  }
                  style={severity === value ? { borderColor: color, background: `${color}14` } : undefined}>
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ background: `${color}22` }}>
                    <ShieldAlert className="h-8 w-8" style={{ color }} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-xl font-bold" style={{ color }}>
                      {t(titleKey, lang)}
                    </span>
                    <span className="text-base text-[#0B1F4D]">{t(bodyKey, lang)}</span>
                    {lang !== "en" ? <span className="text-xs text-[#5A6273]">{t(bodyKey, "en")}</span> : null}
                  </span>
                </Button>
              ))}
            </div>
          </>
        )}

        {stage === "describe" && (
          <>
            <ScreenHeading {...tPair("q_voice", lang)} lang={lang} />

            <div className="flex flex-col items-center justify-center">
              <VoiceRecorder
                lang={lang}
                existing={voiceNote}
                onRecorded={setVoiceNote}
                onClear={() => {
                  setVoiceNote(null);
                  setDeviceTranscript(null);
                }}
                onTranscript={(txt) => {
                  setDeviceTranscript(txt);
                  // seed the editable description with the raw transcript so the
                  // tech can tidy/edit it — one field, keyboard + voice (spec §6)
                  if (txt && !typedDescription.trim()) setTypedDescription(txt);
                }}
              />
            </div>

            {/* optional typed description + AI grammar cleanup (spec §6 / §7a) */}
            <div className="flex flex-col gap-2">
              <BiText
                primary={t("typeInstead", lang)}
                secondary={tPair("typeInstead", lang).secondary}
                className="items-start text-left"
              />
              <textarea
                value={typedDescription}
                onChange={(e) => {
                  setTypedDescription(e.target.value);
                  setCleanup(null);
                }}
                placeholder={t("describePlaceholder", lang)}
                data-testid="input-description"
                rows={3}
                className="w-full rounded-2xl border-2 border-[#D9E1EF] bg-white p-3 text-base text-[#0B1F4D] outline-none focus:border-[#C9A961]"
              />

              {/* Immediate action taken (spec §6 / real form) — obs / near-miss / incident */}
              {type === "observation" || type === "near_miss" || type === "incident" ? (
                <div className="flex flex-col gap-1.5">
                  <BiText primary={t("immediateActionQ", lang)} secondary={tPair("immediateActionQ", lang).secondary} className="items-start text-left" />
                  <textarea
                    value={immediateAction}
                    onChange={(e) => setImmediateAction(e.target.value)}
                    placeholder={t("immediateActionPlaceholder", lang)}
                    data-testid="input-immediate-action"
                    rows={2}
                    className="w-full rounded-2xl border-2 border-[#D9E1EF] bg-white p-3 text-base text-[#0B1F4D] outline-none focus:border-[#C9A961]"
                  />
                </div>
              ) : null}

              {/* AI 'help me write' — guided questions → a fact-only drafted description */}
              {boot.features.aiCaptureAssist && !guidedOpen && !draft && !cleanup ? (
                <button
                  type="button"
                  data-testid="btn-help-write"
                  onClick={() => setGuidedOpen(true)}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-[#C9A961] bg-[#C9A961]/10 text-base font-semibold text-[#8a6d2f] active:scale-[0.98]"
                >
                  <Sparkles className="h-5 w-5" /> {t("helpWrite", lang)}
                </button>
              ) : null}

              {guidedOpen && !draft ? (
                <Card className="rounded-2xl border-2 border-[#C9A961] bg-[#C9A961]/10 p-4 shadow-none" data-testid="guided-panel">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A961]" />
                    <span className="text-xs font-bold uppercase tracking-wide text-[#8a6d2f]">{t("guidedIntro", lang)}</span>
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    {GUIDED_QS.map((q) => {
                      const qp = tPair(q.msgKey, lang);
                      return (
                        <div key={q.key} className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <BiText primary={qp.primary} secondary={qp.secondary} className="items-start text-left" />
                            <Button variant="ghost"
                              type="button"
                              aria-label={t("listen", lang)}
                              onClick={() => speak(qp.primary, lang)} className="ml-auto flex h-9 w-9 shrink-0 rounded-full text-[#0B1F4D]">
                              <Volume2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <input
                            value={answers[q.key] ?? ""}
                            onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                            data-testid={`guided-${q.key}`}
                            className="w-full rounded-xl border-2 border-[#D9E1EF] bg-white p-3 text-base text-[#0B1F4D] outline-none focus:border-[#C9A961]"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      data-testid="btn-make-draft"
                      disabled={drafting || GUIDED_QS.every((q) => !(answers[q.key] ?? "").trim())}
                      onClick={runDraft}
                      className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#2E7D5B] text-base font-semibold text-white active:scale-[0.98] disabled:opacity-50"
                    >
                      <Sparkles className={drafting ? "h-5 w-5 animate-pulse" : "h-5 w-5"} /> {drafting ? t("writing", lang) : t("makeDraft", lang)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGuidedOpen(false);
                        setAnswers({});
                      }}
                      className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-[#D9E1EF] bg-white text-base font-semibold text-[#0B1F4D] active:scale-[0.98]"
                    >
                      {t("cancel", lang)}
                    </button>
                  </div>
                </Card>
              ) : null}

              {draft ? (
                <Card className="rounded-2xl border-2 border-[#C9A961] bg-[#C9A961]/10 p-4 shadow-none" data-testid="draft-card">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#8a6d2f]">{t("aiDraftLabel", lang)}</p>
                  <p className="mt-1 text-base font-semibold text-[#0B1F4D]" data-testid="draft-text">{draft.description}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      data-testid="draft-accept"
                      onClick={acceptDraft}
                      className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#2E7D5B] text-base font-semibold text-white active:scale-[0.98]"
                    >
                      <Check className="h-5 w-5" /> {t("useCleaned", lang)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-[#D9E1EF] bg-white text-base font-semibold text-[#0B1F4D] active:scale-[0.98]"
                    >
                      <X className="h-5 w-5" /> {t("keepOriginal", lang)}
                    </button>
                  </div>
                </Card>
              ) : null}

              {boot.features.aiCaptureAssist && typedDescription.trim().length >= 3 && !cleanup && !guidedOpen && !draft ? (
                <button
                  type="button"
                  data-testid="btn-cleanup"
                  disabled={cleaning}
                  onClick={runCleanup}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-[#C9A961] bg-[#C9A961]/10 text-base font-semibold text-[#8a6d2f] active:scale-[0.98] disabled:opacity-60"
                >
                  <Sparkles className={cleaning ? "h-5 w-5 animate-pulse" : "h-5 w-5"} />
                  {cleaning ? t("cleaning", lang) : t("cleanUp", lang)}
                </button>
              ) : null}

              {cleanup ? (
                <Card className="rounded-2xl border-2 border-[#C9A961] bg-[#C9A961]/10 p-4 shadow-none" data-testid="cleanup-card">
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#5A6273]">
                        {t("aiOriginalLabel", lang)}
                      </p>
                      <p className="text-sm text-[#37415a]">{cleanup.original}</p>
                    </div>
                    <div className="border-t border-[#C9A961]/40 pt-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#8a6d2f]">
                        {t("aiCleanedLabel", lang)}
                      </p>
                      <p className="text-base font-semibold text-[#0B1F4D]" data-testid="cleaned-text">
                        {cleanup.cleaned}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      data-testid="cleanup-accept"
                      onClick={acceptCleanup}
                      className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#2E7D5B] text-base font-semibold text-white active:scale-[0.98]"
                    >
                      <Check className="h-5 w-5" /> {t("useCleaned", lang)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCleanup(null)}
                      className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-[#D9E1EF] bg-white text-base font-semibold text-[#0B1F4D] active:scale-[0.98]"
                    >
                      <X className="h-5 w-5" /> {t("keepOriginal", lang)}
                    </button>
                  </div>
                </Card>
              ) : null}
            </div>

            <BigButton
              primary={voiceNote || typedDescription.trim() ? t("next", lang) : t("skip", lang)}
              secondary={voiceNote || typedDescription.trim() ? tPair("next", lang).secondary : tPair("skip", lang).secondary}
              variant={voiceNote || typedDescription.trim() ? "primary" : "ghost"}
              testId="btn-voice-next"
              onClick={goNext}
            />
          </>
        )}

        {stage === "review" && (
          <>
            <ScreenHeading {...tPair("q_review", lang)} lang={lang} />
            <ReviewCard
              lang={lang}
              typeKey={TYPE_TILES.find((tt) => tt.type === type)?.key ?? "type_observation"}
              areaName={
                [areaName, assetName, fireAssetName].filter(Boolean).join(" · ") ||
                (qrUsed ? "QR" : "—")
              }
              description={[flowSummary(), typedDescription.trim() || deviceTranscript || ""].filter(Boolean).join(" — ")}
              l1={l1}
              l2={l2}
              categoryText={
                usesStop
                  ? stopCat
                    ? `${stopCat.categoryLabel}${stopSub ? " — " + stopSub.subCategoryLabel : ""}`
                    : "—"
                  : null
              }
              severity={severity ?? "medium"}
              photoCount={media.filter((m) => m.kind === "PHOTO").length + media.filter((m) => m.kind === "VIDEO").length}
              hasVoice={!!voiceNote}
              anonymous={anonymous}
            />
            <div className="mt-auto flex flex-col gap-3">
              <BigButton primary={t("submit", lang)} secondary={tPair("submit", lang).secondary} variant="gold" testId="btn-submit" onClick={submit} />
            </div>
          </>
        )}
      </main>

      {showQr ? (
        <QrScannerModal
          lang={lang}
          knownAreaIds={knownAreaIds}
          onClose={() => setShowQr(false)}
          onResult={(qr) => {
            setShowQr(false);
            if (qr.areaId) setAreaId(qr.areaId);
            if (qr.equipmentId) setEquipmentId(qr.equipmentId);
            // The branch that was missing. `qr-scanner.tsx` has parsed
            // `safeops:fire-asset:` tokens since fire stickers shipped, but
            // nothing here read the result — the wizard set qrUsed and advanced,
            // so a scanned cylinder produced a report linked to nothing, with no
            // error. applyFireAsset resolves it, pre-fills from it, and advances
            // only once it has an answer.
            if (qr.fireAssetToken) {
              void applyFireAsset(qr.fireAssetToken, { advance: true, byToken: true });
              return;
            }
            setQrUsed(true);
            goNext(); // advance from "where" to the next screen for this flow
          }}
        />
      ) : null}
    </div>
  );
}

function ReviewCard({
  lang,
  typeKey,
  areaName,
  description,
  l1,
  l2,
  categoryText,
  severity,
  photoCount,
  hasVoice,
  anonymous,
}: {
  lang: Lang;
  typeKey: MsgKey;
  areaName: string;
  description: string;
  l1: TaxNode | null;
  l2: TaxNode | null;
  /** Pre-rendered category text for STOP-classified flows, which pick from
   *  ObservationTaxonomy rather than the bilingual hazard tree and so have no
   *  TaxNode to hand. Takes precedence over l1/l2 when set. */
  categoryText?: string | null;
  severity: SelfSeverity;
  photoCount: number;
  hasVoice: boolean;
  anonymous: boolean;
}) {
  const sevKey: MsgKey = severity === "low" ? "sev_low_title" : severity === "high" ? "sev_high_title" : "sev_medium_title";
  const sevColor = severity === "low" ? MX.green : severity === "high" ? MX.red : "#B7791F";
  const catText =
    categoryText ??
    (l1 ? `${labelPair(l1.labels, lang).primary}${l2 ? " — " + labelPair(l2.labels, lang).primary : ""}` : "—");

  const summaryForTts = [
    t(typeKey, lang),
    `${t("where", lang)}: ${areaName}`,
    `${t("what", lang)}: ${catText}`,
    `${t("severity", lang)}: ${t(sevKey, lang)}`,
    photoCount > 0 ? `${photoCount} ${t("photos", lang)}` : "",
    hasVoice ? t("voiceNote", lang) : "",
    anonymous ? t("anonymous", lang) : "",
  ]
    .filter(Boolean)
    .join(". ");

  const rows: { label: string; value: string; color?: string }[] = [
    { label: t("what", lang), value: `${t(typeKey, lang)} · ${catText}` },
    { label: t("where", lang), value: areaName },
    { label: t("severity", lang), value: t(sevKey, lang), color: sevColor },
    {
      label: t("evidence", lang),
      value: `${photoCount} ${t("photos", lang)}${hasVoice ? ` · ${t("voiceNote", lang)}` : ""}`,
    },
  ];
  if (description.trim()) {
    rows.splice(3, 0, { label: t("noteLabel", lang), value: description.trim() });
  }

  return (
    <Card className="rounded-2xl border-2 border-[#D9E1EF] p-4 shadow-none">
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3 border-b border-[#E8EEF7] pb-2 last:border-0 last:pb-0">
            <span className="text-sm text-[#5A6273]">{row.label}</span>
            <span className="text-right text-base font-semibold" style={{ color: row.color ?? MX.navy }}>
              {row.value}
            </span>
          </div>
        ))}
        {anonymous ? (
          <Badge className="self-start border-transparent bg-[#C9A961]/20 px-3 py-1 text-sm text-[#8a6d2f]">
            {t("anonymous", lang)}
          </Badge>
        ) : null}
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => speak(summaryForTts, lang)}
        className="mt-4 min-h-[56px] w-full rounded-xl bg-[#E8EEF7] text-base font-semibold text-[#0B1F4D] hover:bg-[#dbe5f2] active:scale-[0.98]"
      >
        <Volume2 className="h-5 w-5" /> {t("listen", lang)}
      </Button>
    </Card>
  );
}
