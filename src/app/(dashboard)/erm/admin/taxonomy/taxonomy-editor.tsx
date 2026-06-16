"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Plus, Pencil, X, ChevronDown, ChevronRight } from "lucide-react";
import type { Category } from "@/app/(dashboard)/erm/lib";

type CategoryForm = {
  code: string;
  name: string;
  description: string;
  colorHex: string;
  displayOrder: number;
  isActive: boolean;
};

type SubForm = { code: string; name: string; description: string; isActive: boolean };

export function TaxonomyEditor({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<
    | null
    | { kind: "new-category" }
    | { kind: "edit-category"; category: Category }
    | { kind: "new-sub"; category: Category }
  >(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);

  async function send(path: string, method: "POST" | "PATCH", body: unknown) {
    setBusy(true);
    try {
      const res = await fetch(`/api/erm/${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.detail || j.error || `Failed (${res.status})`);
        return false;
      }
      setModal(null);
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c: Category) {
    await send(`categories/${c.id}`, "PATCH", {
      code: c.code,
      name: c.name,
      description: c.description,
      colorHex: c.colorHex,
      displayOrder: c.displayOrder,
      isActive: !c.isActive,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {categories.length} categor{categories.length === 1 ? "y" : "ies"} ·{" "}
          {categories.reduce((n, c) => n + c.subCategories.length, 0)} sub-categories
        </span>
        <button
          onClick={() => setModal({ kind: "new-category" })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-2 text-sm font-medium text-white hover:bg-primary-800"
        >
          <Plus size={16} /> New Category
        </button>
      </div>

      <div className="space-y-2.5">
        {sorted.map((c) => {
          const open = expanded[c.id] ?? false;
          return (
            <div
              key={c.id}
              className={
                "rounded-xl border bg-white p-5 transition-colors " +
                (c.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50/60 opacity-75")
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-md ring-1 ring-inset ring-slate-200"
                    style={{ backgroundColor: c.colorHex }}
                    title={c.colorHex}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-700">
                        {c.code}
                      </span>
                      <span className="font-semibold text-slate-900">{c.name}</span>
                      {c.isSystemCategory && (
                        <span
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500"
                          title="System category — can only be deactivated, not deleted"
                        >
                          <Lock size={11} /> System
                        </span>
                      )}
                      {!c.isActive && (
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                          Inactive
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">order {c.displayOrder}</span>
                    </div>
                    {c.description && <p className="mt-1 text-xs text-slate-500">{c.description}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={c.isActive}
                      disabled={busy}
                      onChange={() => toggleActive(c)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-700 focus:ring-primary-500"
                    />
                    Active
                  </label>
                  <button
                    onClick={() => setModal({ kind: "edit-category", category: c })}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-primary-500"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [c.id]: !open }))}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                >
                  {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  Sub-categories ({c.subCategories.length})
                </button>
                {open && (
                  <div className="mt-2 space-y-1.5">
                    {c.subCategories.length === 0 ? (
                      <p className="text-xs text-slate-400">No sub-categories yet.</p>
                    ) : (
                      c.subCategories.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-1.5"
                        >
                          <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-mono font-medium text-slate-600 ring-1 ring-slate-200">
                            {s.code}
                          </span>
                          <span className="text-sm text-slate-700">{s.name}</span>
                          {!s.isActive && (
                            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                              inactive
                            </span>
                          )}
                          {s.description && (
                            <span className="ml-auto truncate text-xs italic text-slate-400">{s.description}</span>
                          )}
                        </div>
                      ))
                    )}
                    <button
                      onClick={() => setModal({ kind: "new-sub", category: c })}
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-primary-500 hover:text-primary-700"
                    >
                      <Plus size={13} /> Add sub-category
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modal?.kind === "new-category" && (
        <CategoryModal
          title="New category"
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(f) => send("categories", "POST", f)}
        />
      )}
      {modal?.kind === "edit-category" && (
        <CategoryModal
          title={`Edit ${modal.category.code}`}
          busy={busy}
          initial={{
            code: modal.category.code,
            name: modal.category.name,
            description: modal.category.description,
            colorHex: modal.category.colorHex,
            displayOrder: modal.category.displayOrder,
            isActive: modal.category.isActive,
          }}
          onClose={() => setModal(null)}
          onSubmit={(f) => send(`categories/${modal.category.id}`, "PATCH", f)}
        />
      )}
      {modal?.kind === "new-sub" && (
        <SubCategoryModal
          category={modal.category}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(f) => send("sub-categories", "POST", { categoryId: modal.category.id, ...f })}
        />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        {children}
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

function CategoryModal({
  title,
  initial,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: CategoryForm;
  busy: boolean;
  onClose: () => void;
  onSubmit: (f: CategoryForm) => void;
}) {
  const [f, setF] = useState<CategoryForm>(
    initial ?? { code: "", name: "", description: "", colorHex: "#1E6FB8", displayOrder: 0, isActive: true },
  );
  const valid = f.code.trim() && f.name.trim();
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code (required)">
            <input
              value={f.code}
              onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm font-mono"
              placeholder="OPS"
            />
          </Field>
          <Field label="Display order">
            <input
              type="number"
              value={f.displayOrder}
              onChange={(e) => setF({ ...f, displayOrder: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            />
          </Field>
        </div>
        <Field label="Name (required)">
          <input
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            placeholder="Operational"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </Field>
        <div className="flex items-end gap-4">
          <Field label="Colour">
            <input
              type="color"
              value={f.colorHex}
              onChange={(e) => setF({ ...f, colorHex: e.target.value })}
              className="h-10 w-16 cursor-pointer rounded-lg border border-slate-300"
            />
          </Field>
          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-600">{f.colorHex}</span>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={f.isActive}
              onChange={(e) => setF({ ...f, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-primary-700 focus:ring-primary-500"
            />
            Active
          </label>
        </div>
        <button
          disabled={busy || !valid}
          onClick={() => onSubmit(f)}
          className="w-full rounded-lg bg-primary-700 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save category"}
        </button>
      </div>
    </Modal>
  );
}

function SubCategoryModal({
  category,
  busy,
  onClose,
  onSubmit,
}: {
  category: Category;
  busy: boolean;
  onClose: () => void;
  onSubmit: (f: SubForm) => void;
}) {
  const [f, setF] = useState<SubForm>({ code: "", name: "", description: "", isActive: true });
  const valid = f.code.trim() && f.name.trim();
  return (
    <Modal title={`Add sub-category to ${category.code}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Code (required)">
          <input
            value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm font-mono"
            placeholder="OPS-HSE"
          />
        </Field>
        <Field label="Name (required)">
          <input
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            placeholder="Health, Safety & Environment"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </Field>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={f.isActive}
            onChange={(e) => setF({ ...f, isActive: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-primary-700 focus:ring-primary-500"
          />
          Active
        </label>
        <button
          disabled={busy || !valid}
          onClick={() => onSubmit(f)}
          className="w-full rounded-lg bg-primary-700 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add sub-category"}
        </button>
      </div>
    </Modal>
  );
}
