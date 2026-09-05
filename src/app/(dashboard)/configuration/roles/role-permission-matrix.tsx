"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const SCOPES = ["ALL_PLANTS", "OWN_PLANT", "OWN_DEPARTMENT", "OWN_RECORDS"] as const;
type Scope = typeof SCOPES[number];

const SCOPE_LABEL: Record<string, string> = {
  ALL_PLANTS: "ALL", OWN_PLANT: "PLANT", OWN_DEPARTMENT: "DEPT", OWN_RECORDS: "OWN"
};
const SCOPE_BADGE: Record<string, string> = {
  ALL_PLANTS: "bg-rose-100 text-rose-800 border-rose-200",
  OWN_PLANT: "bg-amber-100 text-amber-800 border-amber-200",
  OWN_DEPARTMENT: "bg-blue-100 text-blue-800 border-blue-200",
  OWN_RECORDS: "bg-slate-100 text-slate-700 border-slate-200"
};

type Permission = {
  id: string;
  code: string;
  action: string;
  description: string | null;
  currentScope: string | null;
};

type ModuleRow = {
  module: string;
  permissions: Permission[];
};

export function RolePermissionMatrix({
  roleId, roleCode, modules
}: {
  roleId: string;
  roleCode: string;
  modules: ModuleRow[];
}) {
  const router = useRouter();
  const [grants, setGrants] = useState<Map<string, string | null>>(
    () => {
      const m = new Map<string, string | null>();
      for (const mod of modules) for (const p of mod.permissions) m.set(p.id, p.currentScope);
      return m;
    }
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function setScope(permId: string, scope: string | null) {
    const next = new Map(grants);
    next.set(permId, scope);
    setGrants(next);
  }

  async function save() {
    setBusy(true);
    setError("");
    const payload = {
      grants: [...grants.entries()].map(([permissionId, scope]) => ({
        permissionId,
        scope: scope ?? null
      }))
    };
    const res = await fetch(`/api/admin/roles/${roleCode}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Save failed (${res.status}).`);
      return;
    }
    setSavedAt(new Date());
    router.refresh();
  }

  // Compute dirty
  const dirty = modules.some((m) =>
    m.permissions.some((p) => grants.get(p.id) !== p.currentScope)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3 sticky top-0 bg-white py-2 z-10">
        <div className="text-xs text-slate-500">
          {dirty ? <span className="text-amber-700 font-medium">Unsaved changes</span> : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "No changes"}
        </div>
        <Button onClick={save} disabled={busy || !dirty}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save permissions
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800 mb-3">{error}</Alert>
      )}

      <div className="space-y-4">
        {modules.map((mod) => (
          <div key={mod.module}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 mb-2">
              {mod.module.replace(/_/g, " ")}
            </h3>
            <Card className="border border-slate-200 rounded-md overflow-hidden shadow-none">
              <Table className="w-full text-sm">
                <TableHeader className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <TableRow>
                    <TableHead className="text-left p-2 w-32">Action</TableHead>
                    <TableHead className="text-left p-2">Description</TableHead>
                    <TableHead className="text-right p-2 w-72">Scope</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mod.permissions.map((p) => {
                    const current = grants.get(p.id);
                    return (
                      <TableRow key={p.id} className="border-t border-slate-100">
                        <TableCell className="p-2 font-mono text-xs">{p.action}</TableCell>
                        <TableCell className="p-2 text-xs text-slate-600">{p.description ?? "—"}</TableCell>
                        <TableCell className="p-2">
                          <div className="flex justify-end gap-1">
                            <ScopeButton scope={null} active={!current} onClick={() => setScope(p.id, null)} />
                            {SCOPES.map((s) => (
                              <ScopeButton key={s} scope={s} active={current === s} onClick={() => setScope(p.id, s)} />
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScopeButton({ scope, active, onClick }: { scope: Scope | null; active: boolean; onClick: () => void }) {
  if (scope === null) {
    return (
      <Button variant="ghost"
        type="button"
        onClick={onClick}
        className={[
          "px-2 py-1 rounded text-[10px] border",
          active ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
        ].join(" ")}>
        OFF
      </Button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-2 py-1 rounded text-[10px] border font-medium",
        active ? SCOPE_BADGE[scope] : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
      ].join(" ")}
    >
      {SCOPE_LABEL[scope]}
    </button>
  );
}
