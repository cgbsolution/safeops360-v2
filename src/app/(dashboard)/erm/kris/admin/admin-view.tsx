"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { KRI_STATUS_CHIP, type KriOut, type MetricCatalogEntry } from "@/app/(dashboard)/erm/lib-p2";

type CategoryLite = { id: string; code: string; name: string };
type RiskLite = { id: string; riskCode: string; title: string };

const FEED_TYPES = ["MANUAL", "MODULE_FED", "API"] as const;
const DIRECTIONS = ["HIGHER_IS_WORSE", "LOWER_IS_WORSE"] as const;
const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"] as const;

const FEED_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  MODULE_FED: "Module-fed",
  API: "API",
};

type FormState = {
  name: string;
  description: string;
  categoryId: string;
  linkedRiskIds: string[];
  unit: string;
  direction: string;
  frequency: string;
  feedType: string;
  metricProviderKey: string | null;
  thresholdGreen: string;
  thresholdAmber: string;
  ownerId: string | null;
  graceDays: string;
  isActive: boolean;
};

function emptyForm(categories: CategoryLite[]): FormState {
  return {
    name: "",
    description: "",
    categoryId: categories[0]?.id ?? "",
    linkedRiskIds: [],
    unit: "",
    direction: "HIGHER_IS_WORSE",
    frequency: "MONTHLY",
    feedType: "MANUAL",
    metricProviderKey: null,
    thresholdGreen: "",
    thresholdAmber: "",
    ownerId: null,
    graceDays: "5",
    isActive: true,
  };
}

function fromKri(k: KriOut): FormState {
  return {
    name: k.name,
    description: k.description,
    categoryId: k.categoryId,
    linkedRiskIds: k.linkedRiskIds ?? [],
    unit: k.unit,
    direction: k.direction,
    frequency: k.frequency,
    feedType: k.feedType,
    metricProviderKey: k.metricProviderKey,
    thresholdGreen: String(k.thresholdGreen),
    thresholdAmber: String(k.thresholdAmber),
    ownerId: k.ownerId,
    graceDays: String(k.graceDays),
    isActive: k.isActive,
  };
}

export function KriAdminView({
  kris,
  categories,
  catalogue,
  risks,
}: {
  kris: KriOut[];
  categories: CategoryLite[];
  catalogue: MetricCatalogEntry[];
  risks: RiskLite[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<null | { mode: "new" } | { mode: "edit"; kri: KriOut }>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing({ mode: "new" })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-800"
        >
          <Plus size={14} /> New KRI
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5">
        {kris.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No KRIs defined yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Direction</th>
                <th className="px-2 py-2">Feed</th>
                <th className="px-2 py-2">Thresholds</th>
                <th className="px-2 py-2">Owner</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Active</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {kris.map((k) => (
                <tr key={k.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">
                    <Link href={`/erm/kris/${k.id}`} className="font-medium text-primary-700 hover:underline">
                      {k.kriCode}
                    </Link>
                  </td>
                  <td className="max-w-[220px] truncate px-2 py-2 text-slate-700">{k.name}</td>
                  <td className="px-2 py-2 text-xs text-slate-600">{k.categoryName ?? "—"}</td>
                  <td className="px-2 py-2 text-xs text-slate-600">
                    {k.direction === "HIGHER_IS_WORSE" ? "↑ worse" : "↓ worse"}
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600">{FEED_LABEL[k.feedType] ?? k.feedType}</td>
                  <td className="px-2 py-2 text-xs tabular-nums text-slate-600">
                    G {k.thresholdGreen} / A {k.thresholdAmber}
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600">{k.ownerName ?? "—"}</td>
                  <td className="px-2 py-2">
                    <span
                      className={
                        "rounded border px-2 py-0.5 text-[11px] font-semibold " +
                        (KRI_STATUS_CHIP[k.currentStatus] ?? KRI_STATUS_CHIP.NO_DATA)
                      }
                    >
                      {k.currentStatus === "NO_DATA" ? "NO DATA" : k.currentStatus}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {k.isActive ? (
                      <span className="text-emerald-600">Active</span>
                    ) : (
                      <span className="text-slate-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => setEditing({ mode: "edit", kri: k })}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-primary-500"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <KriFormModal
          mode={editing.mode}
          kri={editing.mode === "edit" ? editing.kri : null}
          categories={categories}
          catalogue={catalogue}
          risks={risks}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function KriFormModal({
  mode,
  kri,
  categories,
  catalogue,
  risks,
  onClose,
  onDone,
}: {
  mode: "new" | "edit";
  kri: KriOut | null;
  categories: CategoryLite[];
  catalogue: MetricCatalogEntry[];
  risks: RiskLite[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [f, setF] = useState<FormState>(kri ? fromKri(kri) : emptyForm(categories));
  const [busy, setBusy] = useState(false);
  const [riskQuery, setRiskQuery] = useState("");

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => setF((p) => ({ ...p, [key]: val }));

  const selectedMetric = useMemo(
    () => catalogue.find((c) => c.key === f.metricProviderKey) ?? null,
    [catalogue, f.metricProviderKey],
  );

  const filteredRisks = useMemo(() => {
    const q = riskQuery.trim().toLowerCase();
    if (!q) return risks;
    return risks.filter((r) => r.riskCode.toLowerCase().includes(q) || r.title.toLowerCase().includes(q));
  }, [risks, riskQuery]);

  function toggleRisk(id: string) {
    set(
      "linkedRiskIds",
      f.linkedRiskIds.includes(id) ? f.linkedRiskIds.filter((x) => x !== id) : [...f.linkedRiskIds, id],
    );
  }

  async function submit() {
    setBusy(true);
    const body = {
      name: f.name,
      description: f.description,
      categoryId: f.categoryId,
      linkedRiskIds: f.linkedRiskIds,
      unit: f.unit,
      direction: f.direction,
      frequency: f.frequency,
      feedType: f.feedType,
      metricProviderKey: f.feedType === "MODULE_FED" ? f.metricProviderKey : null,
      thresholdGreen: Number(f.thresholdGreen),
      thresholdAmber: Number(f.thresholdAmber),
      ownerId: f.ownerId,
      graceDays: Number(f.graceDays),
      isActive: f.isActive,
    };
    const res = await fetch(mode === "edit" && kri ? `/api/erm/kris/${kri.id}` : `/api/erm/kris`, {
      method: mode === "edit" ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.detail || j.error || `Failed (${res.status})`);
      return;
    }
    onDone();
  }

  const directionNote =
    f.direction === "HIGHER_IS_WORSE"
      ? "Higher is worse: GREEN ≤ green threshold ≤ AMBER ≤ amber threshold < RED. Green threshold should be the lower number."
      : "Lower is worse: GREEN ≥ green threshold ≥ AMBER ≥ amber threshold > RED. Green threshold should be the higher number.";

  const valid =
    f.name.trim() && f.categoryId && f.thresholdGreen !== "" && f.thresholdAmber !== "" && f.ownerId &&
    (f.feedType !== "MODULE_FED" || !!f.metricProviderKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{mode === "edit" ? "Edit KRI" : "New KRI"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Name (required)">
            <input
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="e.g. Overdue safety actions"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Category">
              <select
                value={f.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit">
              <input
                value={f.unit}
                onChange={(e) => set("unit", e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                placeholder="e.g. count, %, days"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Direction">
              <select
                value={f.direction}
                onChange={(e) => set("direction", e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              >
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d === "HIGHER_IS_WORSE" ? "Higher is worse" : "Lower is worse"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Frequency">
              <select
                value={f.frequency}
                onChange={(e) => set("frequency", e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              >
                {FREQUENCIES.map((fr) => (
                  <option key={fr} value={fr}>
                    {fr.charAt(0) + fr.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Feed type">
              <select
                value={f.feedType}
                onChange={(e) => set("feedType", e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              >
                {FEED_TYPES.map((ft) => (
                  <option key={ft} value={ft}>
                    {FEED_LABEL[ft]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {f.feedType === "MODULE_FED" && (
            <Field label="Metric provider (module-fed source)">
              <select
                value={f.metricProviderKey ?? ""}
                onChange={(e) => set("metricProviderKey", e.target.value || null)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              >
                <option value="">— select a metric —</option>
                {catalogue.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label} ({c.sourceModule})
                  </option>
                ))}
              </select>
              {selectedMetric && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                  <div className="font-medium text-slate-700">{selectedMetric.label}</div>
                  <div className="mt-0.5">
                    Preview:{" "}
                    <span className="font-semibold tabular-nums">
                      {selectedMetric.previewValue != null ? selectedMetric.previewValue : "—"}
                    </span>{" "}
                    {selectedMetric.unit} · {selectedMetric.frequency} ·{" "}
                    {selectedMetric.direction === "HIGHER_IS_WORSE" ? "↑ worse" : "↓ worse"}
                  </div>
                </div>
              )}
            </Field>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Green threshold">
              <input
                type="number"
                value={f.thresholdGreen}
                onChange={(e) => set("thresholdGreen", e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              />
            </Field>
            <Field label="Amber threshold">
              <input
                type="number"
                value={f.thresholdAmber}
                onChange={(e) => set("thresholdAmber", e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              />
            </Field>
            <Field label="Grace days">
              <input
                type="number"
                value={f.graceDays}
                onChange={(e) => set("graceDays", e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              />
            </Field>
          </div>
          <p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">{directionNote}</p>

          <Field label="Owner (required)">
            <UserPicker value={f.ownerId} onChange={(id) => set("ownerId", id)} placeholder="Select KRI owner" />
          </Field>

          <Field label={`Linked risks (${f.linkedRiskIds.length} selected)`}>
            <input
              value={riskQuery}
              onChange={(e) => setRiskQuery(e.target.value)}
              placeholder="Filter risks by code or title…"
              className="mb-2 w-full rounded-lg border border-slate-300 p-2 text-sm"
            />
            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200">
              {filteredRisks.length === 0 ? (
                <p className="p-3 text-center text-xs text-slate-400">No risks match.</p>
              ) : (
                filteredRisks.map((r) => (
                  <label
                    key={r.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={f.linkedRiskIds.includes(r.id)}
                      onChange={() => toggleRisk(r.id)}
                    />
                    <span className="font-medium text-primary-700">{r.riskCode}</span>
                    <span className="truncate text-slate-600">{r.title}</span>
                  </label>
                ))
              )}
            </div>
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            Active
          </label>

          <button
            disabled={busy || !valid}
            onClick={submit}
            className="w-full rounded-lg bg-primary-700 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
          >
            {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Create KRI"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
