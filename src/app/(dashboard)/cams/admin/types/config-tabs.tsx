"use client";

// CAMS type configuration — two tabs, both config, neither evidence.
//
// "Ownership of record" moved here from the Independence screen. It is the
// `DisciplineOwner` table the own-work guard reads: real configuration, not a
// duplicate of anything. It was sitting next to impartiality evidence, and
// config beside evidence is what made both look half-finished.

import { useState } from "react";
import { Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuditTypesAdmin } from "./audit-types-admin";
import { OwnershipOfRecord } from "./ownership-of-record";
import type { AuditType, Template } from "../../lib-cams";
import type { DisciplineOwnerRow } from "../../lib-assurance";
import type { PlantOption } from "@/lib/plant-context";

type Competency = { id: string; code: string; name: string; category?: string };
type Regime = { code: string; name: string; scoringStyle: string };
type Tab = "types" | "ownership";

export function CamsConfigTabs({
  auditTypes, templates, canConfig, competencies, regimes, owners, plants,
}: {
  auditTypes: AuditType[];
  templates: Template[];
  canConfig: boolean;
  competencies: Competency[];
  regimes: Regime[];
  owners: DisciplineOwnerRow[];
  plants: PlantOption[];
}) {
  const [tab, setTab] = useState<Tab>("types");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        <TabButton active={tab === "types"} onClick={() => setTab("types")}>
          <Shield size={14} /> Audit types
          <Count n={auditTypes.length} />
        </TabButton>
        <TabButton active={tab === "ownership"} onClick={() => setTab("ownership")}>
          <Users size={14} /> Ownership of record
          <Count n={owners.length} />
        </TabButton>
      </div>

      {tab === "types" && (
        <AuditTypesAdmin
          initial={auditTypes}
          templates={templates}
          canConfig={canConfig}
          competencies={competencies}
          regimes={regimes}
        />
      )}
      {tab === "ownership" && (
        <OwnershipOfRecord owners={owners} canConfig={canConfig} plants={plants} />
      )}
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">{n}</span>;
}

function TabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
        active
          ? "border-violet-600 text-violet-800"
          : "border-transparent text-slate-500 hover:text-slate-800",
      )}
    >
      {children}
    </button>
  );
}
