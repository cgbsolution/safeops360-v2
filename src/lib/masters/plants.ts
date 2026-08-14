// ─────────────────────────────────────────────────────────────────────
// Plant / Area master data for the create-form dropdowns.
//
// Replaces the `prisma.plant.findMany({ include: { areas: true } })` that
// every "New <record>" page used to run for itself. The backend returns only
// the plants the caller may act in, so a user can no longer be offered a plant
// in the dropdown that the create endpoint would then reject.
//
// React.cache'd: a page that renders two pickers (or a form plus a sidebar)
// shares one HTTP round-trip per request, the same way the Prisma version
// shared one query.
// ─────────────────────────────────────────────────────────────────────

import { cache } from "react";
import { backendFetch } from "@/lib/backend/fetch";

export interface AreaOption {
  id: string;
  name: string;
  plantId: string;
}

export interface PlantOption {
  id: string;
  code: string;
  name: string;
  location: string | null;
  state: string | null;
  unitType: string | null;
}

export interface PlantWithAreas extends PlantOption {
  areas: AreaOption[];
}

/** Accessible plants, name-ordered. Use when the form has no area picker. */
export const getPlants = cache(async (): Promise<PlantOption[]> =>
  backendFetch<PlantOption[]>("/api/plants")
);

/** Accessible plants with their areas nested — one call, not one per plant. */
export const getPlantsWithAreas = cache(async (): Promise<PlantWithAreas[]> =>
  backendFetch<PlantWithAreas[]>("/api/plants", { query: { includeAreas: true } })
);

/** Areas of a single plant. The backend rejects plants outside the caller's scope. */
export const getPlantAreas = cache(async (plantId: string): Promise<AreaOption[]> =>
  backendFetch<AreaOption[]>(`/api/plants/${plantId}/areas`)
);
