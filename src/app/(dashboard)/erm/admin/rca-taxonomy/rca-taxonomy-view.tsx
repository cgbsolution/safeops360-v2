"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseApiError } from "@/lib/api-error";
import { DOMAINS, DOMAIN_COLOR, DOMAIN_LABEL, type CategoryOut } from "../../rca/lib";

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method, headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json().catch(() => ({}));
}

export function RcaTaxonomyView({ categories }: { categories: CategoryOut[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newCat, setNewCat] = useState({ code: "", name: "" });

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast({ title: ok, variant: "success" }); router.refresh(); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "error" }); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      {/* Add enterprise category */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div><label className="text-[11px] font-semibold text-slate-500">Code</label><Input value={newCat.code} onChange={(e) => setNewCat({ ...newCat, code: e.target.value.toUpperCase() })} className="mt-1 w-32" placeholder="GOV" /></div>
        <div className="flex-1"><label className="text-[11px] font-semibold text-slate-500">Enterprise category name</label><Input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} className="mt-1 w-full" placeholder="Governance / Oversight Failure" /></div>
        <Button disabled={!newCat.code || !newCat.name || busy}
          onClick={() => run(() => call("/api/erm/rca/categories", "POST", newCat), "Category added").then(() => setNewCat({ code: "", name: "" }))}
          className="gap-1.5"><Plus size={15} /> Add category</Button>
      </div>

      {categories.map((cat) => (
        <div key={cat.id} className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: cat.colorHex }} />
              <span className="font-semibold text-slate-800">{cat.name}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">{cat.code}</span>
              {!cat.isActive && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">inactive</span>}
            </div>
            <Button variant="ghost" onClick={() => setAddingSubFor(addingSubFor === cat.id ? null : cat.id)} className="h-auto p-0 text-xs font-medium text-primary-700 hover:bg-transparent hover:underline">+ sub-cause</Button>
          </div>

          {addingSubFor === cat.id && <AddSubCause categoryId={cat.id} busy={busy} run={run} onDone={() => setAddingSubFor(null)} />}

          <div className="divide-y divide-slate-50">
            {cat.subCauses.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-400">No sub-causes yet.</p>
            ) : cat.subCauses.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-700">{s.name}</span>
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{s.code}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(s.applicableDomains.length ? s.applicableDomains : DOMAINS).slice(0, 8).map((d) => (
                    <span key={d} title={DOMAIN_LABEL[d] ?? d} className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white" style={{ backgroundColor: DOMAIN_COLOR[d] ?? "#94a3b8" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AddSubCause({ categoryId, busy, run, onDone }: any) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const toggle = (d: string) => setDomains((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  return (
    <div className="space-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
      <div className="flex flex-wrap items-end gap-2">
        <div><label className="text-[11px] font-semibold text-slate-500">Code</label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="mt-1 w-36" placeholder="OPS-ISO" /></div>
        <div className="flex-1"><label className="text-[11px] font-semibold text-slate-500">Sub-cause name</label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full" placeholder="Inadequate isolation verification" /></div>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-slate-500">Applicable domains (none = universal)</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DOMAINS.map((d) => (
            <Button key={d} onClick={() => toggle(d)} type="button" variant="ghost"
              className={cn(
                "h-auto rounded-full border px-2.5 py-1 text-[11px] font-normal",
                domains.includes(d) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
              )}>{DOMAIN_LABEL[d]}</Button>
          ))}
        </div>
      </div>
      <Button disabled={!code || !name || busy}
        onClick={() => run(() => call("/api/erm/rca/sub-causes", "POST", { categoryId, code, name, applicableDomains: domains }), "Sub-cause added").then(onDone)}
        className="h-auto px-3 py-1.5">Add sub-cause</Button>
    </div>
  );
}
