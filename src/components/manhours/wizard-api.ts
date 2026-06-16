// Tiny client-side wrapper around the manhours-submissions API.
// Centralises the URL + error-handling shape so step components
// can stay focused on UI.

import type { WizardSubmission } from "./wizard-types";

export async function patchSubmission(
  id: string,
  patch: Record<string, unknown>
): Promise<WizardSubmission> {
  const res = await fetch(`/api/manhours-submissions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw await asError(res);
  const json = await res.json();
  return json.submission as WizardSubmission;
}

export async function createCategory(
  submissionId: string,
  payload: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`/api/manhours-submissions/${submissionId}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw await asError(res);
  return (await res.json()).category;
}

export async function patchCategory(
  submissionId: string,
  catId: string,
  patch: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`/api/manhours-submissions/${submissionId}/categories/${catId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw await asError(res);
  return (await res.json()).category;
}

export async function deleteCategory(submissionId: string, catId: string): Promise<void> {
  const res = await fetch(`/api/manhours-submissions/${submissionId}/categories/${catId}`, {
    method: "DELETE"
  });
  if (!res.ok) throw await asError(res);
}

export async function importCategoryCsv(
  submissionId: string,
  categoryType: "PERMANENT" | "CONTRACT" | "TRAINEE",
  csv: string
): Promise<{ imported: number; replaced: number; errors: { row: number; message: string }[] }> {
  const res = await fetch(`/api/manhours-submissions/${submissionId}/categories/import-csv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryType, csv })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const e: any = new Error(body.error ?? `HTTP ${res.status}`);
    e.errors = body.errors ?? [];
    throw e;
  }
  return res.json();
}

export async function putVisitors(
  submissionId: string,
  payload: { totalVisitorCount: number; totalVisitorHours: number; notableVisits: string | null }
): Promise<unknown> {
  const res = await fetch(`/api/manhours-submissions/${submissionId}/visitors`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw await asError(res);
  return (await res.json()).visitors;
}

export async function fetchSubmission(id: string): Promise<WizardSubmission> {
  const res = await fetch(`/api/manhours-submissions/${id}`, { cache: "no-store" });
  if (!res.ok) throw await asError(res);
  const json = await res.json();
  return json.submission as WizardSubmission;
}

export async function fetchValidation(id: string) {
  const res = await fetch(`/api/manhours-submissions/${id}/validate`, { cache: "no-store" });
  if (!res.ok) throw await asError(res);
  return (await res.json()).report;
}

export async function submitSubmission(
  id: string,
  submissionNotes: string | null
): Promise<{ submission: WizardSubmission; report: unknown }> {
  const res = await fetch(`/api/manhours-submissions/${id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionNotes })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const e: any = new Error(body.error ?? `HTTP ${res.status}`);
    e.report = body.report;
    throw e;
  }
  return res.json();
}

async function asError(res: Response): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  return new Error(body.error ?? `HTTP ${res.status}`);
}
