"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";

export function NewDropdownTypeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    const sanitized = type.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
    if (!sanitized) {
      setError("Type name is required.");
      setBusy(false);
      return;
    }
    // Create a placeholder item so the type appears in the list
    const res = await fetch("/api/admin/master-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: sanitized,
        code: "PLACEHOLDER",
        label: "(placeholder — replace or delete)",
        sortOrder: 1,
        active: false
      })
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Create failed (${res.status}).`);
      return;
    }
    router.push(`/configuration/dropdowns/${sanitized}`);
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus size={14} /> New dropdown type
      </Button>
    );
  }
  return (
    <div className="flex items-end gap-2 border border-slate-200 rounded-md px-3 py-2 bg-white">
      <div>
        <Label className="text-xs">New type code</Label>
        <Input
          autoFocus
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="e.g. CUSTOM_CATEGORY"
          className="w-56"
        />
      </div>
      <Button onClick={create} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
      <Button variant="ghost" onClick={() => setOpen(false)}><X size={14} /></Button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}
