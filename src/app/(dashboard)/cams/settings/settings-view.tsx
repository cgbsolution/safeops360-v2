"use client";

// WP-43 notification preferences + WP-46 field language.
//
// Two rules this screen has to communicate rather than hide:
//
//   1. **Some events ignore the digest.** An overdue CAPA emails you even on
//      WEEKLY. Letting someone believe they had muted it would be worse than
//      not offering the setting.
//   2. **A partially-translated language is worse than none** if nobody says so
//      — the auditor hits English halfway through the walk and stops trusting
//      the tool. Coverage is shown per language, not assumed.
//
// Designed at 390px first: these are settings people change on a phone.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2, Languages, Zap, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { readApiError } from "@/lib/client-errors";
import type { LanguageRow, PreferenceRow } from "./page";

const FREQ_LABEL: Record<string, string> = {
  IMMEDIATE: "Email immediately",
  DAILY: "Daily digest",
  WEEKLY: "Weekly digest",
  OFF: "No email",
};

// Stored per browser: the conduct screen reads it to pick the field language.
// A server-side per-user column would be better, but the field language is a
// device concern (a shared shop-floor tablet is not one person), so the device
// is the honest place for it.
const LANG_KEY = "safeops_cams_field_language";

export function CamsSettingsView({
  preferences,
  frequencies,
  languages,
  defaultLanguage,
}: {
  preferences: PreferenceRow[];
  frequencies: string[];
  languages: LanguageRow[];
  defaultLanguage: string;
}) {
  return (
    <div className="max-w-3xl space-y-5">
      <NotificationPreferences rows={preferences} frequencies={frequencies} />
      <FieldLanguage languages={languages} defaultLanguage={defaultLanguage} />
    </div>
  );
}

function NotificationPreferences({
  rows,
  frequencies,
}: {
  rows: PreferenceRow[];
  frequencies: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(row: PreferenceRow, patch: Partial<PreferenceRow>) {
    setBusy(row.eventClass);
    setErr(null);
    const res = await fetch("/api/cams-completion/notification-preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventClass: row.eventClass,
        inAppEnabled: patch.inAppEnabled ?? row.inAppEnabled,
        emailFrequency: patch.emailFrequency ?? row.emailFrequency,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      setErr(await readApiError(res, "Could not save that preference"));
      return;
    }
    setSaved(row.eventClass);
    setTimeout(() => setSaved(null), 1600);
    router.refresh();
  }

  if (!rows.length) {
    return (
      <Card className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Notification preferences could not be loaded. If the completion tables have not been
        created yet, run <code className="rounded bg-white px-1">scripts/add_cams_completion.py</code>.
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Bell size={16} className="text-violet-700" />
        Notifications
      </div>
      <p className="mt-1 max-w-prose text-xs text-slate-500">
        In-app notifications are immediate. Email is batched into a digest so a large audit does
        not produce a mail storm.
      </p>

      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div
            key={row.eventClass}
            className="rounded-lg border border-slate-200 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-800">{row.label}</span>
              <span className="text-[11px] text-slate-400">
                {row.eventCount} event type{row.eventCount === 1 ? "" : "s"}
              </span>
              {row.isDefault && (
                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                  default
                </span>
              )}
              {saved === row.eventClass && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                  <Check size={11} /> saved
                </span>
              )}
              {busy === row.eventClass && (
                <Loader2 size={12} className="animate-spin text-slate-400" />
              )}
            </div>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={row.inAppEnabled}
                  onChange={(e) => save(row, { inAppEnabled: e.target.checked })}
                  disabled={busy === row.eventClass}
                />
                Show in the notification bell
              </label>
              <Select
                value={row.emailFrequency}
                onChange={(e) => save(row, { emailFrequency: e.target.value })}
                disabled={busy === row.eventClass}
                className="h-8 w-full text-xs sm:ml-auto sm:w-52"
                aria-label={`Email frequency for ${row.label}`}
              >
                {frequencies.map((f) => (
                  <option key={f} value={f}>
                    {FREQ_LABEL[f] ?? f}
                  </option>
                ))}
              </Select>
            </div>

            {/* The honesty clause: these bypass the digest whatever you choose. */}
            {row.alwaysImmediate.length > 0 && (
              <p className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-700">
                <Zap size={11} className="mt-0.5 shrink-0" />
                <span>
                  {row.alwaysImmediate
                    .map((e) => e.replace(/_/g, " ").toLowerCase())
                    .join(", ")}{" "}
                  {row.alwaysImmediate.length === 1 ? "is" : "are"} emailed immediately
                  regardless of this setting — the consequences do not wait for a digest.
                </span>
              </p>
            )}
          </div>
        ))}
      </div>

      {err && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {err}
        </div>
      )}
    </Card>
  );
}

function FieldLanguage({
  languages,
  defaultLanguage,
}: {
  languages: LanguageRow[];
  defaultLanguage: string;
}) {
  const [lang, setLang] = useState<string>(() => {
    if (typeof window === "undefined") return defaultLanguage;
    return window.localStorage.getItem(LANG_KEY) ?? defaultLanguage;
  });

  function choose(code: string) {
    setLang(code);
    try {
      window.localStorage.setItem(LANG_KEY, code);
    } catch {
      /* private browsing — the toggle still works for this session */
    }
  }

  return (
    <Card className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Languages size={16} className="text-violet-700" />
        Field language
      </div>
      <p className="mt-1 max-w-prose text-xs text-slate-500">
        The language checkpoint questions and auditee-facing screens are shown in. The auditor
        interface stays in English — half-translating an interface is worse than not translating
        it.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {languages.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => choose(l.code)}
            className={cn(
              "min-h-[44px] rounded-lg border px-4 text-sm transition",
              lang === l.code
                ? "border-violet-600 bg-violet-50 font-medium text-violet-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {l.nativeLabel}
            <span className="ml-1.5 text-xs text-slate-400">{l.label}</span>
          </button>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-slate-400">
        Questions without a published translation fall back to English and are marked as such on
        the conduct screen, so you always know what you are reading.
      </p>
    </Card>
  );
}
