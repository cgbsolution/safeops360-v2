"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  PlayCircle,
  ArrowRight,
  ArrowLeft,
  MousePointerClick,
  Check,
  Pencil,
  X as XIcon,
  Search,
  ListChecks,
  ShieldAlert,
  Wrench,
  FileWarning,
  Eye,
  AlertTriangle,
  FileText,
  ClipboardList,
  Leaf,
  GitBranch,
  Plus
} from "lucide-react";

// ── High-fidelity, in-app walkthrough ─────────────────────────────────
// Each step is a stylised replica of the real SafeOps360 screen for that
// moment in the journey — same sidebar, the actual record table, the real
// detail tabs, and the live agent card — with the next click highlighted.

type Tone = "low" | "moderate" | "high" | "critical" | "neutral" | "blue";

const TONE: Record<Tone, string> = {
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  moderate: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-rose-100 text-rose-800 border-rose-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-blue-100 text-blue-800 border-blue-200"
};

type Row = { number: string; type: { t: string; tone: Tone }; desc: string; stage: string; target?: boolean };
type OutputBlock = { title: string; badge?: { text: string; tone: Tone }; lines: string[] };

type Meta = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tagline: string;
  authority: string;
  model: string;
  navItem: string;
  primaryHref: string;
  captions: [string, string, string, string];
  list: {
    title: string;
    primaryBtn: string;
    tabs: string[];
    activeTab: string;
    typeCol: string;
    rows: [Row, Row, Row];
  };
  detail: {
    title: string;
    tabs: string[];
    activeTab: string;
    cardTitle: string;
    cardDesc: string;
    button: string;
  };
  output: { scenario: string; blocks: OutputBlock[] };
};

// ── Real sidebar structure (sections + icons), so it reads like the app ─
const SIDEBAR: { section: string; items: { name: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] }[] = [
  {
    section: "Operational Safety",
    items: [
      { name: "Safety Observation", icon: Eye },
      { name: "Near Miss", icon: AlertTriangle },
      { name: "Permit to Work", icon: FileText },
      { name: "Incident Investigation", icon: ClipboardList }
    ]
  },
  {
    section: "Risk Management",
    items: [
      { name: "HIRA — Risk Register", icon: ShieldAlert },
      { name: "EAI — Environmental", icon: Leaf },
      { name: "CAPA — Universal", icon: Wrench },
      { name: "MOC", icon: GitBranch }
    ]
  },
  { section: "AI Assistance", items: [{ name: "AI Agents", icon: Sparkles }] }
];

const AGENT_META: Record<string, Meta> = {
  RCA_ASSISTANT: {
    icon: Search,
    tagline: "Drafts root-cause candidates, contributing factors and CAPA ideas for an incident under investigation.",
    authority: "L0 · Advisory only",
    model: "Claude Haiku 4.5",
    navItem: "Incident Investigation",
    primaryHref: "/incidents",
    captions: [
      "Open Incident Investigation from the sidebar.",
      "Click an incident that's in INVESTIGATION.",
      "Open the Cause tab → Start AI Analysis on the violet card.",
      "Review the draft — Accept, Edit or Reject each item."
    ],
    list: {
      title: "Incident Investigation",
      primaryBtn: "Report Incident",
      tabs: ["All", "Reported", "Investigation", "Verified", "Closed"],
      activeTab: "Investigation",
      typeCol: "Type",
      rows: [
        { number: "INC-2026-LMS-012", type: { t: "Property Damage", tone: "blue" }, desc: "Bag filter housing crack", stage: "Plant Head Approves" },
        { number: "INC-2026-LMS-014", type: { t: "First Aid", tone: "low" }, desc: "Operator slipped near CM-1", stage: "Investigation Team — RCA + CAPA", target: true },
        { number: "INC-2026-LMS-016", type: { t: "Mtc", tone: "moderate" }, desc: "Hand injury on conveyor guard", stage: "Corporate HSE Reviews" }
      ]
    },
    detail: {
      title: "INC-2026-LMS-014",
      tabs: ["Summary", "Persons", "Timeline", "Cause", "Controls"],
      activeTab: "Cause",
      cardTitle: "RCA Assistant",
      cardDesc: "Suggests root-cause candidates (5-Why / Fishbone) and CAPA actions for this incident.",
      button: "Start AI Analysis"
    },
    output: {
      scenario: "Night-shift operator slipped on a wet patch near Cement Mill CM-1; minor wrist injury (First Aid).",
      blocks: [
        { title: "Most likely root cause", badge: { text: "High confidence", tone: "high" }, lines: ["Leaking gland-seal on the CM-1 cooling line — no night-shift mopping/bunding."] },
        { title: "Suggested corrective actions", lines: ["Repair seal + add a drip tray.", "Add a night-shift housekeeping checkpoint at CM-1.", "Restore walkway lighting to ≥100 lux."] }
      ]
    }
  },
  TRIAGE_AGENT: {
    icon: ListChecks,
    tagline: "On a freshly reported incident, suggests classification, the investigations likely required, and finds similar past events.",
    authority: "L0 · Advisory only",
    model: "Claude Haiku 4.5",
    navItem: "Incident Investigation",
    primaryHref: "/incidents",
    captions: [
      "Open Incident Investigation from the sidebar.",
      "Click a newly REPORTED incident awaiting classification.",
      "Open the Triage card in the Classification step.",
      "Review the suggested type, severity & similar incidents."
    ],
    list: {
      title: "Incident Investigation",
      primaryBtn: "Report Incident",
      tabs: ["All", "Reported", "Investigation", "Verified", "Closed"],
      activeTab: "Reported",
      typeCol: "Type",
      rows: [
        { number: "INC-2026-LMS-020", type: { t: "First Aid", tone: "low" }, desc: "Minor cut, packing line", stage: "HSE Manager Classification" },
        { number: "INC-2026-LMS-021", type: { t: "Unclassified", tone: "neutral" }, desc: "Eye irritation after bag-filter work", stage: "HSE Manager Classification", target: true },
        { number: "INC-2026-LMS-022", type: { t: "Mtc", tone: "moderate" }, desc: "Slip on stairwell", stage: "HSE Manager Classification" }
      ]
    },
    detail: {
      title: "INC-2026-LMS-021",
      tabs: ["Report", "Classification", "Persons", "Cause"],
      activeTab: "Classification",
      cardTitle: "Triage Agent",
      cardDesc: "Suggests classification, likely investigations, and similar past incidents.",
      button: "Run triage"
    },
    output: {
      scenario: "“Eye irritation after bag-filter maintenance — operator flushed eyes and resumed work.”",
      blocks: [
        { title: "Suggested classification", badge: { text: "First Aid · Low", tone: "low" }, lines: ["First-Aid Case · likely no lost time."] },
        { title: "Similar past incidents", lines: ["INC-2025-LMS-031 — dust exposure, bag house.", "INC-2025-SDH-009 — eye irritation, packing."] }
      ]
    }
  },
  HIRA_ASSISTANT: {
    icon: ShieldAlert,
    tagline: "For a HIRA activity, suggests candidate hazards, estimates residual risk for the stated controls, and proposes more controls when residual is unacceptable.",
    authority: "L0 · Advisory only",
    model: "Claude Haiku 4.5",
    navItem: "HIRA — Risk Register",
    primaryHref: "/hira",
    captions: [
      "Open HIRA — Risk Register from the sidebar.",
      "Click a study that's DRAFT or IN PROGRESS.",
      "Open an entry → ask the HIRA Assistant for hazards.",
      "Review hazards, residual risk and recommended controls."
    ],
    list: {
      title: "HIRA — Risk Register",
      primaryBtn: "New Study",
      tabs: ["All", "Draft", "In Progress", "Active"],
      activeTab: "In Progress",
      typeCol: "Scope",
      rows: [
        { number: "HIRA-2026-LMS-002", type: { t: "Department", tone: "blue" }, desc: "Packing & dispatch operations", stage: "Team Review" },
        { number: "HIRA-2026-LMS-001", type: { t: "Plant", tone: "moderate" }, desc: "Cement Mill Operations — Annual", stage: "In Progress", target: true },
        { number: "HIRA-2026-LMS-003", type: { t: "Process", tone: "neutral" }, desc: "Kiln preheater maintenance", stage: "Draft" }
      ]
    },
    detail: {
      title: "HIRA-2026-LMS-001 · Entry 5",
      tabs: ["Activity", "Hazards", "Risk", "Controls"],
      activeTab: "Hazards",
      cardTitle: "HIRA Assistant",
      cardDesc: "Suggests candidate hazards and controls for the activity you described.",
      button: "Suggest hazards"
    },
    output: {
      scenario: "Activity: “Routine inspection at height on the kiln-preheater conveyor walkway.”",
      blocks: [
        { title: "Residual risk (with stated controls)", badge: { text: "HIGH · 8", tone: "high" }, lines: ["Open edge at the transfer point keeps severity above the acceptable threshold."] },
        { title: "Recommended additional controls", lines: ["Self-closing gate at the transfer point.", "Toe-board + tool tethering.", "Hot-surface guarding."] }
      ]
    }
  },
  CAPA_ASSISTANT: {
    icon: Wrench,
    tagline: "Drafts root-cause candidates, action proposals and verification approaches for a CAPA, calibrated to its source.",
    authority: "L0 · Advisory only",
    model: "Claude Haiku 4.5",
    navItem: "CAPA — Universal",
    primaryHref: "/capa",
    captions: [
      "Open CAPA — Universal from the sidebar.",
      "Click the CAPA you're working on.",
      "Open the CAPA Assistant card → Draft analysis.",
      "Review the root cause, actions and verification plan."
    ],
    list: {
      title: "CAPA — Universal",
      primaryBtn: "New CAPA",
      tabs: ["All", "Open", "In Progress", "Verified", "Closed"],
      activeTab: "Open",
      typeCol: "Source",
      rows: [
        { number: "CAPA-2026-012", type: { t: "Incident", tone: "moderate" }, desc: "Repeat slip near CM-1", stage: "Action Planning" },
        { number: "CAPA-2026-014", type: { t: "Audit", tone: "blue" }, desc: "Expired calibration certificates", stage: "Root-Cause Analysis", target: true },
        { number: "CAPA-2026-015", type: { t: "Environmental", tone: "low" }, desc: "Stack PM excursion", stage: "Open" }
      ]
    },
    detail: {
      title: "CAPA-2026-014",
      tabs: ["Summary", "Root Cause", "Actions", "Verification"],
      activeTab: "Root Cause",
      cardTitle: "CAPA Assistant",
      cardDesc: "Drafts root cause, corrective actions and a verification approach for this CAPA.",
      button: "Draft analysis"
    },
    output: {
      scenario: "CAPA-2026-014 (source: Internal Audit) — 3 pressure-gauge calibration certificates expired and not renewed.",
      blocks: [
        { title: "Root-cause candidate", lines: ["No automated due-date trigger — a manual spreadsheet wasn't maintained after a role change."] },
        { title: "Verification approach", lines: ["Audit the calibration register 30 days post-fix.", "Confirm 0 expired certs on a sample of 20."] }
      ]
    }
  },
  PERMIT_RISK_REVIEWER: {
    icon: FileWarning,
    tagline: "Reviews a Permit to Work for multi-signal risks the rules engine can't catch — SIMOPS conflicts, scope mismatches, crew-competency gaps, and patterns from past incidents.",
    authority: "L2 · Monitor (flags risk; humans decide)",
    model: "Claude Opus 4.7 (escalated)",
    navItem: "Permit to Work",
    primaryHref: "/ptw",
    captions: [
      "Open Permit to Work from the sidebar.",
      "Click a permit that's UNDER REVIEW.",
      "Open the Permit Risk Reviewer panel → Review risks.",
      "Read the advisory flags — the issuer still decides."
    ],
    list: {
      title: "Permit to Work",
      primaryBtn: "New Permit",
      tabs: ["All", "Draft", "Under Review", "Active", "Closed"],
      activeTab: "Under Review",
      typeCol: "Type",
      rows: [
        { number: "PTW-LMS-0040", type: { t: "Electrical", tone: "blue" }, desc: "LV panel maintenance, MCC-2", stage: "Issuer Review" },
        { number: "PTW-LMS-0042", type: { t: "Hot Work", tone: "high" }, desc: "Grinding on pipe rack (near CSE)", stage: "Under Review", target: true },
        { number: "PTW-LMS-0043", type: { t: "Height", tone: "moderate" }, desc: "Conveyor walkway inspection", stage: "Draft" }
      ]
    },
    detail: {
      title: "PTW-LMS-0042 · Hot Work",
      tabs: ["Details", "Crew", "Controls", "Risk Review"],
      activeTab: "Risk Review",
      cardTitle: "Permit Risk Reviewer",
      cardDesc: "Flags SIMOPS conflicts, crew gaps and historical patterns. Advisory — never approves or rejects.",
      button: "Review risks"
    },
    output: {
      scenario: "PTW-LMS-0042 — Hot work (grinding) on a pipe rack, adjacent to a live confined-space entry.",
      blocks: [
        { title: "SIMOPS conflict", badge: { text: "Critical", tone: "critical" }, lines: ["Hot work within 8 m of an active confined-space entry — spark/fume ingress risk."] },
        { title: "Crew competency gap", badge: { text: "High", tone: "high" }, lines: ["Assigned fire-watch has no active Fire Watch certificate on file."] }
      ]
    }
  }
};

// ── Mock chrome ───────────────────────────────────────────────────────

function AppFrame({
  activeNav,
  pointAtNav,
  children
}: {
  activeNav: string;
  pointAtNav?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-100 px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-rose-300" />
        <span className="h-2 w-2 rounded-full bg-amber-300" />
        <span className="h-2 w-2 rounded-full bg-emerald-300" />
        <span className="ml-2 rounded bg-white px-2 py-0.5 text-[9px] text-slate-400 ring-1 ring-slate-200">
          app.safeops360 · {activeNav}
        </span>
      </div>
      <div className="flex min-h-[230px]">
        {/* sidebar */}
        <div className="w-36 shrink-0 bg-gradient-to-b from-indigo-950 to-violet-950 px-2 pb-2 pt-2.5">
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-white text-[7px] font-extrabold text-indigo-900">
              S360
            </div>
            <div className="leading-none">
              <div className="text-[8px] font-bold text-white">SafeOps360</div>
              <div className="text-[6px] text-indigo-300">All Plants</div>
            </div>
          </div>
          {SIDEBAR.map((sec) => (
            <div key={sec.section} className="mt-1.5">
              <div className="px-1 text-[6px] font-semibold uppercase tracking-wider text-indigo-400/80">
                {sec.section}
              </div>
              <div className="mt-0.5 space-y-px">
                {sec.items.map(({ name, icon: I }) => {
                  const active = name === activeNav;
                  return (
                    <div
                      key={name}
                      className={[
                        "relative flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] transition",
                        active ? "bg-white/15 font-semibold text-white ring-1 ring-white/40" : "text-indigo-200/70"
                      ].join(" ")}
                    >
                      <I size={8} className={active ? "text-white" : "text-indigo-300/70"} />
                      <span className="truncate">{name}</span>
                      {active && pointAtNav && (
                        <span className="absolute -right-1.5 -top-1.5 flex items-center">
                          <MousePointerClick size={12} className="text-white drop-shadow" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {/* content */}
        <div className="flex-1 bg-slate-50/70 p-2.5">{children}</div>
      </div>
    </Card>
  );
}

function Cursor({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute -bottom-3 -right-1 z-10 flex items-center gap-1">
      <MousePointerClick size={15} className="text-violet-700 drop-shadow" />
      <span className="rounded bg-violet-700 px-1.5 py-0.5 text-[9px] font-medium text-white shadow">{label}</span>
    </span>
  );
}

function ListMock({ meta }: { meta: Meta }) {
  const l = meta.list;
  return (
    <AppFrame activeNav={meta.navItem}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold text-slate-800">{l.title}</div>
        <span className="inline-flex items-center gap-1 rounded bg-violet-600 px-2 py-0.5 text-[8px] font-medium text-white">
          <Plus size={8} /> {l.primaryBtn}
        </span>
      </div>
      <div className="mt-1.5 flex gap-1">
        {l.tabs.map((t) => (
          <span
            key={t}
            className={[
              "rounded px-1.5 py-0.5 text-[8px]",
              t === l.activeTab ? "bg-violet-100 font-semibold text-violet-700 ring-1 ring-violet-300" : "bg-white text-slate-400 ring-1 ring-slate-200"
            ].join(" ")}
          >
            {t}
          </span>
        ))}
      </div>
      <Card className="mt-1.5 overflow-hidden rounded-md border border-slate-200 bg-white shadow-none">
        <div className="grid grid-cols-[1.4fr_1fr_2fr_1.6fr] bg-slate-50 px-2 py-1 text-[7px] font-semibold uppercase tracking-wider text-slate-400">
          <span>Number</span>
          <span>{l.typeCol}</span>
          <span>Description</span>
          <span>Stage</span>
        </div>
        {l.rows.map((r) => (
          <div
            key={r.number}
            className={[
              "relative grid grid-cols-[1.4fr_1fr_2fr_1.6fr] items-center px-2 py-1.5 text-[8px]",
              r.target ? "bg-violet-50 ring-1 ring-inset ring-violet-300" : "border-t border-slate-100"
            ].join(" ")}
          >
            <span className={r.target ? "font-semibold text-violet-700" : "font-mono text-slate-500"}>{r.number}</span>
            <span>
              <span className={`rounded border px-1 py-px text-[7px] ${TONE[r.type.tone]}`}>{r.type.t}</span>
            </span>
            <span className="truncate text-slate-600">{r.desc}</span>
            <span>
              <span className={`rounded border px-1 py-px text-[7px] ${r.target ? TONE.blue : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                {r.stage}
              </span>
            </span>
            {r.target && <Cursor label="Open" />}
          </div>
        ))}
      </Card>
    </AppFrame>
  );
}

function DetailMock({ meta }: { meta: Meta }) {
  const d = meta.detail;
  return (
    <AppFrame activeNav={meta.navItem}>
      <div className="text-[7px] text-slate-400">{meta.list.title} ›</div>
      <div className="text-[11px] font-bold text-slate-800">{d.title}</div>
      <div className="mt-1 flex gap-1 border-b border-slate-200 pb-1">
        {d.tabs.map((t) => (
          <span
            key={t}
            className={[
              "rounded-t px-1.5 py-0.5 text-[8px]",
              t === d.activeTab ? "bg-white font-semibold text-violet-700 ring-1 ring-violet-200 ring-b-0" : "text-slate-400"
            ].join(" ")}
          >
            {t}
          </span>
        ))}
      </div>
      <Alert variant="brand" className="mt-2 rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-2.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-violet-100">
            <Sparkles size={10} className="text-violet-600" />
          </div>
          <span className="text-[10px] font-semibold text-violet-900">{d.cardTitle}</span>
          <Badge variant="violet" className="rounded-full bg-violet-100 px-1.5 py-px text-[7px] font-medium text-violet-700">AI · advisory</Badge>
        </div>
        <p className="mt-1 text-[8px] leading-snug text-slate-500">{d.cardDesc}</p>
        <div className="relative mt-2 inline-flex">
          <Badge variant="violet" className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-[9px] font-semibold text-white ring-2 ring-violet-300">
            <Sparkles size={9} /> {d.button}
          </Badge>
          <Cursor label="Click" />
        </div>
      </Alert>
    </AppFrame>
  );
}

function OutputMock({ meta }: { meta: Meta }) {
  return (
    <Alert variant="brand" className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-md">
      <div className="flex items-center justify-between bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-white">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold">
          <Sparkles size={11} /> {meta.detail.cardTitle} · suggestion
        </span>
        <Badge variant="neutral" className="rounded-full bg-white/20 px-2 py-0.5 text-[8px] font-medium ring-1 ring-white/30">PENDING REVIEW</Badge>
      </div>
      <div className="space-y-2 p-3">
        <Card className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-600 shadow-none">
          <span className="font-semibold text-slate-500">Input · </span>
          {meta.output.scenario}
        </Card>
        {meta.output.blocks.map((b) => (
          <Alert variant="brand" key={b.title} className="rounded-lg border border-violet-100 bg-violet-50/30 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">{b.title}</span>
              {b.badge && (
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${TONE[b.badge.tone]}`}>{b.badge.text}</span>
              )}
            </div>
            <ul className="mt-1 space-y-0.5">
              {b.lines.map((line, i) => (
                <li key={i} className="text-[11px] text-slate-600">• {line}</li>
              ))}
            </ul>
          </Alert>
        ))}
        <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2">
          <span className="text-[10px] text-slate-400">You decide:</span>
          <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"><Check size={10} /> Accept</span>
          <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"><Pencil size={10} /> Edit</span>
          <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"><XIcon size={10} /> Reject</span>
        </div>
      </div>
    </Alert>
  );
}

export function AgentDemo({ code, name }: { code: string; name: string }) {
  const meta = AGENT_META[code];
  const [step, setStep] = useState(0);
  if (!meta) return null;

  const Icon = meta.icon;
  const last = 3;
  const visual =
    step === 0 ? (
      <AppFrame activeNav={meta.navItem} pointAtNav>
        <div className="flex h-full items-center justify-center text-center text-[10px] text-slate-400">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">{meta.navItem}</div>
            <div className="mt-1">Click it in the sidebar to open the module →</div>
          </div>
        </div>
      </AppFrame>
    ) : step === 1 ? (
      <ListMock meta={meta} />
    ) : step === 2 ? (
      <DetailMock meta={meta} />
    ) : (
      <OutputMock meta={meta} />
    );

  return (
    <Dialog onOpenChange={(open) => open && setStep(0)}>
      <DialogTrigger asChild>
        <Button variant="outline"
          type="button" className="gap-1.5 rounded-md px-3 py-1.5 text-xs">
          <PlayCircle size={14} /> See how it works
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{name} — guided walkthrough</DialogTitle>

        <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <Icon size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold leading-tight">{name}</div>
              <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px]">
                <Badge variant="neutral" className="rounded-full bg-white/15 px-2 py-0.5 ring-1 ring-white/20">{meta.authority}</Badge>
                <Badge variant="neutral" className="rounded-full bg-white/15 px-2 py-0.5 ring-1 ring-white/20">{meta.model}</Badge>
              </div>
            </div>
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-white/90">{meta.tagline}</p>
          <div className="mt-3 flex items-center gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={["h-1.5 flex-1 rounded-full transition", i <= step ? "bg-white" : "bg-white/25"].join(" ")} />
            ))}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
              {step + 1}
            </span>
            <span className="text-sm font-medium text-slate-800">{meta.captions[step]}</span>
          </div>
          {visual}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <Button variant="ghost"
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0} className="gap-1.5 rounded-md px-3 py-1.5 text-sm">
            <ArrowLeft size={14} /> Back
          </Button>
          <span className="text-[10px] text-slate-400">Step {step + 1} of 4</span>
          {step < last ? (
            <Button variant="ghost"
              type="button"
              onClick={() => setStep((s) => Math.min(last, s + 1))} className="gap-1.5 rounded-md px-4 py-1.5 text-sm text-white">
              Next <ArrowRight size={14} />
            </Button>
          ) : (
            <Link
              href={meta.primaryHref}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-violet-700"
            >
              Take me there <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AgentUsedIn({ code }: { code: string }) {
  const meta = AGENT_META[code];
  if (!meta) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Used in</span>
      <Link
        href={meta.primaryHref}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 transition hover:border-violet-300 hover:text-violet-700"
      >
        {meta.navItem}
      </Link>
    </div>
  );
}
