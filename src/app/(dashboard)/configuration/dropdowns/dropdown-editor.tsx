"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronUp, ChevronDown, Save, Eye, EyeOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";

type Item = {
  id?: string;
  code: string;
  label: string;
  sortOrder: number;
  active: boolean;
  metadata?: any;
  // ephemeral
  isNew?: boolean;
  dirty?: boolean;
};

export function DropdownEditor({ type, initialItems }: { type: string; initialItems: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  function addRow() {
    setItems([
      ...items,
      {
        code: "",
        label: "",
        sortOrder: items.length + 1,
        active: true,
        isNew: true,
        dirty: true
      }
    ]);
  }

  function update(idx: number, patch: Partial<Item>) {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch, dirty: true };
    setItems(next);
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    next.forEach((it, i) => { it.sortOrder = i + 1; it.dirty = true; });
    setItems(next);
  }

  async function saveRow(idx: number) {
    const it = items[idx];
    if (!it.code.trim() || !it.label.trim()) {
      setError("Code and label are required.");
      return;
    }
    setBusy(it.id ?? `new-${idx}`);
    setError("");
    const url = it.id ? `/api/admin/master-items/${it.id}` : "/api/admin/master-items";
    const method = it.id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        code: it.code.trim().toUpperCase().replace(/\s+/g, "_"),
        label: it.label.trim(),
        sortOrder: it.sortOrder,
        active: it.active,
        metadata: it.metadata ?? null
      })
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Save failed (${res.status}).`);
      return;
    }
    const saved = await res.json();
    const next = [...items];
    next[idx] = { ...saved, dirty: false, isNew: false };
    setItems(next);
    router.refresh();
  }

  async function saveAll() {
    setError("");
    const dirty = items.map((it, idx) => ({ it, idx })).filter(({ it }) => it.dirty);
    for (const { idx } of dirty) {
      await saveRow(idx);
    }
  }

  async function remove(idx: number) {
    const it = items[idx];
    if (!it.id) {
      // unsaved — just drop
      setItems(items.filter((_, i) => i !== idx));
      return;
    }
    if (!confirm(`Delete "${it.label}"? Forms that reference this code will lose the option.`)) return;
    setBusy(it.id);
    const res = await fetch(`/api/admin/master-items/${it.id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      setItems(items.filter((_, i) => i !== idx));
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Delete failed.");
    }
  }

  async function toggleActive(idx: number) {
    const it = items[idx];
    const newActive = !it.active;
    update(idx, { active: newActive });
    if (it.id) {
      setBusy(it.id);
      const res = await fetch(`/api/admin/master-items/${it.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive })
      });
      setBusy(null);
      if (!res.ok) {
        update(idx, { active: !newActive });
        setError("Failed to update active state.");
      } else {
        router.refresh();
      }
    }
  }

  const hasDirty = items.some((it) => it.dirty);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Values ({items.length})</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={addRow}>
              <Plus size={14} /> Add value
            </Button>
            {hasDirty && (
              <Button onClick={saveAll}>
                <Save size={14} /> Save changes
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">
            No values yet. Click <strong>Add value</strong> to create the first one.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wide text-slate-500 px-2">
              <div className="col-span-1">Order</div>
              <div className="col-span-3">Code</div>
              <div className="col-span-5">Label</div>
              <div className="col-span-2">Active</div>
              <div className="col-span-1"></div>
            </div>
            {items.map((it, idx) => (
              <div
                key={it.id ?? `new-${idx}`}
                className={[
                  "grid grid-cols-12 gap-2 items-center p-2 rounded-md border",
                  it.dirty ? "border-amber-300 bg-amber-50/30" : "border-slate-200",
                  !it.active ? "opacity-60" : ""
                ].join(" ")}
              >
                <div className="col-span-1 flex flex-col items-center">
                  <Button type="button" variant="ghost" size="icon" onClick={() => move(idx, -1)} disabled={idx === 0}
                    aria-label="Move option up" title="Move option up" className="h-auto w-auto p-0 text-slate-400 hover:bg-transparent hover:text-slate-700">
                    <ChevronUp size={14} />
                  </Button>
                  <span className="text-xs text-slate-500">{it.sortOrder}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}
                    aria-label="Move option down" title="Move option down" className="h-auto w-auto p-0 text-slate-400 hover:bg-transparent hover:text-slate-700">
                    <ChevronDown size={14} />
                  </Button>
                </div>
                <div className="col-span-3">
                  <Input
                    value={it.code}
                    onChange={(e) => update(idx, { code: e.target.value })}
                    placeholder="UPPERCASE_CODE"
                    className="font-mono text-sm"
                    disabled={!!it.id}
                  />
                </div>
                <div className="col-span-5">
                  <Input
                    value={it.label}
                    onChange={(e) => update(idx, { label: e.target.value })}
                    placeholder="Display label"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(idx)}
                    className={[
                      "px-2 py-1 rounded text-xs flex items-center gap-1",
                      it.active
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    ].join(" ")}
                  >
                    {it.active ? <><Eye size={12} /> Active</> : <><EyeOff size={12} /> Hidden</>}
                  </button>
                </div>
                <div className="col-span-1 flex items-center gap-1 justify-end">
                  {it.dirty && (
                    <Button size="sm" onClick={() => saveRow(idx)} disabled={busy === (it.id ?? `new-${idx}`)}>
                      <Save size={12} />
                    </Button>
                  )}
                  <Button variant="ghost"
                    type="button"
                    onClick={() => remove(idx)} className="p-1"
                    title="Delete">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</Alert>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Code is the stable identifier saved in records. Label is shown in dropdowns. Hidden items remain in historical records but no longer appear in forms.
        </p>
      </CardContent>
    </Card>
  );
}
