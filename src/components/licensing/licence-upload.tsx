"use client";

// Upload / renew a .lic licence. Accepts a file or pasted token, POSTs it to
// /api/licensing/upload (which validates server-side BEFORE persisting, so a bad
// file can never clobber a working licence), and surfaces the result.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export function LicenceUpload({ onApplied }: { onApplied?: () => void | Promise<void> }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setToken((await file.text()).trim());
    setResult(null);
  }

  async function apply() {
    if (!token.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/licensing/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licence: token.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setResult({ ok: true, message: j.message ?? "Licence applied." });
        await onApplied?.();
      } else {
        const detail = j?.detail;
        const msg =
          (typeof detail === "object" ? detail?.message || detail?.detail : detail) ??
          j?.error ??
          `Upload failed (${r.status})`;
        setResult({ ok: false, message: String(msg) });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err?.message ?? "Network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input
        type="file"
        accept=".lic,.txt,text/plain"
        onChange={onFile}
        className="block text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm hover:file:bg-slate-200" />
      <Textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="…or paste the licence token here"
        rows={4}
        className="font-mono text-[11px]"
      />
      <div className="flex items-center gap-3">
        <Button onClick={apply} disabled={busy || !token.trim()}>
          {busy ? "Validating…" : "Apply licence"}
        </Button>
        {result && (
          <span className={`text-sm ${result.ok ? "text-emerald-700" : "text-rose-700"}`}>
            {result.message}
          </span>
        )}
      </div>
    </div>
  );
}
