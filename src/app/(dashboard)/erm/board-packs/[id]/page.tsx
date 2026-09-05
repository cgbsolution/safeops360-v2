import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import type {
  BoardPack,
  DashboardSummary,
  TopRiskRow,
  MovementRow,
} from "@/app/(dashboard)/erm/lib";
import type { Tier3Summary } from "@/app/(dashboard)/erm/lib-t3";
import { BoardPackEditor } from "./editor-view";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

// Mirrors S.BoardPackRender (app/schemas/erm.py). BoardPackRender is not
// exported from lib.ts, so it is composed here from the shared lib types.
export type AcceptanceLogRow = {
  riskCode: string;
  title: string;
  justification: string | null;
  acceptedBy: string | null;
  acceptedAt: string | null;
};

export type EscalationRow = {
  riskCode: string;
  title: string;
  residualBand: string | null;
  escalatedAt: string | null;
};

export type NewRiskRow = {
  riskCode: string;
  title: string;
  residualBand: string | null;
};

export type BoardPackRender = {
  pack: BoardPack;
  summary: DashboardSummary;
  topRisks: TopRiskRow[];
  acceptanceLog: AcceptanceLogRow[];
  escalations: EscalationRow[];
  newRisks: NewRiskRow[];
  movement: MovementRow[];
  generatedAt: string;
  tenantName: string;
};

export type BoardPackPhase2 = {
  kriStatus: { kriCode: string; name: string; status: string; value: number | null; unit: string; categoryCode: string | null }[];
  appetiteCompliance: any[];
  appetiteBreaches: any[];
  lossSummary: { netLossByCategory: { categoryCode: string; categoryName: string; colorHex: string; netLoss: number }[]; topLosses: { eventCode: string; title: string; netLoss: number }[] };
  complianceStatus: { compliantPct: number; overdue: number; dueSoon: number; expiring: { obligationCode: string; title: string; daysToExpiry: number | null }[] };
};

export type BoardPackPhase3 = {
  bcmReadiness: {
    coveragePct: number; coveredCritical: number; totalCritical: number; unmitigatedSpofs: number;
    coverageGaps: { processCode: string; name: string; criticality: string; siteId: string | null }[];
    plansReviewDue: number; exercisesOverdue: number; openExerciseCapas: number; activeCrises: number;
  };
  scenarios: { scenarioCode: string; title: string; category: string; probabilityQualitative: string; mitigationReadiness: string; topImpactLevel: number }[];
  horizon: { title: string; category: string; signalStrength: string; disposition: string | null }[];
};

export default async function BoardPackEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let render: BoardPackRender | null = null;
  let phase2: BoardPackPhase2 | null = null;
  let phase3: BoardPackPhase3 | null = null;
  let tier3: Tier3Summary | null = null;
  let error: string | null = null;
  try {
    [render, phase2, phase3, tier3] = await Promise.all([
      backendFetch<BoardPackRender>(`/api/erm/board-packs/${id}/render`),
      backendFetch<BoardPackPhase2>("/api/erm/board-pack-phase2").catch(() => null),
      backendFetch<BoardPackPhase3>("/api/erm/board-pack-phase3").catch(() => null),
      backendFetch<Tier3Summary>("/api/erm/tier3-summary").catch(() => null),
    ]);
  } catch (e: any) {
    error = e?.message ?? "Failed to load board pack";
  }

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title={render?.pack.title ?? "Board Pack"}
          breadcrumbs={[
            { label: "Enterprise Risk", href: "/erm" },
            { label: "Board Packs", href: "/erm/board-packs" },
            { label: render?.pack.quarterLabel ?? "Pack" },
          ]}
          description="Configure which sections render, add per-risk board commentary, then publish or print the pack."
        />
      </div>

      {error || !render ? (
        <Alert variant="destructive" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 print:hidden">
          {error ?? "Board pack not found."}
        </Alert>
      ) : (
        <BoardPackEditor packId={id} initial={render} phase2={phase2} phase3={phase3} tier3={tier3} />
      )}
    </div>
  );
}
