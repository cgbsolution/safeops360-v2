"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { UserPicker } from "@/components/ui/user-picker";
import { RcaEditor, useRcaMethodSwitcher } from "@/components/incidents/rca-editor";
import {
  type RcaMethod,
  RCA_METHODS_LIST,
  emptyDataFor,
  normaliseRcaMethod
} from "@/lib/rca/types";
import { Save, Loader2, ClipboardCheck } from "lucide-react";

// Editable by HSE_MANAGER / ADMIN while the incident workflow is open.
// Captures classification + investigation team + RCA + CAPA in one panel.
// The RCA section uses the methodology-specific editor — never a raw JSON
// textarea. Switching method with content prompts confirmation.
export function InvestigationEditPanel({
  incidentId,
  plantId,
  initial,
  canEdit
}: {
  incidentId: string;
  plantId: string;
  initial: {
    immediateCause: string | null;
    rootCauseMethod: string | null; // legacy or new code
    rootCauseData: unknown; // typed object (preferred) — falls back to legacy detail
    correctiveActions: string | null;
    preventiveActions: string | null;
    lostDays: number;
    propertyDamageCost: number | null;
    teamMemberIds: string[];
  };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [immediateCause, setImmediateCause] = useState(initial.immediateCause ?? "");

  // RCA — typed value driven by RcaEditor
  const initMethod: RcaMethod | null = normaliseRcaMethod(initial.rootCauseMethod);
  const [rcaMethod, setRcaMethod] = useState<RcaMethod | null>(initMethod);
  const [rcaData, setRcaData] = useState<unknown>(
    initial.rootCauseData ?? (initMethod ? emptyDataFor(initMethod) : null)
  );

  const switchMethod = useRcaMethodSwitcher({
    current: rcaMethod,
    data: rcaData,
    onConfirmedSwitch: (next, fresh) => {
      setRcaMethod(next);
      setRcaData(fresh);
    }
  });

  const [correctiveActions, setCorrectiveActions] = useState(initial.correctiveActions ?? "");
  const [preventiveActions, setPreventiveActions] = useState(initial.preventiveActions ?? "");
  const [lostDays, setLostDays] = useState(String(initial.lostDays));
  const [propertyCost, setPropertyCost] = useState(initial.propertyDamageCost ? String(initial.propertyDamageCost) : "");
  const [teamIds, setTeamIds] = useState<string[]>(initial.teamMemberIds);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError("");
    const r = await fetch(`/api/incidents/${incidentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        immediateCause: immediateCause || null,
        rootCauseMethod: rcaMethod || null,
        rootCauseData: rcaData ?? null,
        correctiveActions: correctiveActions || null,
        preventiveActions: preventiveActions || null,
        lostDays: lostDays === "" ? 0 : Number(lostDays),
        propertyDamageCost: propertyCost === "" ? null : Number(propertyCost),
        investigationTeamIds: teamIds
      })
    });
    setBusy(false);
    if (r.ok) {
      setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      router.refresh();
    } else {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "Save failed");
    }
  }

  return (
    <Card className="border-blue-300">
      <CardHeader className="bg-blue-50/60 rounded-t-xl">
        <CardTitle className="text-blue-900 flex items-center gap-2">
          <ClipboardCheck size={18} /> Investigation, RCA &amp; CAPA
        </CardTitle>
        <CardDescription className="text-blue-700">
          {canEdit
            ? "Update during classification + RCA + CAPA review steps. Method switch with content prompts confirmation."
            : "Read-only view of the investigation as captured by the HSE team."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-2">
          <Label>Investigation Team</Label>
          <UserPicker
            multiple
            value={teamIds}
            onChange={(ids) => setTeamIds(ids)}
            filter={{ plantId }}
            placeholder="Pick team members — first selected becomes Lead"
            disabled={!canEdit}
          />
          <p className="text-[11px] text-slate-500">First member is the investigation Lead.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Immediate Cause</Label>
            <Input
              value={immediateCause}
              onChange={(e) => setImmediateCause(e.target.value)}
              placeholder="e.g. Slip on wet surface"
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Root-Cause Method</Label>
            <Select
              value={rcaMethod ?? ""}
              onChange={(e) => {
                const v = e.target.value as RcaMethod;
                if (!v) {
                  setRcaMethod(null);
                  setRcaData(null);
                  return;
                }
                if (!rcaMethod) {
                  setRcaMethod(v);
                  setRcaData(emptyDataFor(v));
                } else {
                  switchMethod(v);
                }
              }}
              disabled={!canEdit}
            >
              <option value="">— Select —</option>
              {RCA_METHODS_LIST.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
            </Select>
          </div>
        </div>

        {/* Methodology-specific editor — replaces the previous single textarea */}
        <RcaEditor method={rcaMethod} value={rcaData} onChange={setRcaData} readOnly={!canEdit} />

        <div className="space-y-2">
          <Label>Corrective Actions</Label>
          <Textarea
            rows={3}
            value={correctiveActions}
            onChange={(e) => setCorrectiveActions(e.target.value)}
            placeholder="1) … 2) … 3) …"
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-2">
          <Label>Preventive Actions</Label>
          <Textarea
            rows={3}
            value={preventiveActions}
            onChange={(e) => setPreventiveActions(e.target.value)}
            placeholder="1) … 2) … 3) …"
            disabled={!canEdit}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Lost Days</Label>
            <Input
              type="number"
              min={0}
              value={lostDays}
              onChange={(e) => setLostDays(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Property Damage Cost (₹)</Label>
            <Input
              type="number"
              min={0}
              value={propertyCost}
              onChange={(e) => setPropertyCost(e.target.value)}
              placeholder="Leave blank if N/A"
              disabled={!canEdit}
            />
          </div>
        </div>

        {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</div>}

        {canEdit && (
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Investigation
            </Button>
            {savedAt && <span className="text-xs text-emerald-700">Saved · {savedAt}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
