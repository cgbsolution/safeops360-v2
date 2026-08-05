// ─────────────────────────────────────────────────────────────────────────────
// Step 25 — Anomaly Detection Records
//
// Per plant (NW + SW): 5 AI-detected anomalies covering all detector types:
//   FREQUENCY_SPIKE | SEVERITY_DRIFT | HOTSPOT_CLUSTER |
//   PERSON_OF_CONCERN | CROSS_CORRELATION
//
// Statuses: PENDING_REVIEW, ACKNOWLEDGED, CONFIRMED, DISMISSED
//
// Idempotent: deletes records with matching fingerprints before recreating.
// Run: npx tsx prisma/seed-anomalies.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-07T08:00:00.000Z");
function daysAgo(n: number) { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d; }

const NW_PLANT = "cmq42hc7b000913589h1l7q23";
const SW_PLANT = "cmq42hch7000p1358qc91ieav";
const HSE_MGR_NW = "cmq42hhjw002o1358mzpjpr5i";
const HSE_MGR_SW = "cmq42hn9y004s13582w1z3yaf";
const WORKER_NW  = "cmq42hgxb002e13585csfjcg2"; // contractor-workman.hr.nw
const WORKER_SW  = "cmq42hmdl004i1358lak42jl2"; // contractor-workman.hr.sw

const FINGERPRINTS = [
  "ANOM-NW-FREQ-SPIKE-01", "ANOM-NW-SEV-DRIFT-01", "ANOM-NW-HOTSPOT-01",
  "ANOM-NW-PERSON-01",     "ANOM-NW-CROSS-CORR-01",
  "ANOM-SW-FREQ-SPIKE-01", "ANOM-SW-SEV-DRIFT-01", "ANOM-SW-HOTSPOT-01",
  "ANOM-SW-PERSON-01",     "ANOM-SW-CROSS-CORR-01",
];

interface AnomalySpec {
  detectorId: string;
  module: string;
  plantId: string;
  category?: string;
  area?: string;
  personId?: string;
  severity: string;
  signalData: object;
  description: string;
  contributingRecordIds: string[];
  status: string;
  reviewerId?: string;
  reviewedAt?: Date;
  reviewNote?: string;
  fingerprint: string;
  detectedAt: Date;
}

function makeAnomaly(spec: AnomalySpec) {
  return spec;
}

async function main() {
  console.log("Deleting existing anomaly demo records…");
  await prisma.anomaly.deleteMany({ where: { fingerprint: { in: FINGERPRINTS } } });

  const anomalies: AnomalySpec[] = [
    // ── NW ──
    makeAnomaly({
      detectorId: "FREQUENCY_SPIKE",
      module: "OBSERVATION",
      plantId: NW_PLANT,
      category: "UNSAFE_ACT",
      area: "Process Area A — Primary Production",
      severity: "CRITICAL",
      signalData: {
        window: "2026-W22",
        observed: 18,
        expected: 6.2,
        zScore: 4.7,
        ratio: 2.9,
        baselinePeriodWeeks: 12,
      },
      description:
        "Frequency spike detected: 18 UNSAFE_ACT observations in Process Area A this week vs. 6.2 expected (z-score 4.7). HSE Manager alerted.",
      contributingRecordIds: [
        "cmq4upzpk0001d9agaveadyt7",
        "cmq4upzuh0003d9agvkdiir8v",
        "cmq4upzzu0005d9ageapdrpyj",
      ],
      status: "CONFIRMED",
      reviewerId: HSE_MGR_NW,
      reviewedAt: daysAgo(2),
      reviewNote: "Confirmed — toolbox talk scheduled, additional supervision deployed to PA-A.",
      fingerprint: "ANOM-NW-FREQ-SPIKE-01",
      detectedAt: daysAgo(5),
    }),

    makeAnomaly({
      detectorId: "SEVERITY_DRIFT",
      module: "OBSERVATION",
      plantId: NW_PLANT,
      category: "UNSAFE_CONDITION",
      area: "Utilities Block (Boiler, Compressors, Cooling)",
      severity: "WARNING",
      signalData: {
        window: "2026-04 to 2026-06",
        observedAvgSeverity: 3.4,
        baselineAvgSeverity: 2.1,
        drift: 1.3,
        trendWeeks: 6,
        pValue: 0.03,
      },
      description:
        "Severity drift in Utilities Block: average observation severity has risen from 2.1 to 3.4 over 6 weeks. Statistically significant (p=0.03).",
      contributingRecordIds: ["cmq4uq0470007d9agtofep99u"],
      status: "ACKNOWLEDGED",
      reviewerId: HSE_MGR_NW,
      reviewedAt: daysAgo(1),
      reviewNote: "Under review — engineering walkdown booked for this week.",
      fingerprint: "ANOM-NW-SEV-DRIFT-01",
      detectedAt: daysAgo(3),
    }),

    makeAnomaly({
      detectorId: "HOTSPOT_CLUSTER",
      module: "OBSERVATION",
      plantId: NW_PLANT,
      area: "Chemical Storage & Handling Area",
      severity: "CRITICAL",
      signalData: {
        clusterRadius: "15m",
        clusterCenter: { lat: 22.4871, lng: 88.3632 },
        pointsInCluster: 9,
        expectedInRadius: 2,
        daysWindow: 30,
        topCategory: "UNSAFE_CONDITION",
      },
      description:
        "Hotspot cluster: 9 observations within 15 m of Chemical Storage main bay in 30 days (expected 2). Risk of chemical exposure event is elevated.",
      contributingRecordIds: [
        "cmq4upzpk0001d9agaveadyt7",
        "cmq4upzuh0003d9agvkdiir8v",
      ],
      status: "PENDING_REVIEW",
      fingerprint: "ANOM-NW-HOTSPOT-01",
      detectedAt: daysAgo(1),
    }),

    makeAnomaly({
      detectorId: "PERSON_OF_CONCERN",
      module: "OBSERVATION",
      plantId: NW_PLANT,
      personId: WORKER_NW,
      severity: "WARNING",
      signalData: {
        personObservationCount30d: 7,
        personObservationCountBaseline: 1.8,
        unsafeActCount: 5,
        nearMissLinked: 1,
        escalationTriggered: false,
      },
      description:
        "Worker flagged as person of concern: 7 observations in 30 days (baseline 1.8), 5 classified as UNSAFE_ACT, 1 linked near miss.",
      contributingRecordIds: [],
      status: "PENDING_REVIEW",
      fingerprint: "ANOM-NW-PERSON-01",
      detectedAt: daysAgo(0),
    }),

    makeAnomaly({
      detectorId: "CROSS_CORRELATION",
      module: "OBSERVATION",
      plantId: NW_PLANT,
      area: "Maintenance Workshop",
      severity: "WARNING",
      signalData: {
        correlationPair: ["OBSERVATION:HOT_WORK", "NEAR_MISS:FIRE_FLASH"],
        pearsonR: 0.81,
        lagDays: 3,
        correlationWindowWeeks: 8,
        samplesConsidered: 24,
      },
      description:
        "Cross-correlation detected: Hot-Work observations in Maintenance Workshop correlate strongly (r=0.81) with fire-flash near misses 3 days later.",
      contributingRecordIds: [],
      status: "DISMISSED",
      reviewerId: HSE_MGR_NW,
      reviewedAt: daysAgo(7),
      reviewNote: "Dismissed — correlation coincident with planned shutdown period. Will re-evaluate next quarter.",
      fingerprint: "ANOM-NW-CROSS-CORR-01",
      detectedAt: daysAgo(10),
    }),

    // ── SW ──
    makeAnomaly({
      detectorId: "FREQUENCY_SPIKE",
      module: "OBSERVATION",
      plantId: SW_PLANT,
      category: "UNSAFE_ACT",
      area: "Process Area A — Primary Production",
      severity: "WARNING",
      signalData: {
        window: "2026-W23",
        observed: 11,
        expected: 5.8,
        zScore: 2.9,
        ratio: 1.9,
        baselinePeriodWeeks: 12,
      },
      description:
        "Frequency spike in SW Process Area A: 11 UNSAFE_ACT observations this week vs. 5.8 expected (z-score 2.9).",
      contributingRecordIds: [],
      status: "PENDING_REVIEW",
      fingerprint: "ANOM-SW-FREQ-SPIKE-01",
      detectedAt: daysAgo(2),
    }),

    makeAnomaly({
      detectorId: "SEVERITY_DRIFT",
      module: "OBSERVATION",
      plantId: SW_PLANT,
      category: "NEAR_MISS",
      area: "Utilities Block (Boiler, Compressors, Cooling)",
      severity: "CRITICAL",
      signalData: {
        window: "2026-03 to 2026-06",
        observedAvgSeverity: 4.1,
        baselineAvgSeverity: 2.3,
        drift: 1.8,
        trendWeeks: 10,
        pValue: 0.01,
      },
      description:
        "Severity drift in SW Utilities Block: average severity 4.1 vs. baseline 2.3 over 10 weeks (p=0.01). Escalated to Plant Head.",
      contributingRecordIds: [],
      status: "CONFIRMED",
      reviewerId: HSE_MGR_SW,
      reviewedAt: daysAgo(4),
      reviewNote: "Confirmed systemic issue — full Utilities audit initiated.",
      fingerprint: "ANOM-SW-SEV-DRIFT-01",
      detectedAt: daysAgo(7),
    }),

    makeAnomaly({
      detectorId: "HOTSPOT_CLUSTER",
      module: "OBSERVATION",
      plantId: SW_PLANT,
      area: "Loading / Dispatch Area",
      severity: "WARNING",
      signalData: {
        clusterRadius: "20m",
        clusterCenter: { lat: 22.4721, lng: 88.3490 },
        pointsInCluster: 6,
        expectedInRadius: 1.5,
        daysWindow: 30,
        topCategory: "UNSAFE_CONDITION",
      },
      description:
        "Hotspot cluster at SW Loading / Dispatch Area: 6 observations in 30 days within 20 m radius (expected 1.5). Forklift interaction risk elevated.",
      contributingRecordIds: [],
      status: "ACKNOWLEDGED",
      reviewerId: HSE_MGR_SW,
      reviewedAt: daysAgo(3),
      reviewNote: "Traffic management review in progress.",
      fingerprint: "ANOM-SW-HOTSPOT-01",
      detectedAt: daysAgo(5),
    }),

    makeAnomaly({
      detectorId: "PERSON_OF_CONCERN",
      module: "OBSERVATION",
      plantId: SW_PLANT,
      personId: WORKER_SW,
      severity: "WARNING",
      signalData: {
        personObservationCount30d: 5,
        personObservationCountBaseline: 1.2,
        unsafeActCount: 4,
        nearMissLinked: 0,
        escalationTriggered: false,
      },
      description:
        "SW worker flagged: 5 observations in 30 days (baseline 1.2), 4 classified as UNSAFE_ACT.",
      contributingRecordIds: [],
      status: "PENDING_REVIEW",
      fingerprint: "ANOM-SW-PERSON-01",
      detectedAt: daysAgo(1),
    }),

    makeAnomaly({
      detectorId: "CROSS_CORRELATION",
      module: "OBSERVATION",
      plantId: SW_PLANT,
      area: "Confined Space Zones (Vessels, Tanks, Pits)",
      severity: "CRITICAL",
      signalData: {
        correlationPair: ["OBSERVATION:UNSAFE_CONDITION:CONFINED_SPACE", "INCIDENT:ASPHYXIATION"],
        pearsonR: 0.88,
        lagDays: 5,
        correlationWindowWeeks: 12,
        samplesConsidered: 18,
      },
      description:
        "HIGH RISK: Confined space unsafe-condition observations correlate with asphyxiation incidents (r=0.88, lag 5 days). Immediate review required.",
      contributingRecordIds: [],
      status: "CONFIRMED",
      reviewerId: HSE_MGR_SW,
      reviewedAt: daysAgo(2),
      reviewNote: "Confined space PTW protocol review initiated. All entries suspended pending audit.",
      fingerprint: "ANOM-SW-CROSS-CORR-01",
      detectedAt: daysAgo(4),
    }),
  ];

  for (const a of anomalies) {
    await prisma.anomaly.create({
      data: {
        detectedAt: a.detectedAt,
        detectorId: a.detectorId,
        module: a.module,
        plantId: a.plantId,
        category: a.category,
        area: a.area,
        personId: a.personId,
        severity: a.severity,
        signalData: a.signalData,
        description: a.description,
        contributingRecordIds: a.contributingRecordIds,
        status: a.status,
        reviewerId: a.reviewerId,
        reviewedAt: a.reviewedAt,
        reviewNote: a.reviewNote,
        fingerprint: a.fingerprint,
        emailNotifiedAt: a.severity === "CRITICAL" ? new Date(a.detectedAt.getTime() + 5 * 60000) : undefined,
      },
    });
  }

  console.log(`✅  Created ${anomalies.length} anomaly records (${anomalies.length / 2} per plant)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
