import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/server";
import { CamsSettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

const f = <T,>(v: T) => () => v;

export type PreferenceRow = {
  eventClass: string;
  label: string;
  inAppEnabled: boolean;
  emailFrequency: string;
  isDefault: boolean;
  eventCount: number;
  events: string[];
  // Events that ignore the digest entirely — surfaced so nobody believes
  // WEEKLY will hold back an overdue CAPA.
  alwaysImmediate: string[];
};

export type LanguageRow = {
  code: string;
  label: string;
  nativeLabel: string;
  dir: string;
};

/**
 * WP-43 + WP-46 — the two per-user settings CAMS added.
 *
 * Notification preferences and field language sit together because they are
 * both "how this module talks to me", and neither justifies its own nav entry.
 */
export default async function CamsSettingsPage() {
  await requirePermission("CAMS.READ");

  const [prefs, langs] = await Promise.all([
    backendFetch<{ items: PreferenceRow[]; frequencies: string[]; default: string }>(
      "/api/cams-completion/notification-preferences",
    ).catch(f({ items: [] as PreferenceRow[], frequencies: [], default: "DAILY" })),
    backendFetch<{ items: LanguageRow[]; default: string }>(
      "/api/cams-completion/i18n/languages",
    ).catch(f({ items: [] as LanguageRow[], default: "en" })),
  ]);

  return (
    <div>
      <PageHeader
        title="Audit settings"
        description="How the audit module notifies you, and which language field-facing questions are shown in."
        breadcrumbs={[{ label: "Audit & Compliance", href: "/cams/audits" }, { label: "Settings" }]}
      />
      <CamsSettingsView
        preferences={prefs.items}
        frequencies={prefs.frequencies}
        languages={langs.items}
        defaultLanguage={langs.default}
      />
    </div>
  );
}
