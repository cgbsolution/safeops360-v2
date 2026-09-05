"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { SelectField } from "@/components/ui/select-field";
import {
  CheckCircle2, XCircle, AlertCircle, Camera, MessageSquare,
  Star, Send, Save, Loader2, ShieldAlert, AlertTriangle
} from "lucide-react";

type Item = {
  id: string;
  sequence: number;
  sectionTitle: string | null;
  itemText: string;
  itemType: string;
  options: any;
  units: string | null;
  minValue: number | null;
  maxValue: number | null;
  expectedValue: string | null;
  isCritical: boolean;
  requiresPhoto: boolean;
  requiresComment: boolean;
  guidanceText: string | null;
};

type ExistingResult = {
  itemId: string;
  resultStatus: string;
  valueText: string | null;
  valueNumeric: number | null;
  comment: string | null;
  photoUrls: string[];
};

type ItemState = {
  resultStatus: "PASS" | "FAIL" | "MARGINAL" | "NA" | "OBSERVATION" | "PENDING";
  valueText: string;
  valueNumeric: string;
  comment: string;
  photoUrls: string[];
};

type Props = {
  inspectionId: string;
  inspectionNumber: string;
  items: Item[];
  existingResults?: ExistingResult[];
  readOnly?: boolean;
};

export function TypedExecutionPanel({ inspectionId, inspectionNumber, items, existingResults, readOnly }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Initial state from existing results, otherwise empty
  const initialState: Record<string, ItemState> = {};
  for (const item of items) {
    const r = existingResults?.find((x) => x.itemId === item.id);
    initialState[item.id] = {
      resultStatus: (r?.resultStatus as any) ?? "PENDING",
      valueText: r?.valueText ?? "",
      valueNumeric: r?.valueNumeric?.toString() ?? "",
      comment: r?.comment ?? "",
      photoUrls: r?.photoUrls ?? []
    };
  }

  const [state, setState] = useState<Record<string, ItemState>>(initialState);

  function update(itemId: string, patch: Partial<ItemState>) {
    setState((s) => ({ ...s, [itemId]: { ...s[itemId], ...patch } }));
  }

  // Compute pass/fail for typed items based on numeric thresholds
  function autoStatusFor(item: Item, value: string): ItemState["resultStatus"] | null {
    if (item.itemType === "NUMERIC" || item.itemType === "MEASUREMENT") {
      const v = Number(value);
      if (Number.isNaN(v)) return null;
      if (item.minValue !== null && v < item.minValue) return "FAIL";
      if (item.maxValue !== null && v > item.maxValue) return "FAIL";
      return "PASS";
    }
    return null;
  }

  const stats = useMemo(() => {
    let pass = 0, fail = 0, marginal = 0, na = 0, pending = 0, criticalFails = 0;
    for (const item of items) {
      if (item.itemType === "SECTION_HEADER") continue;
      const s = state[item.id];
      if (!s || s.resultStatus === "PENDING") pending++;
      else if (s.resultStatus === "PASS") pass++;
      else if (s.resultStatus === "FAIL") {
        fail++;
        if (item.isCritical) criticalFails++;
      }
      else if (s.resultStatus === "MARGINAL") marginal++;
      else if (s.resultStatus === "NA") na++;
    }
    return { pass, fail, marginal, na, pending, criticalFails };
  }, [items, state]);

  async function save(submit: boolean) {
    setError("");
    if (submit && stats.pending > 0) {
      if (!confirm(`${stats.pending} item(s) not answered. Mark as N/A and continue?`)) return;
      // Auto-flip pending to NA
      const next = { ...state };
      for (const item of items) {
        if (item.itemType === "SECTION_HEADER") continue;
        if (next[item.id].resultStatus === "PENDING") next[item.id].resultStatus = "NA";
      }
      setState(next);
    }

    // Validate critical items have failure-path data
    for (const item of items) {
      if (item.itemType === "SECTION_HEADER") continue;
      const s = state[item.id];
      if (s.resultStatus === "FAIL" && item.requiresComment && !s.comment.trim()) {
        setError(`Item #${item.sequence} requires a comment when failed.`);
        return;
      }
    }

    setSubmitting(true);
    const payload = {
      submit,
      itemResults: items
        .filter((item) => item.itemType !== "SECTION_HEADER")
        .map((item) => ({
          checklistItemId: item.id,
          sequence: item.sequence,
          sectionTitle: item.sectionTitle,
          itemTextSnapshot: item.itemText,
          itemTypeSnapshot: item.itemType,
          isCriticalSnapshot: item.isCritical,
          resultStatus: state[item.id].resultStatus,
          valueText: state[item.id].valueText || null,
          valueNumeric: state[item.id].valueNumeric ? Number(state[item.id].valueNumeric) : null,
          comment: state[item.id].comment || null,
          photoUrls: state[item.id].photoUrls
        }))
    };

    const res = await fetch(`/api/inspections/${inspectionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Save failed (${res.status}).`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-slate-50 to-white">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-6 gap-2">
          <Stat label="Pass" value={stats.pass} tone="emerald" />
          <Stat label="Fail" value={stats.fail} tone="rose" />
          <Stat label="Critical" value={stats.criticalFails} tone="rose" highlight />
          <Stat label="Marginal" value={stats.marginal} tone="amber" />
          <Stat label="N/A" value={stats.na} tone="slate" />
          <Stat label="Pending" value={stats.pending} tone="slate" highlight={stats.pending > 0} />
        </CardContent>
      </Card>

      {stats.criticalFails > 0 && (
        <Alert variant="destructive" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm flex items-start gap-2">
          <AlertTriangle size={18} className="text-rose-600 mt-0.5" />
          <div>
            <div className="font-medium text-rose-900">
              {stats.criticalFails} critical item{stats.criticalFails === 1 ? "" : "s"} marked Fail
            </div>
            <div className="text-rose-800 text-xs">
              Each critical failure will spawn a Critical Finding on submit, and an Observation (UNSAFE_CONDITION, HIGH) will be raised for plant-wide visibility.
            </div>
          </div>
        </Alert>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          if (item.itemType === "SECTION_HEADER") {
            return (
              <div key={item.id} className="border-b border-slate-300 pt-3 pb-1">
                <h3 className="text-base font-semibold text-slate-800">{item.itemText}</h3>
              </div>
            );
          }
          const s = state[item.id];
          const auto = autoStatusFor(item, s.valueNumeric);
          return (
            <Card key={item.id} className={item.isCritical ? "border-rose-200" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-xs text-slate-400 mt-1 w-6 text-right">{item.sequence}.</span>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                          {item.itemText}
                          {item.isCritical && (
                            <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                              <Star size={9} className="fill-rose-600" /> CRITICAL
                            </Badge>
                          )}
                          {item.requiresPhoto && <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]"><Camera size={9} /> Photo</Badge>}
                          {item.requiresComment && <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"><MessageSquare size={9} /> Comment</Badge>}
                        </div>
                        {item.guidanceText && (
                          <p className="text-xs text-slate-600 italic mt-1">{item.guidanceText}</p>
                        )}
                        {item.expectedValue && (
                          <p className="text-xs text-slate-500 mt-1">Expected: {item.expectedValue}</p>
                        )}
                      </div>
                    </div>

                    {/* Type-specific input */}
                    <div className="mt-3 space-y-2">
                      {(item.itemType === "PASS_FAIL" || item.itemType === "CHECKBOX") && (
                        <PassFailButtons
                          value={s.resultStatus}
                          onChange={(v) => update(item.id, { resultStatus: v })}
                          disabled={readOnly}
                        />
                      )}
                      {(item.itemType === "NUMERIC" || item.itemType === "MEASUREMENT") && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="any"
                            value={s.valueNumeric}
                            onChange={(e) => {
                              const v = e.target.value;
                              const auto = autoStatusFor(item, v);
                              update(item.id, {
                                valueNumeric: v,
                                resultStatus: auto ?? s.resultStatus
                              });
                            }}
                            placeholder={`Enter ${item.itemType === "MEASUREMENT" ? "measurement" : "value"}`}
                            className="w-40"
                            disabled={readOnly}
                          />
                          {item.units && <span className="text-sm text-slate-500">{item.units}</span>}
                          {(item.minValue !== null || item.maxValue !== null) && (
                            <span className="text-xs text-slate-400">
                              ({item.minValue ?? "-∞"} – {item.maxValue ?? "+∞"})
                            </span>
                          )}
                          {auto && (
                            <Badge className={auto === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}>
                              Auto: {auto}
                            </Badge>
                          )}
                        </div>
                      )}
                      {item.itemType === "SELECT" && (
                        <SelectField
                          className="rounded-md px-3 py-2 text-sm"
                          value={s.valueText}
                          ariaLabel={item.itemText}
                          placeholder="— Select —"
                          onChange={(value) => update(item.id, { valueText: value, resultStatus: value ? "PASS" : "PENDING" })}
                          disabled={readOnly}
                          options={(Array.isArray(item.options) ? item.options : []).map((opt: any) => ({
                            value: String(opt.value ?? opt),
                            label: String(opt.label ?? opt.value ?? opt)
                          }))}
                        />
                      )}
                      {item.itemType === "TEXT" && (
                        <Textarea
                          rows={2}
                          value={s.valueText}
                          onChange={(e) => update(item.id, { valueText: e.target.value, resultStatus: e.target.value ? "PASS" : "PENDING" })}
                          disabled={readOnly}
                        />
                      )}
                      {item.itemType === "PHOTO" && (
                        <div className="text-xs text-slate-500 italic">
                          Photo upload — capture from your device camera. (Photo storage requires file API integration.)
                        </div>
                      )}
                      {item.itemType === "SIGNATURE" && (
                        <div className="text-xs text-slate-500 italic">
                          Signature capture — sign on detail page once item results are saved.
                        </div>
                      )}

                      {/* Status override + comment */}
                      <div className="flex flex-wrap gap-2 items-center">
                        {item.itemType !== "PASS_FAIL" && item.itemType !== "CHECKBOX" && (
                          <PassFailButtons
                            compact
                            value={s.resultStatus}
                            onChange={(v) => update(item.id, { resultStatus: v })}
                            disabled={readOnly}
                          />
                        )}
                      </div>

                      {(s.resultStatus === "FAIL" || s.resultStatus === "MARGINAL" || s.resultStatus === "OBSERVATION" || item.requiresComment) && (
                        <Textarea
                          rows={2}
                          placeholder={s.resultStatus === "FAIL" ? "Describe the failure (root cause, immediate action taken)…" : "Comment"}
                          value={s.comment}
                          onChange={(e) => update(item.id, { comment: e.target.value })}
                          disabled={readOnly}
                          className={s.resultStatus === "FAIL" ? "border-rose-200" : ""}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error && (
        <Alert variant="destructive" className="rounded border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{error}</Alert>
      )}

      {!readOnly && (
        <div className="flex gap-2 justify-end sticky bottom-0 bg-white py-3 border-t">
          <Button onClick={() => save(false)} variant="ghost" disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save progress
          </Button>
          <Button onClick={() => save(true)} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Submit inspection
          </Button>
        </div>
      )}
    </div>
  );
}

function PassFailButtons({
  value, onChange, compact, disabled
}: {
  value: string;
  onChange: (v: ItemState["resultStatus"]) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const opts: { v: ItemState["resultStatus"]; label: string; cls: string; icon: any }[] = [
    { v: "PASS", label: "Pass", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100", icon: CheckCircle2 },
    { v: "FAIL", label: "Fail", cls: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100", icon: XCircle },
    { v: "MARGINAL", label: "Marginal", cls: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100", icon: AlertCircle },
    { v: "NA", label: "N/A", cls: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100", icon: null }
  ];
  return (
    <div className={["flex gap-1", compact ? "flex-wrap" : "flex-wrap"].join(" ")}>
      {opts.map((o) => {
        const active = value === o.v;
        const Icon = o.icon;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            disabled={disabled}
            className={[
              "px-3 py-1 rounded-md border text-xs font-medium flex items-center gap-1",
              active
                ? o.v === "PASS"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : o.v === "FAIL"
                    ? "bg-rose-600 text-white border-rose-600"
                    : o.v === "MARGINAL"
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-slate-700 text-white border-slate-700"
                : o.cls
            ].join(" ")}
          >
            {Icon && <Icon size={12} />} {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Stat({ label, value, tone, highlight }: { label: string; value: number; tone: "emerald" | "rose" | "amber" | "slate"; highlight?: boolean }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    amber: "text-amber-700",
    slate: "text-slate-600"
  };
  return (
    <div className={["text-center p-2 rounded", highlight ? "bg-white shadow-sm" : ""].join(" ")}>
      <div className={["text-2xl font-bold", tones[tone]].join(" ")}>{value}</div>
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}
