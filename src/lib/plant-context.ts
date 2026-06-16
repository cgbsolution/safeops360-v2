/**
 * Plant context resolution for pages that need a plant scope.
 *
 * Resolution order:
 *   1. URL `?plantId=` (explicit override — wins)
 *   2. `session.user.plantId` (the user's home plant)
 *   3. First accessible plant from backend (cross-plant users — fall back
 *      to a sensible default so the page renders something)
 *
 * Pages get back the resolved plantId, a list of plants the user can
 * switch to (for the picker UI), and a hint flag if no plant could be
 * resolved (page should render an empty-state).
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendFetch } from "@/lib/backend/fetch";

export type PlantOption = {
  id: string;
  code: string;
  name: string;
};

export type PlantContext = {
  plantId: string | null;
  plants: PlantOption[];
  isOverride: boolean; // true when ?plantId= was used (so the picker reflects it)
};

export async function resolvePlantContext(
  urlPlantId: string | undefined | null
): Promise<PlantContext> {
  const session = await getServerSession(authOptions);
  const sessionPlantId = (session?.user as any)?.plantId ?? null;

  // Pull plants the user can see. The HIRA wizard endpoint returns the
  // accessible-plants list already; reuse it so we don't need a new
  // backend endpoint just for this.
  let plants: PlantOption[] = [];
  try {
    const opts = await backendFetch<{ plants: PlantOption[] }>(
      "/api/hira/wizard/study-options"
    ).catch(() => ({ plants: [] }));
    plants = opts.plants ?? [];
  } catch {
    plants = [];
  }

  let resolved: string | null = null;
  let isOverride = false;

  if (urlPlantId) {
    resolved = urlPlantId;
    isOverride = true;
  } else if (sessionPlantId) {
    resolved = sessionPlantId;
  } else if (plants.length > 0) {
    resolved = plants[0].id;
  }

  return { plantId: resolved, plants, isOverride };
}
