import { backendFetch } from "@/lib/backend/fetch";
import type { DailyBriefPayload } from "@/lib/daily-brief/types";
import { DailyBrief } from "./daily-brief";

export const dynamic = "force-dynamic";

// The Daily Brief — Executive Sentinel (spec §0–§4): a severity-ranked,
// cross-module, role-lensed rollup of the same Alert pool (reactive event cards
// + proactive insight-sentinel cards) ranked by the Brief Priority Score. Server
// renders the first payload; the client keeps it live by re-polling the whole
// aggregate (no WebSocket path exists through the Vercel proxy — DECISIONS D6).
const LENSES = ["executive", "hse_manager", "site_lead"];

export default async function DailyBriefPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const window = sp.window === "7d" ? "7d" : "24h";
  const query: Record<string, string> = { window };
  if (sp.siteId) query.siteId = sp.siteId;
  if (sp.role && LENSES.includes(sp.role)) query.role = sp.role;

  let payload: DailyBriefPayload | null = null;
  let loadError: string | null = null;
  try {
    payload = await backendFetch<DailyBriefPayload>("/api/dashboard/daily-brief", { query });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load the daily brief";
  }

  if (loadError || !payload) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {loadError ?? "Could not load the daily brief"}
      </div>
    );
  }

  return <DailyBrief initial={payload} />;
}
