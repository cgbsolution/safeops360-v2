"use client";

// Officer triage: map the technician's self-report onto the 5×5 matrix
// (the technician never sees a matrix — spec 1.2 screen 4), then convert the
// staged report into the real module record or reject it. All actions are
// backend-enforced (CAPTURE.TRIAGE); the panel is hidden without the grant.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Can } from "@/components/auth/can";
import { useToast } from "@/components/ui/toast";
import { UserPicker } from "@/components/ui/user-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { readApiError } from "@/lib/client-errors";
import type { SubmissionOut } from "@/lib/capture/types";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const INCIDENT_TYPES = [
  "FIRST_AID", "MTC", "RWC", "LTI", "FATALITY",
  "PROPERTY_DAMAGE", "ENVIRONMENTAL", "FIRE", "PROCESS_SAFETY",
];

const PERMIT_TYPES = [
  "HOT_WORK", "CONFINED_SPACE", "WORK_AT_HEIGHT", "EXCAVATION", "ELECTRICAL_LOTO", "GENERAL_COLD",
];

function riskLevelFor(score: number): string {
  if (score >= 17) return "CRITICAL";
  if (score >= 10) return "HIGH";
  if (score >= 5) return "MODERATE";
  return "LOW";
}

const LEVEL_COLOR: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MODERATE: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

export function TriagePanel({ sub }: { sub: SubmissionOut }) {
  const router = useRouter();
  const { toast } = useToast();
  const [likelihood, setLikelihood] = useState<number | null>(sub.triage.hiraLikelihood);
  const [severity, setSeverity] = useState<number | null>(sub.triage.hiraSeverity);
  const [note, setNote] = useState(sub.triage.note ?? "");
  const [description, setDescription] = useState(sub.description ?? "");
  const [incidentType, setIncidentType] = useState("PROPERTY_DAMAGE");
  const [busy, setBusy] = useState<string | null>(null);

  // Which authorisation-heavy convert sub-form is expanded (PTW / FLRA — the
  // fields a field technician can't supply, completed here at triage per §8.2).
  const [openConvert, setOpenConvert] = useState<"ptw" | "flra" | null>(null);
  // PTW
  const [permitType, setPermitType] = useState("HOT_WORK");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [issuerId, setIssuerId] = useState<string | null>(null);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  // FLRA
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [toolboxTalkById, setToolboxTalkById] = useState<string | null>(null);

  const score = likelihood && severity ? likelihood * severity : null;
  const level = score ? riskLevelFor(score) : null;
  const terminal = sub.status === "converted" || sub.status === "rejected" || sub.status === "closed";

  async function post(path: string, body: unknown, okMessage: string) {
    setBusy(path);
    try {
      const res = await fetch(`/api/capture/submissions/${sub.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Action failed"));
      toast({ title: okMessage, variant: "success" });
      router.refresh();
      return true;
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Action failed", variant: "error" });
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <Can permission="CAPTURE.TRIAGE">
      <div className="space-y-6">
        {/* triage */}
        <Card className="p-5 shadow-none">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Triage — 5×5</h2>
          <p className="mb-4 text-xs text-muted-foreground">Likelihood × Severity. High/Critical fires a cluster-check event.</p>

          <div className="space-y-3 text-sm">
            <div>
              <p className="mb-1.5 font-medium">Likelihood</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant="ghost"
                    disabled={terminal}
                    onClick={() => setLikelihood(v)}
                    className={cn(
                      "h-auto h-10 w-10 rounded-md border text-sm font-semibold",
                      likelihood === v ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                    )}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-medium">Severity</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant="ghost"
                    disabled={terminal}
                    onClick={() => setSeverity(v)}
                    className={cn(
                      "h-auto h-10 w-10 rounded-md border text-sm font-semibold",
                      severity === v ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                    )}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
            {score ? (
              <p className="flex items-center gap-2">
                <span className="text-muted-foreground">Risk score:</span>
                <span className="font-semibold">{score}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", LEVEL_COLOR[level ?? ""])}>{level}</span>
              </p>
            ) : null}
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Triage note (optional)"
              rows={2}
              disabled={terminal}
              className="form-textarea"
            />
            <Button
              type="button"
              disabled={!score || terminal || busy !== null}
              onClick={() => void post("triage", { hiraLikelihood: likelihood, hiraSeverity: severity, note: note || null }, "Triage saved")}
              className="w-full font-semibold"
            >
              {busy === "triage" ? "Saving…" : "Save triage"}
            </Button>
          </div>
        </Card>

        {/* convert */}
        {!terminal ? (
          <Card className="p-5 shadow-none">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Convert</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Creates the real module record (its normal workflow starts) and links it back to this report.
            </p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description for the converted record (auto-generated from the report if left blank)"
              rows={3}
              className="form-textarea mb-3"
            />
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void post("convert", { target: "observation", description: description || null }, "Converted to Observation")}
                className="w-full font-semibold"
              >
                → Observation
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void post("convert", { target: "near_miss", description: description || null }, "Converted to Near-Miss")}
                className="w-full font-semibold"
              >
                → Near-Miss
              </Button>
              <div className="flex gap-2">
                <SelectField value={incidentType} onChange={setIncidentType} className="form-select flex-1"
                  options={INCIDENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    void post("convert", { target: "incident", incidentType, description: description || null }, "Converted to Incident")
                  }
                  className="font-semibold"
                >
                  → Incident
                </Button>
              </div>

              {/* PTW — the officer supplies the authorisation chain a field
                  tech can't (permit type, validity, issuer, receiver); the real
                  create_permit workflow starts from the DRAFT (spec §8.2). */}
              <Card className="rounded-md shadow-none">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpenConvert(openConvert === "ptw" ? null : "ptw")}
                  className="flex w-full items-center justify-between font-semibold"
                >
                  <span>→ Work Permit (PTW)</span>
                  <span className="text-muted-foreground">{openConvert === "ptw" ? "▲" : "▼"}</span>
                </Button>
                {openConvert === "ptw" ? (
                  <div className="space-y-2 border-t p-3 text-sm">
                    <div>
                      <Label className="mb-1 block text-xs font-medium text-muted-foreground">Permit type</Label>
                      <SelectField value={permitType} onChange={setPermitType} className="form-select"
                        options={PERMIT_TYPES.map((pt) => ({ value: pt, label: pt.replace(/_/g, " ") }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="mb-1 block text-xs font-medium text-muted-foreground">Valid from</Label>
                        <Input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="form-input" />
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs font-medium text-muted-foreground">Valid to</Label>
                        <Input type="datetime-local" value={validTo} onChange={(e) => setValidTo(e.target.value)} className="form-input" />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs font-medium text-muted-foreground">Issuer</Label>
                      <UserPicker value={issuerId} onChange={(id) => setIssuerId(id)} filter={{ plantId: sub.plantId, roleFallback: true }} placeholder="Select issuer" />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs font-medium text-muted-foreground">Receiver</Label>
                      <UserPicker value={receiverId} onChange={(id) => setReceiverId(id)} filter={{ plantId: sub.plantId, roleFallback: true }} placeholder="Select receiver" />
                    </div>
                    <Button
                      type="button"
                      disabled={busy !== null || !validFrom || !validTo || !issuerId || !receiverId}
                      onClick={() =>
                        void post(
                          "convert",
                          {
                            target: "ptw",
                            description: description || null,
                            permitType,
                            validFrom: new Date(validFrom).toISOString(),
                            validTo: new Date(validTo).toISOString(),
                            issuerId,
                            receiverId,
                          },
                          "Converted to Work Permit",
                        )
                      }
                      className="w-full font-semibold"
                    >
                      {busy === "convert" ? "Creating…" : "Create permit (DRAFT)"}
                    </Button>
                  </div>
                ) : null}
              </Card>

              {/* FLRA — the officer supplies crew + toolbox-talk; create_flra
                  runs its crew-signoff workflow from there. */}
              <Card className="rounded-md shadow-none">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpenConvert(openConvert === "flra" ? null : "flra")}
                  className="flex w-full items-center justify-between font-semibold"
                >
                  <span>→ FLRA (pre-task risk)</span>
                  <span className="text-muted-foreground">{openConvert === "flra" ? "▲" : "▼"}</span>
                </Button>
                {openConvert === "flra" ? (
                  <div className="space-y-2 border-t p-3 text-sm">
                    <div>
                      <Label className="mb-1 block text-xs font-medium text-muted-foreground">Crew (team members)</Label>
                      <UserPicker multiple value={teamMemberIds} onChange={(ids) => setTeamMemberIds(ids)} filter={{ plantId: sub.plantId }} placeholder="Add crew members" />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs font-medium text-muted-foreground">Toolbox talk by</Label>
                      <UserPicker value={toolboxTalkById} onChange={(id) => setToolboxTalkById(id)} filter={{ plantId: sub.plantId, roleFallback: true }} placeholder="Who conducted the toolbox talk" />
                    </div>
                    <Button
                      type="button"
                      disabled={busy !== null || teamMemberIds.length === 0 || !toolboxTalkById}
                      onClick={() =>
                        void post(
                          "convert",
                          { target: "flra", description: description || null, teamMemberIds, toolboxTalkById },
                          "Converted to FLRA",
                        )
                      }
                      className="w-full font-semibold"
                    >
                      {busy === "convert" ? "Creating…" : "Create FLRA"}
                    </Button>
                  </div>
                ) : null}
              </Card>
            </div>
          </Card>
        ) : null}

        {/* reject + unmask */}
        {!terminal ? (
          <Card className="p-5 shadow-none">
            <Button variant="destructive"
              type="button"
              disabled={busy !== null}
              onClick={() => {
                const reason = window.prompt("Reason for rejecting this field report:");
                if (reason && reason.trim().length >= 3) void post("reject", { reason: reason.trim() }, "Report rejected");
              }} className="w-full rounded-md px-4 py-2.5 text-sm">
              Reject report
            </Button>
          </Card>
        ) : null}

        {sub.isAnonymous ? (
          <Can permission="CAPTURE.UNMASK">
            <Card className="p-5 shadow-none">
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={async () => {
                  if (!window.confirm("Unmasking is recorded in the audit trail. Continue?")) return;
                  setBusy("unmask");
                  try {
                    const res = await fetch(`/api/capture/submissions/${sub.id}/unmask`, { method: "POST" });
                    if (!res.ok) throw new Error(await readApiError(res, "Unmask failed"));
                    const data = (await res.json()) as { found: boolean; reporter: { name: string; designation: string | null } | null };
                    toast({
                      title: data.found ? `Reporter: ${data.reporter?.name}${data.reporter?.designation ? ` (${data.reporter.designation})` : ""}` : "Reporter could not be resolved",
                      variant: data.found ? "success" : "default",
                    });
                  } catch (e) {
                    toast({ title: e instanceof Error ? e.message : "Unmask failed", variant: "error" });
                  } finally {
                    setBusy(null);
                  }
                }}
                className="w-full font-semibold text-muted-foreground"
              >
                Unmask anonymous reporter (audited)
              </Button>
            </Card>
          </Can>
        ) : null}
      </div>
    </Can>
  );
}
