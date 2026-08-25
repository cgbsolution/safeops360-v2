// The fire asset register — one screen, two views.
//
// This replaces two screens that each had their own add/edit path onto the same
// `FireEquipment` table:
//
//   /fire-safety/equipment              general asset CRUD, all types
//   /fire-safety/extinguisher-register  the controlled 16-column sheet
//
// For an extinguisher, both created and edited the same row with different field
// sets — so a cylinder added on one screen was missing the columns the other
// screen considers mandatory, and neither screen knew about the other. Both old
// paths now redirect here. `/fire-safety/equipment/[id]` is untouched: it owns
// status override, out-of-service, frequency override and inspection history, and
// nothing on this screen duplicates those.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { DocumentHeader } from "../_components/document-header";
import { MX, RegisterPayload } from "../lib";
import { FireAsset } from "./asset-table";
import { RegisterTabs } from "./register-tabs";

export const dynamic = "force-dynamic";

type Plant = { id: string; code: string; name: string };
type Zone = { id: string; zoneCode: string; name: string; plantId: string };
type Caps = {
  create?: boolean;
  update?: boolean;
  delete?: boolean;
  export?: boolean;
  rbacSeeded?: boolean;
};

export default async function FireRegisterPage() {
  let register: RegisterPayload | null = null;
  let registerError: string | null = null;
  let assets: FireAsset[] = [];
  let assetsError: string | null = null;

  // Each panel degrades on its own. A failure fetching the general asset list
  // must not blank the controlled register, and vice versa — they answer
  // different regulatory questions and one being down is not both being down.
  const [regRes, assetRes, plantRes, zoneRes, capRes] = await Promise.allSettled([
    backendFetch<RegisterPayload>("/api/fire/register/extinguishers"),
    backendFetch<{ items: FireAsset[] }>("/api/fire/equipment"),
    backendFetch<Plant[]>("/api/plants"),
    // Tolerates both the {items} envelope this endpoint returns and a bare array.
    backendFetch<{ items: Zone[] } | Zone[]>("/api/fire/zones"),
    backendFetch<Caps>("/api/fire/checklists/capabilities"),
  ]);

  if (regRes.status === "fulfilled") register = regRes.value;
  else registerError = (regRes.reason as any)?.message ?? "Failed to load the extinguisher register.";

  if (assetRes.status === "fulfilled") {
    // Extinguishers are excluded here — they have their own controlled tab, and
    // listing them on both is the duplication this screen removes.
    assets = (assetRes.value.items ?? []).filter((a) => a.type !== "FIRE_EXTINGUISHER");
  } else {
    assetsError = (assetRes.reason as any)?.message ?? "Failed to load fire assets.";
  }

  const plants: Plant[] = plantRes.status === "fulfilled" && Array.isArray(plantRes.value) ? plantRes.value : [];
  const zones: Zone[] =
    zoneRes.status === "fulfilled"
      ? Array.isArray(zoneRes.value)
        ? zoneRes.value
        : (zoneRes.value as { items: Zone[] })?.items ?? []
      : [];
  const caps: Caps = capRes.status === "fulfilled" ? capRes.value : {};
  const canWrite = Boolean(caps.create || caps.update);
  // Both, deliberately. FIRE.DELETE is what the button MEANS, but the route it
  // calls — DELETE /api/fire/equipment/{id}, shared with the "All other fire
  // assets" tab — is gated on FIRE.UPDATE. Requiring only one of the pair would
  // either hide the action from someone allowed to take it or offer a guaranteed
  // 403, and a control that fails on click is the thing the capabilities call
  // exists to prevent.
  const canDelete = Boolean(caps.delete && caps.update);
  // Default true only when the capabilities call itself failed — hiding the
  // export because a side-call errored would be a worse lie than offering a
  // button the backend then refuses.
  const canExport = caps.export !== false;

  return (
    <div>
      <PageHeader
        title="Fire Asset Register"
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Fire Safety", href: "/fire-safety" },
          { label: "Register" },
        ]}
        description="Every fire asset on site. Extinguishers carry the client's controlled sixteen-column register with hydrostatic-test, refill and cylinder-life due dates; everything else carries its inspection schedule and computed status."
        action={
          <Link
            href="/fire-safety/checklists"
            className="rounded-lg border px-3 py-1.5 text-[12px] font-medium"
            style={{ borderColor: MX.iceLine, color: MX.navy }}
          >
            Checklist library →
          </Link>
        }
      />

      {/* Surfaced rather than logged: until seed-rbac.ts runs, fire routes fall
          back to the old INCIDENT.* codes, which means auditors still cannot read
          this register and contractors still can. An admin needs to know that,
          and a warning nobody sees is not a warning. */}
      {caps.rbacSeeded === false && (
        <div
          className="mb-4 rounded-xl border px-4 py-2.5 text-[12px]"
          style={{ borderColor: MX.gold, background: MX.amberSoft, color: MX.amber }}
        >
          <strong>FIRE permissions are not seeded.</strong> Fire screens are running on the legacy
          INCIDENT.* grants, so auditors cannot read this register and contractors can. Run{" "}
          <code className="rounded bg-white/70 px-1">npx tsx prisma/seed-rbac.ts</code> to activate the
          dedicated FIRE roles.
        </div>
      )}

      {register && (
        <div className="mb-4">
          <DocumentHeader
            doc={register.document}
            title={register.document.title ?? "REGISTER OF FIRE EXTINGUISHERS"}
            subtitle={`${register.summary.total} cylinder(s) · ${register.summary.overdue} overdue · ${register.summary.dueSoon} due within 30 days · ${register.summary.notRecorded} with no date on file`}
          />
        </div>
      )}

      <RegisterTabs
        register={register}
        assets={assets}
        plants={plants}
        zones={zones}
        canWrite={canWrite}
        canDelete={canDelete}
        canExport={canExport}
        registerError={registerError}
        assetsError={assetsError}
      />
    </div>
  );
}
