import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronRight, ListChecks, Sparkles } from "lucide-react";
import { requirePermission } from "@/lib/auth/server";
import { MASTER_TYPES, getMasterTypeMeta } from "@/lib/masters/registry";
import { NewDropdownTypeButton } from "./new-type-button";

export const dynamic = "force-dynamic";

export default async function DropdownsListPage() {
  await requirePermission("CONFIGURATION.MASTERS");

  // Aggregate counts per type
  const counts = await prisma.masterItem.groupBy({
    by: ["type"],
    _count: { type: true },
    _sum: { sortOrder: true }
  });
  const activeCounts = await prisma.masterItem.groupBy({
    by: ["type"],
    where: { active: true },
    _count: { type: true }
  });

  const knownTypes = new Set(MASTER_TYPES.map((t) => t.type));
  const seenTypes = new Set(counts.map((c) => c.type));
  const customTypes = [...seenTypes].filter((t) => !knownTypes.has(t));

  function totalCount(type: string) {
    return counts.find((c) => c.type === type)?._count.type ?? 0;
  }
  function activeCount(type: string) {
    return activeCounts.find((c) => c.type === type)?._count.type ?? 0;
  }

  return (
    <div>
      <PageHeader
        title="Form Dropdowns"
        description="Manage values used in module form dropdowns. Add or remove options without a code change — values appear in forms on the next page load."
        breadcrumbs={[
          { label: "Configuration", href: "/configuration" },
          { label: "Dropdowns" }
        ]}
        action={<NewDropdownTypeButton />}
      />

      <div className="mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mt-4 mb-2">Predefined types</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {MASTER_TYPES.map((t) => (
          <Link
            key={t.type}
            href={`/configuration/dropdowns/${t.type}`}
            className="group block border border-slate-200 rounded-lg p-4 bg-white hover:border-primary-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks size={16} className="text-primary-600" />
                <h3 className="font-medium text-slate-900">{t.label}</h3>
              </div>
              <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                {activeCount(t.type)}/{totalCount(t.type)}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {t.consumedIn.slice(0, 3).map((c) => (
                <span key={c} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5">
                  {c}
                </span>
              ))}
              {t.consumedIn.length > 3 && (
                <span className="text-[10px] text-slate-400">+{t.consumedIn.length - 3}</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {customTypes.length > 0 && (
        <>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mt-6 mb-2">
            <Sparkles size={12} className="inline mr-1" /> Custom types created by admins
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {customTypes.map((type) => (
              <Link
                key={type}
                href={`/configuration/dropdowns/${type}`}
                className="block border border-violet-200 rounded-lg p-4 bg-violet-50/30 hover:border-violet-400"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-sm font-medium">{type}</h3>
                  <Badge className="bg-violet-100 text-violet-700">
                    {activeCount(type)}/{totalCount(type)}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">Custom — created by admin.</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
