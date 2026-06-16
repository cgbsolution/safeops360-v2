import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, GraduationCap, Pencil, Plus, ClipboardList } from "lucide-react";
import { Can } from "@/components/auth/can";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const FREQ_LABEL: Record<string, string> = {
  DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly",
  QUARTERLY: "Quarterly", HALF_YEARLY: "Half-yearly", ANNUAL: "Annual"
};

export default async function InspectionTypeDetailPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("INSPECTION_TYPE.READ");
  const params = await props.params;
  const t = await prisma.inspectionType.findUnique({
    where: { id: params.id },
    include: {
      checklistTemplates: {
        orderBy: { version: "desc" },
        include: { _count: { select: { items: true, inspections: true } } }
      },
      defaultChecklistTemplate: true,
      equipmentLinks: {
        include: { equipment: { include: { plant: { select: { name: true, code: true } } } } },
        take: 50
      },
      _count: { select: { inspections: true } }
    }
  });
  if (!t) return notFound();

  return (
    <div>
      <PageHeader
        title={t.name}
        description={t.description ?? `${t.category.replace(/_/g, " ")} inspection type`}
        breadcrumbs={[
          { label: "Inspections", href: "/inspections" },
          { label: "Types", href: "/inspections/types" },
          { label: t.code }
        ]}
        action={
          <div className="flex gap-2">
            <Can permission="INSPECTION_TYPE.UPDATE">
              <Button asChild variant="ghost">
                <Link href={`/inspections/types/${t.id}/edit`}>
                  <Pencil size={14} /> Edit
                </Link>
              </Button>
            </Can>
            <Can permission="CHECKLIST_TEMPLATE.CREATE">
              <Button asChild>
                <Link href={`/inspections/checklists/new?inspectionTypeId=${t.id}`}>
                  <Plus size={14} /> New checklist
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Code" value={<span className="font-mono">{t.code}</span>} />
            <Field label="Category" value={<Badge>{t.category.replace(/_/g, " ")}</Badge>} />
            <Field label="Default frequency" value={FREQ_LABEL[t.defaultFrequency]} />
            <Field label="Status" value={t.isActive ? "Active" : "Retired"} />
            <Field
              label="Applicable equipment"
              value={
                t.applicableEquipmentCategories.length === 0 ? (
                  <span className="text-amber-700">— none — type is not assignable</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {t.applicableEquipmentCategories.map((c) => (
                      <Badge key={c} className="bg-slate-100 text-slate-700 border-slate-200">{c}</Badge>
                    ))}
                  </div>
                )
              }
              full
            />
            {t.defaultChecklistTemplate && (
              <Field
                label="Default checklist"
                value={
                  <Link
                    href={`/inspections/checklists/${t.defaultChecklistTemplate.id}`}
                    className="text-primary-700 hover:underline"
                  >
                    {t.defaultChecklistTemplate.name} <span className="text-slate-400">v{t.defaultChecklistTemplate.version}</span>
                  </Link>
                }
                full
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert size={16} className={t.isStatutory ? "text-rose-600" : "text-slate-300"} />
              Statutory
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {!t.isStatutory ? (
              <p className="text-slate-500">Not a statutory inspection.</p>
            ) : (
              <>
                <p><span className="text-slate-500">Reference:</span> {t.statutoryReference ?? "—"}</p>
                <p><span className="text-slate-500">Authority:</span> {t.regulatoryAuthority ?? "—"}</p>
                <p><span className="text-slate-500">Form type:</span> {t.statutoryFormType?.replace(/_/g, " ") ?? "—"}</p>
                <p><span className="text-slate-500">Retention:</span> {t.retentionYears} years</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap size={16} className={t.requiresCertifiedInspector ? "text-amber-600" : "text-slate-300"} />
              Inspector competency
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {!t.requiresCertifiedInspector ? (
              <p className="text-slate-500">Any user can be assigned as inspector.</p>
            ) : t.requiredCertificationCodes.length === 0 ? (
              <p className="text-amber-700">Gate enabled but no programs selected — gate will block all inspectors.</p>
            ) : (
              <div className="space-y-1">
                <p className="text-slate-500 mb-1">Inspector must hold:</p>
                {t.requiredCertificationCodes.map((c) => (
                  <Badge key={c} className="bg-amber-50 text-amber-700 border-amber-200 mr-1">{c}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Checklist templates ({t.checklistTemplates.length})</CardTitle>
            <CardDescription>All versions. The default is the one used at schedule generation unless overridden by the equipment link.</CardDescription>
          </CardHeader>
          <CardContent>
            {t.checklistTemplates.length === 0 ? (
              <p className="text-sm text-slate-500">No checklist templates yet. Create the first to enable schedule generation.</p>
            ) : (
              <div className="space-y-2">
                {t.checklistTemplates.map((c) => (
                  <Link
                    key={c.id}
                    href={`/inspections/checklists/${c.id}`}
                    className="block border border-slate-200 rounded-md p-3 hover:border-primary-300 hover:bg-primary-50/40"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-900">
                          {c.name} <span className="text-xs text-slate-400">v{c.version}</span>
                          {t.defaultChecklistTemplateId === c.id && (
                            <Badge className="ml-2 bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">DEFAULT</Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {c._count.items} items · {c._count.inspections} inspections used
                        </div>
                      </div>
                      <Badge
                        className={
                          c.approvalStatus === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : c.approvalStatus === "DRAFT"
                              ? "bg-slate-100 text-slate-700"
                              : c.approvalStatus === "UNDER_REVIEW"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-200 text-slate-500"
                        }
                      >
                        {c.approvalStatus.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coverage</CardTitle>
            <CardDescription>How many equipment items use this type, and how many inspection records exist.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><span className="text-slate-500">Equipment links:</span> {t.equipmentLinks.length}{t.equipmentLinks.length === 50 ? "+" : ""}</p>
            <p><span className="text-slate-500">Inspections recorded:</span> {t._count.inspections}</p>
          </CardContent>
        </Card>

        {t.equipmentLinks.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Equipment using this type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {t.equipmentLinks.map((l) => (
                  <div
                    key={l.id}
                    className="border border-slate-200 rounded-md p-2 text-sm"
                  >
                    <div className="font-medium">{l.equipment.name}</div>
                    <div className="text-xs text-slate-500">
                      {l.equipment.plant.code} · {l.equipment.code}
                      {l.frequencyOverride && ` · ${FREQ_LABEL[l.frequencyOverride]} (override)`}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}
