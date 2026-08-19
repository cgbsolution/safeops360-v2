// Register of Fire Extinguishers — PIL/EHSD/CL/028-R1.
//
// Not a checklist and deliberately not a second asset table: this is the
// extinguisher slice of the existing FireEquipment register, projected into the
// source sheet's sixteen columns. Every other fire surface — the dashboard, the
// zone/hot-work guard, the CAMS inspection link — reads FireEquipment, and a
// parallel FireExtinguisherAsset table would have been invisible to all of them.

import Link from "next/link";
import { backendFetch } from "@/lib/backend/fetch";
import { PageHeader } from "@/components/page-header";
import { DocumentHeader } from "../_components/document-header";
import { MX, RegisterPayload } from "../lib";
import { RegisterTable } from "./register-table";

export const dynamic = "force-dynamic";

type Plant = { id: string; code: string; name: string };

export default async function ExtinguisherRegisterPage() {
  let payload: RegisterPayload | null = null;
  let error: string | null = null;
  try {
    payload = await backendFetch<RegisterPayload>("/api/fire/register/extinguishers");
  } catch (e: any) {
    error = e?.message ?? "Failed to load the extinguisher register.";
  }

  // Degrades to empty rather than throwing: a plant picker that cannot load must
  // not take the register down with it.
  const plants: Plant[] = error
    ? []
    : await backendFetch<Plant[]>("/api/plants")
        .then((d) => (Array.isArray(d) ? d : []))
        .catch(() => [] as Plant[]);

  return (
    <div>
      <PageHeader
        title="Register of Fire Extinguishers"
        breadcrumbs={[
          { label: "Operational Safety" },
          { label: "Fire Safety", href: "/fire-safety" },
          { label: "Extinguisher Register" },
        ]}
        description="Every cylinder on site with its hydrostatic-test, refill and cylinder-life due dates. Red is past due, amber is due within 30 days, and a missing date reads as a register gap — never as compliance."
        action={
          <Link
            href="/fire-safety/fe-inspection"
            className="rounded-lg border px-3 py-1.5 text-[12px] font-medium"
            style={{ borderColor: MX.iceLine, color: MX.navy }}
          >
            Monthly inspection sheet →
          </Link>
        }
      />

      {error || !payload ? (
        <div
          className="rounded-xl border p-6 text-[13px]"
          style={{ borderColor: MX.red, background: MX.redSoft, color: MX.red }}
        >
          {error}
        </div>
      ) : (
        <>
          <DocumentHeader
            doc={payload.document}
            title={payload.document.title ?? "REGISTER OF FIRE EXTINGUISHERS"}
            subtitle={`${payload.summary.total} cylinder(s) on register`}
          />
          <div className="mt-4">
            <RegisterTable payload={payload} plants={plants} />
          </div>
        </>
      )}
    </div>
  );
}
