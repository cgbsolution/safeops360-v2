"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Upload, Download, ChevronDown, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import {
  type WizardSubmission,
  type WizardCategory,
  type DepartmentOption,
  type ContractorOption
} from "./wizard-types";
import {
  createCategory,
  patchCategory,
  deleteCategory,
  importCategoryCsv,
  fetchSubmission
} from "./wizard-api";
import { generateCsvTemplate } from "@/lib/manhours/csv";

type Kind = "PERMANENT" | "CONTRACT" | "TRAINEE";

const KIND_META: Record<Kind, { title: string; subtitle: string; entityLabel: string }> = {
  PERMANENT: {
    title: "Step 2 — Permanent Employee Manhours",
    subtitle: "Per-department breakdown for permanent staff. Sum must match Step 1's permanent strength × hours.",
    entityLabel: "Department"
  },
  CONTRACT: {
    title: "Step 3 — Contract Workmen Manhours",
    subtitle: "Per-contractor-company breakdown. Critical for vendor scoring and statutory contractor returns.",
    entityLabel: "Contractor company"
  },
  TRAINEE: {
    title: "Step 4 — Trainee / Apprentice Manhours",
    subtitle: "Trainees and apprentices, by department. Tracked separately from permanent staff for statutory reporting.",
    entityLabel: "Department"
  }
};

interface RowState extends WizardCategory {
  _dirty: boolean;
  _saving: boolean;
  _error: string | null;
}

export function StepCategories({
  submission,
  kind,
  departments,
  contractors,
  onSaved,
  isReadOnly
}: {
  submission: WizardSubmission;
  kind: Kind;
  departments: DepartmentOption[];
  contractors: ContractorOption[];
  onSaved: (s: WizardSubmission) => void;
  isReadOnly: boolean;
}) {
  const meta = KIND_META[kind];
  const initialRows = useMemo(
    () =>
      submission.categories
        .filter((c) => c.categoryType === kind)
        .map((c) => ({ ...c, _dirty: false, _saving: false, _error: null as string | null })),
    [submission.categories, kind]
  );
  const [rows, setRows] = useState<RowState[]>(initialRows);
  const [adding, setAdding] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  // Reset rows whenever the upstream submission changes (e.g. after
  // a CSV import that replaces all rows). This is the cheapest way
  // to keep local + server state in sync without a controlled vs.
  // uncontrolled tug-of-war.
  const upstreamSig = submission.categories.filter((c) => c.categoryType === kind).map((c) => c.id).join("|");
  const lastSig = useRef(upstreamSig);
  if (lastSig.current !== upstreamSig) {
    lastSig.current = upstreamSig;
    setRows(initialRows);
  }

  const subtotal = rows.reduce((s, r) => s + (r.regularHours + r.overtimeHours), 0);
  const subtotalHeadcount = rows.reduce((s, r) => s + r.endOfPeriodHeadcount, 0);

  function patchRowLocal(id: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, _dirty: true } : r)));
  }

  async function saveRow(row: RowState) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, _saving: true, _error: null } : r)));
    try {
      await patchCategory(submission.id, row.id, {
        departmentId: row.departmentId,
        contractorCompanyId: row.contractorCompanyId,
        shiftId: row.shiftId,
        averageHeadcount: row.averageHeadcount,
        peakHeadcount: row.peakHeadcount,
        endOfPeriodHeadcount: row.endOfPeriodHeadcount,
        regularHours: row.regularHours,
        overtimeHours: row.overtimeHours,
        notes: row.notes
      });
      const fresh = await fetchSubmission(submission.id);
      onSaved(fresh);
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, _saving: false, _error: e?.message ?? "Save failed" } : r))
      );
    }
  }

  async function removeRow(row: RowState) {
    if (!confirm(`Delete this ${meta.entityLabel.toLowerCase()} row? Totals will recompute.`)) return;
    try {
      await deleteCategory(submission.id, row.id);
      const fresh = await fetchSubmission(submission.id);
      onSaved(fresh);
    } catch (e: any) {
      alert(e?.message ?? "Delete failed");
    }
  }

  async function addRow(payload: {
    departmentId: string | null;
    contractorCompanyId: string | null;
    shiftId: string | null;
    averageHeadcount: number;
    peakHeadcount: number;
    endOfPeriodHeadcount: number;
    regularHours: number;
    overtimeHours: number;
    notes: string | null;
  }) {
    try {
      await createCategory(submission.id, { categoryType: kind, ...payload });
      const fresh = await fetchSubmission(submission.id);
      onSaved(fresh);
      setAdding(false);
    } catch (e: any) {
      alert(e?.message ?? "Create failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{meta.title}</h2>
        <p className="text-sm text-slate-500 mt-1">{meta.subtitle}</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed bg-slate-50 p-6 text-center text-sm text-slate-500">
          No {meta.entityLabel.toLowerCase()} rows yet. Add one below or use bulk import.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">{meta.entityLabel}</th>
                <th className="px-3 py-2 text-right" title="Average headcount across the period">Avg HC</th>
                <th className="px-3 py-2 text-right" title="Peak headcount on any day">Peak HC</th>
                <th className="px-3 py-2 text-right" title="Headcount on the last day of the period">End HC</th>
                <th className="px-3 py-2 text-right">Regular Hrs</th>
                <th className="px-3 py-2 text-right">OT Hrs</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <RowEditor
                  key={r.id}
                  row={r}
                  kind={kind}
                  departments={departments}
                  contractors={contractors}
                  onPatch={(patch) => patchRowLocal(r.id, patch)}
                  onSave={() => saveRow(r)}
                  onDelete={() => removeRow(r)}
                  isReadOnly={isReadOnly}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-right">Subtotal ({rows.length} row{rows.length === 1 ? "" : "s"})</td>
                <td colSpan={2}></td>
                <td className="px-3 py-2 text-right tabular-nums">{subtotalHeadcount}</td>
                <td colSpan={2}></td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(subtotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!isReadOnly && (
        <div className="flex items-center gap-2">
          {!adding ? (
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus size={16} /> Add row
            </Button>
          ) : (
            <NewRowEditor
              kind={kind}
              departments={departments}
              contractors={contractors}
              onCancel={() => setAdding(false)}
              onCreate={addRow}
            />
          )}
        </div>
      )}

      {/* CSV bulk import */}
      <div className="rounded-md border bg-slate-50">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-slate-700"
          onClick={() => setCsvOpen((x) => !x)}
        >
          <span className="flex items-center gap-2">
            {csvOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Bulk import via CSV
          </span>
          <span className="text-xs text-slate-500">Replaces all current {kind.toLowerCase()} rows</span>
        </button>
        {csvOpen && (
          <CsvImportPanel
            submissionId={submission.id}
            kind={kind}
            departments={departments}
            contractors={contractors}
            onImported={async () => {
              const fresh = await fetchSubmission(submission.id);
              onSaved(fresh);
            }}
            isReadOnly={isReadOnly}
          />
        )}
      </div>
    </div>
  );
}

// ── Row editor (existing rows) ──────────────────────────────────

function RowEditor({
  row,
  kind,
  departments,
  contractors,
  onPatch,
  onSave,
  onDelete,
  isReadOnly
}: {
  row: RowState;
  kind: Kind;
  departments: DepartmentOption[];
  contractors: ContractorOption[];
  onPatch: (patch: Partial<RowState>) => void;
  onSave: () => void;
  onDelete: () => void;
  isReadOnly: boolean;
}) {
  const total = (row.regularHours || 0) + (row.overtimeHours || 0);
  const entityName =
    kind === "CONTRACT"
      ? row.contractorCompany?.name ?? "(contractor)"
      : row.department?.name ?? "(department)";

  return (
    <tr className={row._dirty ? "bg-amber-50" : ""}>
      <td className="px-3 py-2">
        <div className="font-medium">{entityName}</div>
        {row.notes && <div className="text-xs text-slate-500 mt-0.5">{row.notes}</div>}
        {row._error && <div className="text-xs text-rose-700 mt-0.5">{row._error}</div>}
      </td>
      <td className="px-3 py-2">
        <NumCell value={row.averageHeadcount} onChange={(v) => onPatch({ averageHeadcount: v })} disabled={isReadOnly} />
      </td>
      <td className="px-3 py-2">
        <NumCell value={row.peakHeadcount} onChange={(v) => onPatch({ peakHeadcount: v })} disabled={isReadOnly} />
      </td>
      <td className="px-3 py-2">
        <NumCell
          value={row.endOfPeriodHeadcount}
          onChange={(v) => onPatch({ endOfPeriodHeadcount: v })}
          disabled={isReadOnly}
        />
      </td>
      <td className="px-3 py-2">
        <NumCell value={row.regularHours} onChange={(v) => onPatch({ regularHours: v })} disabled={isReadOnly} />
      </td>
      <td className="px-3 py-2">
        <NumCell value={row.overtimeHours} onChange={(v) => onPatch({ overtimeHours: v })} disabled={isReadOnly} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatNumber(total)}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {row._dirty && !isReadOnly && (
            <Button size="sm" onClick={onSave} disabled={row._saving}>
              {row._saving ? "…" : "Save"}
            </Button>
          )}
          {!isReadOnly && (
            <Button size="sm" variant="ghost" onClick={onDelete} title="Delete row">
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function NumCell({
  value,
  onChange,
  disabled
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(Number(e.target.value || 0))}
      disabled={disabled}
      className="h-8 w-24 text-right tabular-nums"
    />
  );
}

// ── New-row editor ──────────────────────────────────────────────

function NewRowEditor({
  kind,
  departments,
  contractors,
  onCancel,
  onCreate
}: {
  kind: Kind;
  departments: DepartmentOption[];
  contractors: ContractorOption[];
  onCancel: () => void;
  onCreate: (payload: {
    departmentId: string | null;
    contractorCompanyId: string | null;
    shiftId: string | null;
    averageHeadcount: number;
    peakHeadcount: number;
    endOfPeriodHeadcount: number;
    regularHours: number;
    overtimeHours: number;
    notes: string | null;
  }) => void;
}) {
  const [departmentId, setDepartmentId] = useState<string>("");
  const [contractorCompanyId, setContractorCompanyId] = useState<string>("");
  const [average, setAverage] = useState(0);
  const [peak, setPeak] = useState(0);
  const [end, setEnd] = useState(0);
  const [reg, setReg] = useState(0);
  const [ot, setOt] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  function submit() {
    setSubmitting(true);
    onCreate({
      departmentId: kind === "CONTRACT" ? null : departmentId || null,
      contractorCompanyId: kind === "CONTRACT" ? contractorCompanyId || null : null,
      shiftId: null,
      averageHeadcount: average,
      peakHeadcount: peak,
      endOfPeriodHeadcount: end,
      regularHours: reg,
      overtimeHours: ot,
      notes: null
    });
    setSubmitting(false);
  }

  const canSubmit =
    kind === "CONTRACT"
      ? !!contractorCompanyId
      : !!departmentId;

  return (
    <div className="grid sm:grid-cols-7 gap-2 w-full rounded-md border bg-white p-3">
      <div className="sm:col-span-2">
        {kind === "CONTRACT" ? (
          <Select value={contractorCompanyId} onChange={(e) => setContractorCompanyId(e.target.value)}>
            <option value="">Select contractor…</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        ) : (
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Select department…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <Input type="number" min={0} placeholder="Avg HC" value={average} onChange={(e) => setAverage(Number(e.target.value || 0))} />
      <Input type="number" min={0} placeholder="Peak HC" value={peak} onChange={(e) => setPeak(Number(e.target.value || 0))} />
      <Input type="number" min={0} placeholder="End HC" value={end} onChange={(e) => setEnd(Number(e.target.value || 0))} />
      <Input type="number" min={0} placeholder="Reg hrs" value={reg} onChange={(e) => setReg(Number(e.target.value || 0))} />
      <Input type="number" min={0} placeholder="OT hrs" value={ot} onChange={(e) => setOt(Number(e.target.value || 0))} />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={!canSubmit || submitting}>
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── CSV import panel ────────────────────────────────────────────

function CsvImportPanel({
  submissionId,
  kind,
  departments,
  contractors,
  onImported,
  isReadOnly
}: {
  submissionId: string;
  kind: Kind;
  departments: DepartmentOption[];
  contractors: ContractorOption[];
  onImported: () => Promise<void>;
  isReadOnly: boolean;
}) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; imported: number; replaced: number; errors: { row: number; message: string }[] }
    | { ok: false; message: string; errors?: { row: number; message: string }[] }
    | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const codes =
      kind === "CONTRACT"
        ? contractors.map((c) => c.code ?? c.name)
        : departments.map((d) => d.code ?? d.name);
    const text = generateCsvTemplate(kind, codes);
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manhours-${kind.toLowerCase()}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    const text = await file.text();
    setCsv(text);
  }

  async function doImport() {
    if (!csv.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await importCategoryCsv(submissionId, kind, csv);
      setResult({ ok: true, ...r });
      await onImported();
    } catch (e: any) {
      setResult({ ok: false, message: e?.message ?? "Import failed", errors: e?.errors });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 px-4 pb-4">
      <div className="text-xs text-slate-600">
        CSV format: <code className="bg-white border px-1">{kind === "CONTRACT" ? "contractorCode" : "departmentCode"},averageHeadcount,peakHeadcount,endOfPeriodHeadcount,regularHours,overtimeHours,notes</code>.
        Codes are matched against the plant's masters (case-insensitive) — codes that don't resolve are reported as errors.
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={downloadTemplate}>
          <Download size={14} /> Download template
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isReadOnly}
        >
          <Upload size={14} /> Choose file…
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.currentTarget.value = "";
          }}
        />
      </div>

      <Textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder="Or paste CSV here…"
        rows={6}
        className="font-mono text-xs"
        disabled={isReadOnly}
      />

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Importing replaces ALL current {kind.toLowerCase()} rows. Re-import to fix mistakes.
        </div>
        <Button size="sm" onClick={doImport} disabled={busy || !csv.trim() || isReadOnly}>
          {busy ? "Importing…" : "Import"}
        </Button>
      </div>

      {result?.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Imported {result.imported} row{result.imported === 1 ? "" : "s"} (replaced {result.replaced}).
          {result.errors.length > 0 && (
            <ul className="mt-2 text-xs list-disc list-inside">
              {result.errors.map((e, i) => (
                <li key={i}>{e.row > 0 ? `Row ${e.row}: ` : ""}{e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {result && !result.ok && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {result.message}
          {result.errors && result.errors.length > 0 && (
            <ul className="mt-2 text-xs list-disc list-inside">
              {result.errors.map((e, i) => (
                <li key={i}>{e.row > 0 ? `Row ${e.row}: ` : ""}{e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
