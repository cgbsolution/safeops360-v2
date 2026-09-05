"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Star, ShieldAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

type Assignment = {
  id: string;
  roleId: string;
  roleName: string;
  roleCode: string;
  scopeType: string | null;
  scopeValue: string | null;
  validTo: Date | null;
};

type Role = { id: string; code: string; name: string; isSystem: boolean };

export function UserRoleManager({
  userId, currentAssignments, allRoles, primaryRole
}: {
  userId: string;
  currentAssignments: Assignment[];
  allRoles: Role[];
  primaryRole: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [newRoleId, setNewRoleId] = useState(allRoles[0]?.id ?? "");

  const assignedRoleCodes = new Set(currentAssignments.map((a) => a.roleCode));

  async function setAsPrimary(roleCode: string) {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: roleCode })
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Update failed");
    }
  }

  async function addAssignment() {
    if (!newRoleId) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/users/${userId}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId: newRoleId })
    });
    setBusy(false);
    if (res.ok) {
      setAdding(false);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Assignment failed");
    }
  }

  async function removeAssignment(assignmentId: string) {
    if (!confirm("Remove this role assignment? The user will lose all permissions granted by this role.")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${userId}/roles/${assignmentId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError("Remove failed");
  }

  return (
    <div className="space-y-3">
      {currentAssignments.length === 0 ? (
        <p className="text-sm text-slate-500">No role assignments yet.</p>
      ) : (
        <div className="space-y-2">
          {currentAssignments.map((a) => {
            const isPrimary = a.roleCode === primaryRole;
            const isExpired = a.validTo && new Date(a.validTo) < new Date();
            return (
              <div
                key={a.id}
                className={[
                  "flex items-center justify-between rounded-md border p-2",
                  isPrimary ? "border-primary-300 bg-primary-50/40" : "border-slate-200",
                  isExpired ? "opacity-60" : ""
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  {isPrimary && <Star size={12} className="text-primary-600 fill-primary-600" />}
                  <Badge className={isPrimary ? "bg-primary-100 text-primary-800 border-primary-200" : "bg-slate-100 text-slate-700 border-slate-200"}>
                    {a.roleName}
                  </Badge>
                  <span className="text-xs text-slate-500 font-mono">{a.roleCode}</span>
                  {a.scopeType && (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                      {a.scopeType}: {a.scopeValue}
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge className="bg-slate-200 text-slate-500 text-[10px]">Expired</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!isPrimary && (
                    <Button variant="ghost"
                      type="button"
                      onClick={() => setAsPrimary(a.roleCode)}
                      disabled={busy} className="text-xs px-2 py-1 rounded"
                      title="Make primary">
                      Set primary
                    </Button>
                  )}
                  <Button variant="ghost"
                    type="button"
                    onClick={() => removeAssignment(a.id)}
                    disabled={busy || isPrimary} className="p-1"
                    title={isPrimary ? "Cannot remove primary role" : "Remove assignment"}>
                    <X size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!adding ? (
        <Button variant="ghost" onClick={() => setAdding(true)} disabled={busy}>
          <Plus size={14} /> Add role
        </Button>
      ) : (
        <Card className="flex gap-2 items-end border border-primary-200 rounded-md p-2 bg-primary-50/30 shadow-none">
          <div className="flex-1">
            <SelectField value={newRoleId} onChange={(value) => setNewRoleId(value)}
              options={allRoles
                .filter((r) => !assignedRoleCodes.has(r.code)).map((r) => ({ value: String(r.id), label: `${r.name} (${r.code})` }))}
            />
          </div>
          <Button onClick={addAssignment} disabled={busy}>Add</Button>
          <Button variant="ghost" onClick={() => setAdding(false)}><X size={14} /></Button>
        </Card>
      )}

      {error && (
        <Alert variant="destructive" className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</Alert>
      )}
    </div>
  );
}
