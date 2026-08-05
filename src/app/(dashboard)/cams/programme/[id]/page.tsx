import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { resolveUsers, type UserDirectory } from "@/lib/users/user-ref";
import { ProgrammeDetailView } from "./programme-detail";
import type {
  AmendmentRow,
  ApprovalReport,
  CoverageResponse,
  IntegrityReport,
  ProgrammeRow,
  RecommendationRow,
  ReviewRow,
  ScopeUnitRow,
  SlotRow,
  VarianceRow,
} from "../lib-programme";

export const dynamic = "force-dynamic";

const f = <T,>(v: T) => () => v;

export default async function ProgrammeDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("CAMS.READ");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const rawCycle = sp.cycle;
  const requestedCycle = Array.isArray(rawCycle) ? rawCycle[0] : rawCycle;

  const list = await backendFetch<{ items: ProgrammeRow[] }>("/api/programme").catch(
    f({ items: [] as ProgrammeRow[] }),
  );
  const programme = list.items.find((p) => p.id === id);
  if (!programme) notFound();

  // Default to the ACTIVE cycle — the one a reader almost always wants — then
  // the most recent. The switcher covers everything else.
  const cycle =
    programme.cycles.find((c) => c.id === requestedCycle) ??
    programme.cycles.find((c) => c.status === "ACTIVE") ??
    programme.cycles[0] ??
    null;

  let coverage: CoverageResponse | null = null;
  let variance: VarianceRow[] = [];
  let amendments: AmendmentRow[] = [];
  let integrity: IntegrityReport | null = null;
  let slots: SlotRow[] = [];
  let scopeUnits: ScopeUnitRow[] = [];
  let recommendations: RecommendationRow[] = [];
  let reviews: ReviewRow[] = [];
  let approval: ApprovalReport | null = null;
  let userDir: UserDirectory = {};

  if (cycle) {
    const base = `/api/programme/cycles/${cycle.id}`;
    const [c, v, a, i, s, u, r, rv, ap] = await Promise.all([
      backendFetch<CoverageResponse>(`${base}/coverage`).catch(f<CoverageResponse | null>(null)),
      backendFetch<{ items: VarianceRow[] }>(`${base}/variance`).catch(
        f({ items: [] as VarianceRow[] }),
      ),
      backendFetch<{ items: AmendmentRow[] }>(`${base}/amendments`).catch(
        f({ items: [] as AmendmentRow[] }),
      ),
      backendFetch<IntegrityReport>(`${base}/integrity`).catch(f<IntegrityReport | null>(null)),
      backendFetch<{ items: SlotRow[] }>(`${base}/slots`).catch(f({ items: [] as SlotRow[] })),
      backendFetch<{ items: ScopeUnitRow[] }>(`${base}/scope-units`).catch(
        f({ items: [] as ScopeUnitRow[] }),
      ),
      // GET, not POST — reading the screen must never trigger a recompute.
      backendFetch<{ items: RecommendationRow[] }>(`${base}/recommendations`).catch(
        f({ items: [] as RecommendationRow[] }),
      ),
      // The §5.6 review record. It gates closure, and the detail page did not
      // even fetch it — so the one thing standing between an active cycle and a
      // closed one was invisible.
      backendFetch<{ items: ReviewRow[] }>(`${base}/reviews`).catch(
        f({ items: [] as ReviewRow[] }),
      ),
      // Read-only preview of the same guard `approve_cycle` enforces.
      backendFetch<ApprovalReport>(`${base}/approval-report`).catch(f<ApprovalReport | null>(null)),
    ]);
    coverage = c;
    variance = v.items;
    amendments = a.items;
    integrity = i;
    slots = s.items;
    scopeUnits = u.items;
    recommendations = r.items;
    reviews = rv.items;
    approval = ap;

    userDir = await resolveUsers([
      programme.ownerUserId,
      cycle.submittedByUserId,
      cycle.approvedByUserId,
      ...slots.map((s) => s.intendedLeadUserId),
      ...amendments.map((a) => a.approvedByUserId),
      ...reviews.flatMap((r) => [r.reviewedByUserId, ...r.participantUserIds]),
      ...(coverage?.auditorLoad ?? []).map((l) => l.userId),
    ]);
  }

  return (
    <div>
      <PageHeader
        title={programme.name}
        description={programme.objectives || undefined}
        breadcrumbs={[
          { label: "Audit & Compliance", href: "/cams/audits" },
          { label: "Programme", href: "/cams/programme" },
          { label: programme.programmeCode },
        ]}
      />
      <ProgrammeDetailView
        programme={programme}
        cycle={cycle}
        coverage={coverage}
        variance={variance}
        amendments={amendments}
        integrity={integrity}
        slots={slots}
        scopeUnits={scopeUnits}
        recommendations={recommendations}
        reviews={reviews}
        approval={approval}
        userDir={userDir}
      />
    </div>
  );
}
