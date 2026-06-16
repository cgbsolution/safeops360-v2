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
import { Save, Loader2, ClipboardCheck } from "lucide-react";

const ROOT_CAUSE_CATEGORIES = [
  "Procedural",
  "Behavioural",
  "Equipment",
  "Housekeeping",
  "Environmental",
  "Training",
  "Supervision"
];

// Editable by HSE Manager during the CHECKER step. Fills in CAPA fields the
// reporter cannot know — action owner, root cause, corrective actions, target.
// Once saved, the CHECKER can approve the workflow and the ASSIGNEE step will
// resolve to the action owner via the engine's recordData.
export function CapaEditPanel({
  nearMissId,
  plantId,
  initial,
  canEdit
}: {
  nearMissId: string;
  plantId: string;
  initial: {
    actionOwnerId: string | null;
    correctiveActions: string | null;
    rootCauseCategory: string | null;
    rootCauseDetail: string | null;
    targetDate: Date | string | null;
  };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [actionOwnerId, setActionOwnerId] = useState<string | null>(initial.actionOwnerId);
  const [correctiveActions, setCorrectiveActions] = useState(initial.correctiveActions ?? "");
  const [rootCauseCategory, setRootCauseCategory] = useState(initial.rootCauseCategory ?? "");
  const [rootCauseDetail, setRootCauseDetail] = useState(initial.rootCauseDetail ?? "");
  const [targetDate, setTargetDate] = useState(
    initial.targetDate ? new Date(initial.targetDate).toISOString().slice(0, 10) : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function save() {
    setBusy(true);
    setError("");
    const r = await fetch(`/api/near-miss/${nearMissId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionOwnerId,
        correctiveActions: correctiveActions || null,
        rootCauseCategory: rootCauseCategory || null,
        rootCauseDetail: rootCauseDetail || null,
        targetDate: targetDate || null
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
          <ClipboardCheck size={18} /> CAPA Details
        </CardTitle>
        <CardDescription className="text-blue-700">
          {canEdit
            ? "Capture root cause + corrective actions + assign an owner before approving."
            : "Filled in by the HSE Manager during the review step."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Action Owner</Label>
            <UserPicker
              value={actionOwnerId}
              onChange={(id) => setActionOwnerId(id)}
              filter={{ plantId }}
              placeholder="Pick the person responsible"
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Target Closure Date</Label>
            <Input
              type="date"
              value={targetDate}
              min={today}
              disabled={!canEdit}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Root Cause Category</Label>
          <Select
            value={rootCauseCategory}
            disabled={!canEdit}
            onChange={(e) => setRootCauseCategory(e.target.value)}
          >
            <option value="">— Select —</option>
            {ROOT_CAUSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Root Cause Detail</Label>
          <Textarea
            rows={3}
            value={rootCauseDetail}
            disabled={!canEdit}
            onChange={(e) => setRootCauseDetail(e.target.value)}
            placeholder="5-Why drilldown, supporting evidence, contributing factors…"
          />
        </div>

        <div className="space-y-2">
          <Label>Corrective Actions</Label>
          <Textarea
            rows={4}
            value={correctiveActions}
            disabled={!canEdit}
            onChange={(e) => setCorrectiveActions(e.target.value)}
            placeholder="1) … 2) … 3) …"
          />
        </div>

        {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</div>}

        {canEdit && (
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save CAPA
            </Button>
            {savedAt && <span className="text-xs text-emerald-700">Saved · {savedAt}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
