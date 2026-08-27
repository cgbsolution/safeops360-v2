// Typed shapes per RCA methodology. Stored in `Incident.rootCauseData` as JSON.
// The wire format value uses these exact keys; editors / read-views key off them.
//
// IMPORTANT: when extending these, never break field names that exist in seed
// data — the auto-summary generator + read-only views key off them.

export type RcaMethod =
  | "FIVE_WHY"
  | "FISHBONE"
  | "FTA"
  | "BOWTIE"
  | "TAPROOT"
  | "CAUSE_MAP";

// API surface uses the same string codes as legacy ("5-Why", "Fishbone", etc.).
// We accept either form on read; new writes use the underscore codes above so
// the picker / dropdown values match Prisma master entries when those land.
export const RCA_METHOD_LABELS: Record<RcaMethod, string> = {
  FIVE_WHY: "5-Why",
  FISHBONE: "Fishbone (Ishikawa)",
  FTA: "Fault Tree Analysis (FTA)",
  BOWTIE: "Bowtie",
  TAPROOT: "TapRoot",
  CAUSE_MAP: "Cause Map"
};

export const RCA_METHODS_LIST: { code: RcaMethod; label: string }[] = (Object.keys(RCA_METHOD_LABELS) as RcaMethod[]).map((code) => ({
  code,
  label: RCA_METHOD_LABELS[code]
}));

// Bridge from any legacy code value (5-Why / Fishbone / etc.) to canonical RcaMethod.
// The CAPA module shipped its own spelling of three of these — 5_WHY,
// FAULT_TREE, TAP_ROOT — so the same technique carried two codes depending on
// which screen recorded it, and the CAPA spelling matched no template and no
// read view. Both spellings are accepted here; new writes use the canonical one.
export function normaliseRcaMethod(input: string | null | undefined): RcaMethod | null {
  if (!input) return null;
  const v = input.trim();
  if (v === "5-Why" || v === "FIVE_WHY" || v === "5_WHY") return "FIVE_WHY";
  if (v === "Fishbone" || v === "FISHBONE") return "FISHBONE";
  if (v === "FTA" || v === "FAULT_TREE") return "FTA";
  if (v === "Bowtie" || v === "BOWTIE") return "BOWTIE";
  if (v === "TapRoot" || v === "TAPROOT" || v === "TAP_ROOT") return "TAPROOT";
  if (v === "Cause Map" || v === "CAUSE_MAP") return "CAUSE_MAP";
  return null;
}

// ─── CAPA methodology list ─────────────────────────────────────────────
// The six above all have a template. CAPA additionally offers three that do
// not: 8D and Is/Is-Not are recorded as a narrative summary, and "None
// required" is the explicit decision not to analyse a low-severity obvious
// cause. Keeping them in one list is what lets the form say honestly which
// picks open a template and which do not.
export type CapaRcaMethod = RcaMethod | "EIGHT_D" | "IS_IS_NOT" | "NONE_REQUIRED";

export const CAPA_RCA_METHODS: { code: CapaRcaMethod; label: string; templated: boolean }[] = [
  ...RCA_METHODS_LIST.map((m) => ({ code: m.code as CapaRcaMethod, label: m.label, templated: true })),
  { code: "EIGHT_D", label: "8D — narrative only", templated: false },
  { code: "IS_IS_NOT", label: "Is / Is-Not — narrative only", templated: false },
  {
    code: "NONE_REQUIRED",
    label: "None required (low severity, obvious cause)",
    templated: false
  }
];

// Display label for any methodology code that reaches a CAPA screen, legacy
// spellings included. Falls back to the raw code de-underscored rather than
// hiding a value nobody has mapped yet.
export function capaRcaMethodLabel(input: string | null | undefined): string {
  if (!input) return "Not selected";
  const canonical = normaliseRcaMethod(input);
  if (canonical) return RCA_METHOD_LABELS[canonical];
  const known = CAPA_RCA_METHODS.find((m) => m.code === input.trim());
  return known ? known.label : input.replace(/_/g, " ");
}

// ─── 5-Why ─────────────────────────────────────────────────────────────
export type FiveWhyData = {
  problemStatement: string;
  whys: { question: string; answer: string }[];
  rootCause: string;
};

export function emptyFiveWhy(): FiveWhyData {
  return {
    problemStatement: "",
    whys: [
      { question: "", answer: "" },
      { question: "", answer: "" },
      { question: "", answer: "" },
      { question: "", answer: "" },
      { question: "", answer: "" }
    ],
    rootCause: ""
  };
}

// ─── Fishbone (6M) ─────────────────────────────────────────────────────
export type FishboneData = {
  problemStatement: string;
  categories: {
    manpower: string[];
    machine: string[];
    method: string[];
    material: string[];
    measurement: string[];
    environment: string[];
  };
  rootCauses: string[];
};

export const FISHBONE_KEYS = ["manpower", "machine", "method", "material", "measurement", "environment"] as const;
export type FishboneKey = (typeof FISHBONE_KEYS)[number];
export const FISHBONE_LABELS: Record<FishboneKey, string> = {
  manpower: "Manpower",
  machine: "Machine",
  method: "Method",
  material: "Material",
  measurement: "Measurement",
  environment: "Environment"
};

export function emptyFishbone(): FishboneData {
  return {
    problemStatement: "",
    categories: { manpower: [], machine: [], method: [], material: [], measurement: [], environment: [] },
    rootCauses: []
  };
}

// ─── Fault Tree (FTA) ──────────────────────────────────────────────────
export type FtaNodeType = "EVENT" | "AND_GATE" | "OR_GATE" | "BASIC_EVENT";
export type FtaNode = {
  id: string;
  description: string;
  nodeType: FtaNodeType;
  children: FtaNode[];
  probability?: "LOW" | "MEDIUM" | "HIGH";
  existingControls?: string;
  controlActiveAtIncident?: boolean;
};
export type FtaData = {
  topEvent: string;
  rootNode: FtaNode;
};

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyFta(): FtaData {
  return {
    topEvent: "",
    rootNode: {
      id: genId(),
      description: "Top event",
      nodeType: "EVENT",
      children: []
    }
  };
}

export function newFtaNode(nodeType: FtaNodeType = "BASIC_EVENT"): FtaNode {
  return { id: genId(), description: "", nodeType, children: [] };
}

// ─── Bowtie ────────────────────────────────────────────────────────────
export type BarrierStatus = "WORKED" | "FAILED" | "ABSENT";
export type BowtieBarrier = { description: string; status: BarrierStatus };
export type BowtieThreat = {
  description: string;
  preventiveBarriers: BowtieBarrier[];
};
export type BowtieConsequence = {
  description: string;
  mitigativeBarriers: BowtieBarrier[];
};
export type BowtieData = {
  topEvent: string;
  threats: BowtieThreat[];
  consequences: BowtieConsequence[];
};

export function emptyBowtie(): BowtieData {
  return {
    topEvent: "",
    threats: [],
    consequences: []
  };
}

// ─── TapRoot ───────────────────────────────────────────────────────────
export type TapRootSnapNode = {
  timestamp: string;
  condition: string;
  action: string;
  isIncident: boolean;
};
export type TapRootRcEntry = {
  category: string; // e.g. "Human Performance Difficulty"
  subcategory: string; // e.g. "Procedure"
  nearRootCause: string; // e.g. "Procedure Wrong"
  rootCause: string; // detailed
};
export type TapRootCausalFactor = {
  description: string;
  rootCauseTree: TapRootRcEntry[];
};
export type TapRootCorrectiveAction = {
  description: string;
  traceableTo: string[]; // CF descriptions or rootCause strings
};
export type TapRootData = {
  eventDescription: string;
  snapChart: TapRootSnapNode[];
  causalFactors: TapRootCausalFactor[];
  genericCauses: string[];
  correctiveActions: TapRootCorrectiveAction[];
};

export function emptyTapRoot(): TapRootData {
  return {
    eventDescription: "",
    snapChart: [],
    causalFactors: [],
    genericCauses: [],
    correctiveActions: []
  };
}

// ─── Cause Map ─────────────────────────────────────────────────────────
export type ImpactCategory = "SAFETY" | "ENVIRONMENTAL" | "PRODUCTION" | "COMPLIANCE" | "COST";
export type CauseNode = {
  id: string;
  description: string;
  parentId: string | null;
};
export type CauseMapData = {
  impacts: ImpactCategory[];
  rootEvent: string;
  causeNodes: CauseNode[];
};

export function emptyCauseMap(): CauseMapData {
  return {
    impacts: [],
    rootEvent: "",
    causeNodes: []
  };
}

// ─── Universal "empty" + "shape detect" helpers ────────────────────────
export function emptyDataFor(method: RcaMethod): unknown {
  switch (method) {
    case "FIVE_WHY": return emptyFiveWhy();
    case "FISHBONE": return emptyFishbone();
    case "FTA": return emptyFta();
    case "BOWTIE": return emptyBowtie();
    case "TAPROOT": return emptyTapRoot();
    case "CAUSE_MAP": return emptyCauseMap();
  }
}

// True when the data still equals the empty template — used by the
// method-switching UX to skip the confirmation modal when there's nothing
// to lose.
export function isEmptyRcaData(method: RcaMethod, data: unknown): boolean {
  if (data == null) return true;
  if (typeof data !== "object") return true;
  switch (method) {
    case "FIVE_WHY": {
      const d = data as FiveWhyData;
      return !d.problemStatement?.trim() && !d.rootCause?.trim() && !(d.whys ?? []).some((w) => w.question?.trim() || w.answer?.trim());
    }
    case "FISHBONE": {
      const d = data as FishboneData;
      const anyCause = FISHBONE_KEYS.some((k) => (d.categories?.[k] ?? []).length > 0);
      return !d.problemStatement?.trim() && !anyCause && !(d.rootCauses ?? []).length;
    }
    case "FTA": {
      const d = data as FtaData;
      return !d.topEvent?.trim() && !(d.rootNode?.children?.length);
    }
    case "BOWTIE": {
      const d = data as BowtieData;
      return !d.topEvent?.trim() && !(d.threats?.length) && !(d.consequences?.length);
    }
    case "TAPROOT": {
      const d = data as TapRootData;
      return !d.eventDescription?.trim() && !(d.snapChart?.length) && !(d.causalFactors?.length);
    }
    case "CAUSE_MAP": {
      const d = data as CauseMapData;
      return !d.rootEvent?.trim() && !(d.impacts?.length) && !(d.causeNodes?.length);
    }
  }
}

// ─── Auto-summary generator ────────────────────────────────────────────
// Plain-English summary used on dashboards / list views / statutory exports.
// Falls back to the method name if the data is empty.
// One clean sentence body: no wrapping whitespace, no leading punctuation, no
// trailing full stop. The generator appends its own "." and " Root cause: ", so
// a problem statement that already ended in a period produced ".." and one
// pasted with a leading ": " opened the summary on a colon. The Python twin
// (app/services/rca.py::_sentence) has always done this; the TypeScript side
// did not, and it is the side that drafts the CAPA summary box.
function sentence(text: string | null | undefined): string {
  let t = (text ?? "").trim();
  while (t.length > 0 && [":", "-", "\u2014", ".", ","].includes(t[0])) {
    t = t.slice(1).trimStart();
  }
  return t.replace(/\s+/g, " ").trimEnd().replace(/\.+$/, "").trimEnd();
}

export function generateRcaSummary(method: RcaMethod | null, data: unknown): string | null {
  if (!method) return null;
  if (data == null || isEmptyRcaData(method, data)) return null;
  switch (method) {
    case "FIVE_WHY": {
      const d = data as FiveWhyData;
      const root = d.rootCause?.trim();
      const lastAnswer = [...(d.whys ?? [])].reverse().find((w) => w.answer?.trim())?.answer?.trim();
      const cause = sentence(root || lastAnswer);
      const problem = sentence(d.problemStatement) || "Incident";
      return `${problem}. Root cause: ${cause || "—"}.`;
    }
    case "FISHBONE": {
      const d = data as FishboneData;
      const root = (d.rootCauses ?? []).map(sentence).filter(Boolean).slice(0, 2).join("; ");
      const allCauses = FISHBONE_KEYS.flatMap((k) => (d.categories?.[k] ?? []));
      const problem = sentence(d.problemStatement) || "Incident";
      return `${problem}. ${allCauses.length} contributing factor(s) identified across 6M categories.${root ? ` Root cause(s): ${root}.` : ""}`;
    }
    case "FTA": {
      const d = data as FtaData;
      function countBasic(n: FtaNode): number {
        if (!n.children?.length) return n.nodeType === "BASIC_EVENT" ? 1 : 0;
        return n.children.reduce((s, c) => s + countBasic(c), 0);
      }
      const occurred = (function findOccurred(n: FtaNode): string[] {
        const here = n.controlActiveAtIncident === false ? [n.description] : [];
        return [...here, ...(n.children ?? []).flatMap(findOccurred)];
      })(d.rootNode).filter(Boolean);
      return `${d.topEvent || "Top event"}. ${countBasic(d.rootNode)} basic event(s) analysed.${occurred.length ? ` Failed controls: ${occurred.slice(0, 3).join("; ")}.` : ""}`;
    }
    case "BOWTIE": {
      const d = data as BowtieData;
      const failed = [
        ...d.threats.flatMap((t) => t.preventiveBarriers.filter((b) => b.status === "FAILED").map((b) => b.description)),
        ...d.consequences.flatMap((c) => c.mitigativeBarriers.filter((b) => b.status === "FAILED").map((b) => b.description))
      ].filter(Boolean);
      return `${d.topEvent || "Top event"}. ${d.threats.length} threat(s), ${d.consequences.length} consequence(s).${failed.length ? ` Barriers that failed: ${failed.slice(0, 3).join("; ")}.` : ""}`;
    }
    case "TAPROOT": {
      const d = data as TapRootData;
      const cfTexts = (d.causalFactors ?? []).map((c) => c.description).filter(Boolean).slice(0, 3);
      return `${d.eventDescription || "Event"}. ${d.causalFactors.length} causal factor(s) identified.${cfTexts.length ? ` Top: ${cfTexts.join("; ")}.` : ""}`;
    }
    case "CAUSE_MAP": {
      const d = data as CauseMapData;
      const impacts = (d.impacts ?? []).join(", ");
      return `${d.rootEvent || "Event"}. Impacts: ${impacts || "—"}. ${d.causeNodes.length} cause node(s) mapped.`;
    }
  }
}

// ─── CAPA bridge: template → CapaRootCause rows + contributingFactors ───
// A CAPA does not store the analysis and nothing else. Its register, its
// pattern detection and its "Why-Why Analysis (N levels)" card are all built
// on two flat fields: `contributingFactors` (every level except the last) and
// CapaRootCause rows (the last one). Reading those back out of the template is
// what stops the same reasoning being typed twice and disagreeing with itself.
//
// Only the levels the analyst actually wrote are returned — nothing is
// invented, and a half-filled template yields a short chain rather than a
// padded one.
export function deriveCapaCauses(
  method: RcaMethod,
  data: unknown
): { contributingFactors: string[]; rootCauses: string[] } {
  const none = { contributingFactors: [], rootCauses: [] };
  if (data == null || typeof data !== "object") return none;
  const clean = (arr: (string | undefined | null)[]) =>
    arr.map((s) => (s ?? "").trim()).filter(Boolean);

  switch (method) {
    case "FIVE_WHY": {
      const d = data as FiveWhyData;
      const answers = clean((d.whys ?? []).map((w) => w.answer));
      const stated = (d.rootCause ?? "").trim();
      // The form's own rule: the last Why IS the root cause. If the analyst
      // also wrote one out explicitly, that wins and every answer stays a
      // contributing level.
      if (stated) return { contributingFactors: answers, rootCauses: [stated] };
      if (answers.length === 0) return none;
      return { contributingFactors: answers.slice(0, -1), rootCauses: answers.slice(-1) };
    }
    case "FISHBONE": {
      const d = data as FishboneData;
      const all = clean(FISHBONE_KEYS.flatMap((k) => d.categories?.[k] ?? []));
      const roots = clean(d.rootCauses ?? []);
      // The dominant causes are marked separately on a fishbone, so they are
      // not also listed as contributing.
      return { contributingFactors: all.filter((c) => !roots.includes(c)), rootCauses: roots };
    }
    case "FTA": {
      const d = data as FtaData;
      const flat: FtaNode[] = [];
      (function walk(n: FtaNode | undefined) {
        if (!n) return;
        flat.push(n);
        (n.children ?? []).forEach(walk);
      })(d.rootNode);
      // A basic event whose control was NOT active at the time is the branch
      // that let the top event through — that is the root cause the tree found.
      const failed = clean(flat.filter((n) => n.controlActiveAtIncident === false).map((n) => n.description));
      const basic = clean(
        flat.filter((n) => n.nodeType === "BASIC_EVENT" && n.controlActiveAtIncident !== false).map((n) => n.description)
      );
      return { contributingFactors: basic, rootCauses: failed };
    }
    case "BOWTIE": {
      const d = data as BowtieData;
      const barriers = [
        ...(d.threats ?? []).flatMap((t) => t.preventiveBarriers ?? []),
        ...(d.consequences ?? []).flatMap((c) => c.mitigativeBarriers ?? [])
      ];
      // A barrier that failed or was absent is the finding; one that worked is
      // context, not a cause.
      const broken = clean(
        barriers.filter((b) => b.status === "FAILED" || b.status === "ABSENT").map((b) => b.description)
      );
      const threats = clean((d.threats ?? []).map((t) => t.description));
      return { contributingFactors: threats, rootCauses: broken };
    }
    case "TAPROOT": {
      const d = data as TapRootData;
      const cfs = clean((d.causalFactors ?? []).map((c) => c.description));
      const roots = clean(
        (d.causalFactors ?? []).flatMap((c) => (c.rootCauseTree ?? []).map((r) => r.rootCause || r.nearRootCause))
      );
      return { contributingFactors: cfs, rootCauses: roots };
    }
    case "CAUSE_MAP": {
      const d = data as CauseMapData;
      const nodes = d.causeNodes ?? [];
      const hasChild = new Set(nodes.map((n) => n.parentId).filter(Boolean) as string[]);
      // A cause nothing is caused-by is where the chain stops — the underlying
      // cause the map was built to reach.
      const leaves = clean(nodes.filter((n) => !hasChild.has(n.id)).map((n) => n.description));
      const inner = clean(nodes.filter((n) => hasChild.has(n.id)).map((n) => n.description));
      return { contributingFactors: inner, rootCauses: leaves };
    }
  }
}
