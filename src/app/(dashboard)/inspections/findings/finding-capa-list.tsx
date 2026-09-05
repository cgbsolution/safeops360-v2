"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, ShieldCheck, Trash2 } from "lucide-react";
import { Can } from "@/components/auth/can";
import { Card } from "@/components/ui/card";

const CAPA_TYPE = ["CORRECTION", "CORRECTIVE_ACTION", "PREVENTIVE_ACTION"] as const;

const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-rose-50 text-rose-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  VERIFIED: "bg-emerald-600 text-white",
  OVERDUE: "bg-rose-100 text-rose-800",
  REJECTED: "bg-slate-200 text-slate-600"
};

const TYPE_BADGE: Record<string, string> = {
  CORRECTION: "bg-rose-50 text-rose-700 border-rose-200",
  CORRECTIVE_ACTION: "bg-amber-50 text-amber-700 border-amber-200",
  PREVENTIVE_ACTION: "bg-blue-50 text-blue-700 border-blue-200"
};

type Capa = {
  id: string;
  capaType: string;
  description: string;
  ownerId: string | null;
  owner: { name: string } | null;
  dueDate: Date | null;
  status: string;
  completedAt: Date | null;
  completedBy: { name: string } | null;
  verifiedAt: Date | null;
  verifiedBy: { name: string } | null;
  evidenceNote: string | null;
};

export function FindingCapaList({
  findingId, capas, status: findingStatus
}: {
  findingId: string;
  capas: Capa[];
  status: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  // Add CAPA state
  const [type, setType] = useState<typeof CAPA_TYPE[number]>("CORRECTIVE_ACTION");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function addCapa() {
    if (!description.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/inspections/findings/${findingId}/capas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capaType: type, description, dueDate: dueDate || null })
    });
    setBusy(false);
    if (res.ok) {
      setDescription(""); setDueDate(""); setAdding(false);
      router.refresh();
    } else {
      alert("Add failed.");
    }
  }

  async function patchCapa(capaId: string, payload: any) {
    setBusy(true);
    const res = await fetch(`/api/inspections/findings/${findingId}/capas/${capaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-3">
      {capas.length === 0 && (
        <p className="text-sm text-slate-500">No CAPAs yet. Add one to begin tracking action.</p>
      )}

      {capas.map((c) => {
        const overdue = c.dueDate && new Date(c.dueDate) < new Date() && !["COMPLETED", "VERIFIED", "REJECTED"].includes(c.status);
        return (
          <Card key={c.id} className="border border-slate-200 rounded-md p-3 shadow-none">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={TYPE_BADGE[c.capaType]}>{c.capaType.replace(/_/g, " ")}</Badge>
                  <Badge className={STATUS_BADGE[c.status]}>{c.status}</Badge>
                  {overdue && <Badge className="bg-rose-100 text-rose-800">Overdue</Badge>}
                </div>
                <p className="text-sm mt-2">{c.description}</p>
                <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-3">
                  <span>Owner: {c.owner?.name ?? "— unassigned"}</span>
                  {c.dueDate && <span>Due: {new Date(c.dueDate).toLocaleDateString()}</span>}
                  {c.completedBy && <span>Completed by {c.completedBy.name} on {c.completedAt?.toLocaleDateString()}</span>}
                  {c.verifiedBy && <span>Verified by {c.verifiedBy.name} on {c.verifiedAt?.toLocaleDateString()}</span>}
                </div>
                {c.evidenceNote && (
                  <div className="mt-2 text-xs italic text-slate-600">Evidence: {c.evidenceNote}</div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {c.status !== "COMPLETED" && c.status !== "VERIFIED" && (
                  <Can permission="INSPECTION_FINDING.UPDATE">
                    <Button size="sm" variant="ghost" onClick={() => patchCapa(c.id, { status: "COMPLETED" })} disabled={busy}>
                      <CheckCircle2 size={12} /> Complete
                    </Button>
                  </Can>
                )}
                {c.status === "COMPLETED" && (
                  <Can permission="INSPECTION_FINDING.VERIFY">
                    <Button size="sm" onClick={() => patchCapa(c.id, { status: "VERIFIED" })} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
                      <ShieldCheck size={12} /> Verify
                    </Button>
                  </Can>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {findingStatus !== "CLOSED" && findingStatus !== "VERIFIED" && findingStatus !== "DUPLICATE" && (
        <Can permission="INSPECTION_FINDING.UPDATE">
          {!adding ? (
            <Button variant="ghost" onClick={() => setAdding(true)}>
              <Plus size={14} /> Add CAPA
            </Button>
          ) : (
            <Card className="border border-primary-200 rounded-md p-3 space-y-2 bg-primary-50/30 shadow-none">
              <div>
                <Label>Type</Label>
                <SelectField value={type} onChange={(value) => setType(value as any)}
                  options={CAPA_TYPE.map((t) => ({ value: String(t), label: t.replace(/_/g, " ") }))}
                />
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
                <Button onClick={addCapa} disabled={busy || !description.trim()}>Add</Button>
              </div>
            </Card>
          )}
        </Can>
      )}
    </div>
  );
}
