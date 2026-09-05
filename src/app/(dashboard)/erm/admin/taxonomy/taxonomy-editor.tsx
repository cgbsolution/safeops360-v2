"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight } from "lucide-react";
import type { Category } from "@/app/(dashboard)/erm/lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

type SubCategory = Category["subCategories"][number];

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
    | { kind: "edit-sub"; category: Category; sub: SubCategory }
  >(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);

  async function send(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(`/api/erm/${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
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

  async function toggleSubActive(s: SubCategory) {
    await send(`sub-categories/${s.id}`, "PATCH", { isActive: !s.isActive });
  }

  async function deleteSub(s: SubCategory) {
    if (!confirm(`Delete sub-category "${s.code} — ${s.name}"? This cannot be undone.`)) return;
    await send(`sub-categories/${s.id}`, "DELETE");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {categories.length} categor{categories.length === 1 ? "y" : "ies"} ·{" "}
          {categories.reduce((n, c) => n + c.subCategories.length, 0)} sub-categories
        </span>
        <Button type="button" onClick={() => setModal({ kind: "new-category" })} className="gap-1.5">
          <Plus size={16} /> New Category
        </Button>
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
                  <Label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                    <Checkbox
                      checked={c.isActive}
                      disabled={busy}
                      onChange={() => toggleActive(c)}
                    />
                    Active
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModal({ kind: "edit-category", category: c })}
                    className="h-auto gap-1 px-2.5 py-1.5 text-xs font-medium"
                  >
                    <Pencil size={13} /> Edit
                  </Button>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setExpanded((p) => ({ ...p, [c.id]: !open }))}
                  className="h-auto gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-transparent hover:text-slate-700"
                >
                  {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  Sub-categories ({c.subCategories.length})
                </Button>
                {open && (
                  <div className="mt-2 space-y-1.5">
                    {c.subCategories.length === 0 ? (
                      <p className="text-xs text-slate-400">No sub-categories yet.</p>
                    ) : (
                      c.subCategories.map((s) => (
                        <Card
                          key={s.id}
                          className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 shadow-none">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 rounded bg-white px-1.5 py-0.5 text-[11px] font-mono font-medium text-slate-600 ring-1 ring-slate-200">
                              {s.code}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-slate-700">{s.name}</span>
                                {!s.isActive && (
                                  <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                                    inactive
                                  </span>
                                )}
                              </div>
                              {/* Full definition (no longer truncated) so the detail
                                  that was defined is fully viewable. */}
                              {s.description && (
                                <p className="mt-0.5 text-xs text-slate-500">{s.description}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Label
                                className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-slate-500"
                                title="Active">
                                <Checkbox
                                  checked={s.isActive}
                                  disabled={busy}
                                  onChange={() => toggleSubActive(s)}
                                  className="h-3.5 w-3.5"
                                />
                              </Label>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setModal({ kind: "edit-sub", category: c, sub: s })}
                                className="h-auto gap-1 rounded px-2 py-1 text-[11px] font-medium"
                              >
                                <Pencil size={12} /> Edit
                              </Button>
                              {/* Compact hover-red delete icon (p-1, 13px) inside a dense repeated row —
                                  the always-on solid `destructive` fill would be visually louder than
                                  the original subtle hover-only treatment across every sub-category row;
                                  left raw rather than guess. */}
                              <Button variant="outline"
                                onClick={() => deleteSub(s)}
                                disabled={busy} className="rounded p-1"
                                title="Delete sub-category">
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setModal({ kind: "new-sub", category: c })}
                      className="h-auto gap-1 rounded-lg border-dashed px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-primary-500 hover:text-primary-700"
                    >
                      <Plus size={13} /> Add sub-category
                    </Button>
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
      {modal?.kind === "edit-sub" && (
        <SubCategoryModal
          category={modal.category}
          busy={busy}
          initial={{
            code: modal.sub.code,
            name: modal.sub.name,
            description: modal.sub.description ?? "",
            isActive: modal.sub.isActive,
          }}
          onClose={() => setModal(null)}
          // code is immutable — patch name/description/isActive only
          onSubmit={(f) =>
            send(`sub-categories/${modal.sub.id}`, "PATCH", {
              name: f.name,
              description: f.description,
              isActive: f.isActive,
            })
          }
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 text-slate-400 hover:text-slate-700"
          >
            <X size={18} />
          </Button>
        </div>
        {children}
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
            <Input
              value={f.code}
              onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
              className="font-mono"
              placeholder="OPS"
            />
          </Field>
          <Field label="Display order">
            <Input
              type="number"
              value={f.displayOrder}
              onChange={(e) => setF({ ...f, displayOrder: Number(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="Name (required)">
          <Input
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="Operational"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            rows={2}
          />
        </Field>
        <div className="flex items-end gap-4">
          <Field label="Colour">
            {/* type=color has no Input equivalent — native swatch control, left raw */}
            <Input
              type="color"
              value={f.colorHex}
              onChange={(e) => setF({ ...f, colorHex: e.target.value })}
              className="h-10 w-16 cursor-pointer rounded-lg border border-slate-300" />
          </Field>
          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-600">{f.colorHex}</span>
          <Label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <Checkbox
              checked={f.isActive}
              onChange={(e) => setF({ ...f, isActive: e.target.checked })}
            />
            Active
          </Label>
        </div>
        <Button
          type="button"
          disabled={busy || !valid}
          onClick={() => onSubmit(f)}
          className="w-full"
        >
          {busy ? "Saving…" : "Save category"}
        </Button>
      </div>
    </Modal>
  );
}

function SubCategoryModal({
  category,
  initial,
  busy,
  onClose,
  onSubmit,
}: {
  category: Category;
  initial?: SubForm;
  busy: boolean;
  onClose: () => void;
  onSubmit: (f: SubForm) => void;
}) {
  const isEdit = !!initial;
  const [f, setF] = useState<SubForm>(initial ?? { code: "", name: "", description: "", isActive: true });
  const valid = f.code.trim() && f.name.trim();
  return (
    <Modal title={isEdit ? `Edit ${f.code}` : `Add sub-category to ${category.code}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label={isEdit ? "Code (not editable — referenced by rollup rules)" : "Code (required)"}>
          <Input
            value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
            disabled={isEdit}
            className={cn("font-mono", isEdit && "cursor-not-allowed bg-slate-100 text-slate-500")}
            placeholder="OPS-HSE"
          />
        </Field>
        <Field label="Name (required)">
          <Input
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="Health, Safety & Environment"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            rows={2}
          />
        </Field>
        <Label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
          <Checkbox
            checked={f.isActive}
            onChange={(e) => setF({ ...f, isActive: e.target.checked })}
          />
          Active
        </Label>
        <Button
          type="button"
          disabled={busy || !valid}
          onClick={() => onSubmit(f)}
          className="w-full"
        >
          {busy ? "Saving…" : isEdit ? "Save changes" : "Add sub-category"}
        </Button>
      </div>
    </Modal>
  );
}
