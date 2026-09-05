"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { UserPicker } from "@/components/ui/user-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { KRI_STATUS_CHIP, type KriOut, type MetricCatalogEntry } from "@/app/(dashboard)/erm/lib-p2";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

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
        <Button onClick={() => setEditing({ mode: "new" })}>
          <Plus size={14} /> New KRI
        </Button>
      </div>

      <Card className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 shadow-none">
        {kris.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No KRIs defined yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Feed</TableHead>
                <TableHead>Thresholds</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kris.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>
                    <Link href={`/erm/kris/${k.id}`} className="font-medium text-primary-700 hover:underline">
                      {k.kriCode}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">{k.name}</TableCell>
                  <TableCell className="text-xs text-slate-600">{k.categoryName ?? "—"}</TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {k.direction === "HIGHER_IS_WORSE" ? "↑ worse" : "↓ worse"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">{FEED_LABEL[k.feedType] ?? k.feedType}</TableCell>
                  <TableCell className="text-xs tabular-nums text-slate-600">
                    G {k.thresholdGreen} / A {k.thresholdAmber}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">{k.ownerName ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className={
                        "rounded border px-2 py-0.5 text-[11px] font-semibold " +
                        (KRI_STATUS_CHIP[k.currentStatus] ?? KRI_STATUS_CHIP.NO_DATA)
                      }
                    >
                      {k.currentStatus === "NO_DATA" ? "NO DATA" : k.currentStatus}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {k.isActive ? (
                      <span className="text-emerald-600">Active</span>
                    ) : (
                      <span className="text-slate-400">Inactive</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing({ mode: "edit", kri: k })}
                      className="text-slate-700 hover:border-primary-500"
                    >
                      <Pencil size={11} /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="space-y-4">
          <Field label="Name (required)">
            <Input
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Overdue safety actions"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Category">
              <SelectField
                value={f.categoryId}
                onChange={(value) => set("categoryId", value)}
                options={categories.map((c) => ({ value: c.id, label: `${c.name}` }))}
              />
            </Field>
            <Field label="Unit">
              <Input
                value={f.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="e.g. count, %, days"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Direction">
              <SelectField
                value={f.direction}
                onChange={(value) => set("direction", value)}
                options={DIRECTIONS.map((d) => ({ value: d, label: `${d === "HIGHER_IS_WORSE" ? "Higher is worse" : "Lower is worse"}` }))}
              />
            </Field>
            <Field label="Frequency">
              <SelectField
                value={f.frequency}
                onChange={(value) => set("frequency", value)}
                options={FREQUENCIES.map((fr) => ({ value: fr, label: `${fr.charAt(0) + fr.slice(1).toLowerCase()}` }))}
              />
            </Field>
            <Field label="Feed type">
              <SelectField
                value={f.feedType}
                onChange={(value) => set("feedType", value)}
                options={FEED_TYPES.map((ft) => ({ value: ft, label: `${FEED_LABEL[ft]}` }))}
              />
            </Field>
          </div>

          {f.feedType === "MODULE_FED" && (
            <Field label="Metric provider (module-fed source)">
              <SelectField
                value={f.metricProviderKey ?? ""}
                onChange={(value) => set("metricProviderKey", value || null)}
                placeholder="— select a metric —"
                options={catalogue.map((c) => ({ value: c.key, label: `${c.label} (${c.sourceModule})` }))}
              />
              {selectedMetric && (
                <Card className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 shadow-none">
                  <div className="font-medium text-slate-700">{selectedMetric.label}</div>
                  <div className="mt-0.5">
                    Preview:{" "}
                    <span className="font-semibold tabular-nums">
                      {selectedMetric.previewValue != null ? selectedMetric.previewValue : "—"}
                    </span>{" "}
                    {selectedMetric.unit} · {selectedMetric.frequency} ·{" "}
                    {selectedMetric.direction === "HIGHER_IS_WORSE" ? "↑ worse" : "↓ worse"}
                  </div>
                </Card>
              )}
            </Field>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Green threshold">
              <Input
                type="number"
                value={f.thresholdGreen}
                onChange={(e) => set("thresholdGreen", e.target.value)}
              />
            </Field>
            <Field label="Amber threshold">
              <Input
                type="number"
                value={f.thresholdAmber}
                onChange={(e) => set("thresholdAmber", e.target.value)}
              />
            </Field>
            <Field label="Grace days">
              <Input
                type="number"
                value={f.graceDays}
                onChange={(e) => set("graceDays", e.target.value)}
              />
            </Field>
          </div>
          <p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">{directionNote}</p>

          <Field label="Owner (required)">
            <UserPicker value={f.ownerId} onChange={(id) => set("ownerId", id)} placeholder="Select KRI owner" />
          </Field>

          <Field label={`Linked risks (${f.linkedRiskIds.length} selected)`}>
            <Input
              value={riskQuery}
              onChange={(e) => setRiskQuery(e.target.value)}
              placeholder="Filter risks by code or title…"
              className="mb-2"
            />
            <Card className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 shadow-none">
              {filteredRisks.length === 0 ? (
                <p className="p-3 text-center text-xs text-slate-400">No risks match.</p>
              ) : (
                filteredRisks.map((r) => (
                  <Label
                    key={r.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-sm last:border-b-0 hover:bg-slate-50">
                    <Checkbox
                      checked={f.linkedRiskIds.includes(r.id)}
                      onChange={() => toggleRisk(r.id)}
                    />
                    <span className="font-medium text-primary-700">{r.riskCode}</span>
                    <span className="truncate text-slate-600">{r.title}</span>
                  </Label>
                ))
              )}
            </Card>
          </Field>

          <Label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            Active
          </Label>

          <Button
            type="button"
            disabled={busy || !valid}
            onClick={submit}
            className="w-full"
          >
            {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Create KRI"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}
