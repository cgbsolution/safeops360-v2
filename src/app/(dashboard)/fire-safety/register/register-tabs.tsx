"use client";

// Tab shell for the consolidated fire register.
//
// Two views of ONE asset master (`FireEquipment`):
//
//   Extinguishers  the client's controlled sixteen-column sheet,
//                  PIL/EHSD/CL/028-R1, with its three due-date badges
//   All assets     every other fire asset — panels, hydrants, hose reels,
//                  detectors, emergency lights
//
// They are tabs rather than two screens because they were two screens, and that
// was the bug: `/fire-safety/equipment` and `/fire-safety/extinguisher-register`
// each had their own add/edit path onto the same table, so an extinguisher could
// be created twice, two different ways, with two different field sets. One screen,
// one add path per asset kind.

import * as React from "react";
import { DISPLAY_FONT, MX, RegisterPayload } from "../lib";
import { RegisterTable } from "../extinguisher-register/register-table";
import { AssetTable, FireAsset } from "./asset-table";

type Plant = { id: string; code: string; name: string };
type Zone = { id: string; zoneCode: string; name: string; plantId: string };
type Tab = "extinguishers" | "assets";

export function RegisterTabs({
  register,
  assets,
  plants,
  zones,
  canWrite,
  registerError,
  assetsError,
}: {
  register: RegisterPayload | null;
  assets: FireAsset[];
  plants: Plant[];
  zones: Zone[];
  canWrite: boolean;
  registerError: string | null;
  assetsError: string | null;
}) {
  const [tab, setTab] = React.useState<Tab>("extinguishers");

  const tabs: { key: Tab; label: string; doc?: string; count: number }[] = [
    {
      key: "extinguishers",
      label: "Fire Extinguishers",
      doc: "PIL/EHSD/CL/028-R1",
      count: register?.summary.total ?? 0,
    },
    { key: "assets", label: "All other fire assets", count: assets.length },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="rounded-lg px-3 py-2 text-left transition-colors"
              style={{
                background: on ? MX.navy : MX.paper,
                border: `1px solid ${on ? MX.navy : MX.iceLine}`,
              }}
            >
              {t.doc && (
                <div className="text-[9.5px] font-semibold tracking-wide" style={{ color: on ? MX.gold : MX.gold }}>
                  {t.doc}
                </div>
              )}
              <div
                className="text-[12.5px] font-semibold"
                style={{ color: on ? "#fff" : MX.navy, fontFamily: DISPLAY_FONT }}
              >
                {t.label}
                <span className="ml-1.5 font-sans text-[11px] font-normal" style={{ color: on ? "rgba(255,255,255,.7)" : MX.muted }}>
                  {t.count}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {tab === "extinguishers" ? (
        registerError || !register ? (
          <div
            className="rounded-xl border p-6 text-[13px]"
            style={{ borderColor: MX.red, background: MX.redSoft, color: MX.red }}
          >
            {registerError ?? "The extinguisher register could not be loaded."}
          </div>
        ) : (
          <RegisterTable payload={register} plants={plants} canWrite={canWrite} />
        )
      ) : assetsError ? (
        <div
          className="rounded-xl border p-6 text-[13px]"
          style={{ borderColor: MX.red, background: MX.redSoft, color: MX.red }}
        >
          {assetsError}
        </div>
      ) : (
        <AssetTable assets={assets} plants={plants} zones={zones} canWrite={canWrite} />
      )}
    </div>
  );
}
