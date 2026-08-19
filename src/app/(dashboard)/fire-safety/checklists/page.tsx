// Checklist Library — the answer to "how do we add another checklist?".
//
// The eleven Page Industries sheets were seeded from code, which made a new
// client checklist a developer ticket. This screen makes it configuration:
// transcribe the sheet, publish it, and it appears on the Fire Alarm / Hydrant /
// FE Inspection screens for every matching asset, because those screens read the
// template library rather than a hardcoded tab list.
//
// Who can do what is enforced by FIRE.TEMPLATE_AUTHOR (transcribe/revise) and
// FIRE.TEMPLATE_APPROVE (publish/retire) — separate codes, because publishing a
// controlled document that every future inspection is recorded against is a
// different act from writing it down.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { MX } from "../lib";
import { ChecklistLibrary } from "./library";
import { Caps, ChecklistSummary } from "./types";

export const dynamic = "force-dynamic";

export default async function ChecklistLibraryPage() {
  let items: ChecklistSummary[] = [];
  let loadError: string | null = null;
  let caps: Caps = {};

  const [listRes, capRes] = await Promise.allSettled([
    backendFetch<{ items: ChecklistSummary[] }>("/api/fire/checklists/templates", {
      query: { includeRetired: "false" },
    }),
    backendFetch<Caps>("/api/fire/checklists/capabilities"),
  ]);

  if (listRes.status === "fulfilled") items = listRes.value.items ?? [];
  else loadError = (listRes.reason as any)?.message ?? "Failed to load the checklist library.";
  if (capRes.status === "fulfilled") caps = capRes.value;

  return (
    <div>
      <PageHeader
        title="Checklist Library"
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Fire Safety", href: "/fire-safety" },
          { label: "Checklist Library" },
        ]}
        description="Every controlled fire checklist, its revision, and what it applies to. Add a new client sheet here and it appears on the inspection screens automatically — no code change."
        action={
          <Link
            href="/fire-safety/register"
            className="rounded-lg border px-3 py-1.5 text-[12px] font-medium"
            style={{ borderColor: MX.iceLine, color: MX.navy }}
          >
            Fire asset register →
          </Link>
        }
      />

      {caps.rbacSeeded === false && (
        <div
          className="mb-4 rounded-xl border px-4 py-2.5 text-[12px]"
          style={{ borderColor: MX.gold, background: MX.amberSoft, color: MX.amber }}
        >
          <strong>FIRE permissions are not seeded.</strong> Template authoring and publishing are
          currently both gated on the legacy <code>INCIDENT.UPDATE</code> grant, so the
          author/approve separation is not being enforced. Run{" "}
          <code className="rounded bg-white/70 px-1">npx tsx prisma/seed-rbac.ts</code>.
        </div>
      )}

      {/* Who holds what, on the screen where it matters. An admin configuring
          roles should not have to read seed-rbac.ts to find out. */}
      <details className="mb-4 rounded-xl border bg-white" style={{ borderColor: MX.iceLine }}>
        <summary
          className="cursor-pointer list-none px-4 py-2.5 text-[12px] font-semibold"
          style={{ color: MX.navy }}
        >
          Who can do what on fire checklists
        </summary>
        <div className="border-t px-4 py-3" style={{ borderColor: MX.iceLine }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-[11.5px]">
              <thead>
                <tr style={{ background: MX.ice }}>
                  {["Sheet's own role", "Platform permission", "Roles that hold it"].map((h) => (
                    <th
                      key={h}
                      className="border-b px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                      style={{ borderColor: MX.iceLine, color: MX.navy }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ color: MX.ink }}>
                {[
                  ["Prepared by: Person In-charge", "FIRE.EXECUTE", "Safety Officer, Maintenance Head, Supervisor, Emergency Response Coordinator, HSE Manager"],
                  ["Reviewed by: Intermediatory Head", "FIRE.VERIFY", "Department Head, Plant HSE Head, HSE Manager, Plant Head"],
                  ["Approved by: HOD", "FIRE.APPROVE", "HSE Manager, Plant Head, Corporate HSE"],
                  ["—  add / edit a cylinder in the register", "FIRE.CREATE / FIRE.UPDATE", "Safety Officer, Maintenance Head, HSE Manager"],
                  ["—  transcribe or revise a checklist", "FIRE.TEMPLATE_AUTHOR", "HSE Manager, Corporate HSE, Admin"],
                  ["—  publish / retire a revision", "FIRE.TEMPLATE_APPROVE", "HSE Manager, Corporate HSE, Admin"],
                  ["—  delete a checklist or asset", "FIRE.DELETE", "HSE Manager, Maintenance Head, Corporate HSE, Admin"],
                  ["—  mark a shutdown or holiday", "FIRE.CALENDAR", "Plant Head, HSE Manager, Maintenance Head"],
                  ["—  read + export only (audit)", "FIRE.READ / FIRE.EXPORT", "Auditor, Lead Auditor, Compliance Officer, Executive Viewer"],
                ].map(([role, code, holders]) => (
                  <tr key={code as string}>
                    <td className="border-b px-2.5 py-1.5" style={{ borderColor: MX.iceLine }}>
                      {role}
                    </td>
                    <td className="border-b px-2.5 py-1.5 font-mono text-[10.5px]" style={{ borderColor: MX.iceLine, color: MX.navy }}>
                      {code}
                    </td>
                    <td className="border-b px-2.5 py-1.5" style={{ borderColor: MX.iceLine, color: MX.muted }}>
                      {holders}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: MX.muted }}>
            Prepare, review and approve go to different roles on purpose — one person holding all
            three can sign their own work, which is what the three-stage block printed on every
            sheet exists to prevent. Workers and contractor workmen hold no fire grant at all.
          </p>
        </div>
      </details>

      <ChecklistLibrary initial={items} caps={caps} loadError={loadError} />
    </div>
  );
}
