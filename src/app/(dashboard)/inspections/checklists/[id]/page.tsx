import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, AlertCircle, Camera, MessageSquare, Star, ShieldAlert } from "lucide-react";
import { Can } from "@/components/auth/can";
import { ChecklistApprovalActions } from "../checklist-approval-actions";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RETIRED: "bg-slate-200 text-slate-500 border-slate-300"
};

const ITEM_TYPE_LABEL: Record<string, string> = {
  PASS_FAIL: "Pass / Fail",
  NUMERIC: "Numeric",
  MEASUREMENT: "Measurement",
  SELECT: "Select",
  TEXT: "Text",
  PHOTO: "Photo",
  SIGNATURE: "Signature",
  CHECKBOX: "Checkbox",
  SECTION_HEADER: "Section"
};

export default async function ChecklistDetailPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("CHECKLIST_TEMPLATE.READ");
  const params = await props.params;
  const t = await prisma.checklistTemplate.findUnique({
    where: { id: params.id },
    include: {
      items: { orderBy: { sequence: "asc" } },
      inspectionType: true,
      approvedBy: { select: { name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { inspections: true, equipmentOverrides: true } }
    }
  });
  if (!t) return notFound();

  const criticalCount = t.items.filter((i) => i.isCritical).length;
  const photoCount = t.items.filter((i) => i.requiresPhoto).length;

  return (
    <div>
      <PageHeader
        title={t.name}
        description={`${t.code} · v${t.version}`}
        breadcrumbs={[
          { label: "Inspections", href: "/inspections" },
          { label: "Checklists", href: "/inspections/checklists" },
          { label: t.code }
        ]}
        action={
          <div className="flex gap-2">
            <Badge className={STATUS_BADGE[t.approvalStatus]}>{t.approvalStatus.replace(/_/g, " ")}</Badge>
            {t.approvalStatus !== "APPROVED" && t.approvalStatus !== "RETIRED" && (
              <Can permission="CHECKLIST_TEMPLATE.UPDATE">
                <Button asChild variant="ghost">
                  <Link href={`/inspections/checklists/${t.id}/edit`}>
                    <Pencil size={14} /> Edit
                  </Link>
                </Button>
              </Can>
            )}
            <ChecklistApprovalActions templateId={t.id} status={t.approvalStatus} />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items ({t.items.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {t.items.map((it) => {
              const isSection = it.itemType === "SECTION_HEADER";
              return (
                <div
                  key={it.id}
                  className={[
                    "p-3 rounded-md border",
                    isSection ? "bg-slate-50 border-slate-300" : "border-slate-200"
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-xs text-slate-400 mt-1">{it.sequence}.</span>
                    <div className="flex-1">
                      <div className={["flex items-center gap-2", isSection ? "font-semibold text-base" : "font-medium"].join(" ")}>
                        {it.itemText}
                        {it.isCritical && (
                          <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                            <Star size={9} className="fill-rose-600" /> CRITICAL
                          </Badge>
                        )}
                      </div>
                      {!isSection && (
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
                          <Badge className="bg-slate-100 text-slate-700 border-slate-200">{ITEM_TYPE_LABEL[it.itemType]}</Badge>
                          {it.units && <span>units: {it.units}</span>}
                          {(it.minValue !== null || it.maxValue !== null) && (
                            <span>
                              Range: {it.minValue ?? "-∞"} – {it.maxValue ?? "+∞"}
                            </span>
                          )}
                          {it.expectedValue && <span>Expected: {it.expectedValue}</span>}
                          {it.requiresPhoto && <span className="flex items-center gap-1"><Camera size={10} /> photo</span>}
                          {it.requiresComment && <span className="flex items-center gap-1"><MessageSquare size={10} /> comment</span>}
                        </div>
                      )}
                      {it.guidanceText && (
                        <div className="text-xs text-slate-600 mt-1 italic">{it.guidanceText}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><span className="text-slate-500">Type:</span>{" "}
                <Link href={`/inspections/types/${t.inspectionTypeId}`} className="text-primary-700 hover:underline flex items-center gap-1">
                  {t.inspectionType.isStatutory && <ShieldAlert size={10} className="text-rose-600" />}
                  {t.inspectionType.name}
                </Link>
              </p>
              <p><span className="text-slate-500">Version:</span> v{t.version}</p>
              <p><span className="text-slate-500">Items:</span> {t.items.length}</p>
              <p><span className="text-slate-500">Critical:</span> {criticalCount}</p>
              <p><span className="text-slate-500">Photo-required:</span> {photoCount}</p>
              <p><span className="text-slate-500">Used in:</span> {t._count.inspections} inspections</p>
              <p><span className="text-slate-500">Equipment overrides:</span> {t._count.equipmentOverrides}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval audit</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><span className="text-slate-500">Created by:</span> {t.createdBy?.name ?? "—"}</p>
              <p><span className="text-slate-500">Approval status:</span>{" "}
                <Badge className={STATUS_BADGE[t.approvalStatus]}>{t.approvalStatus.replace(/_/g, " ")}</Badge>
              </p>
              {t.approvedBy && (
                <p><span className="text-slate-500">Approved by:</span> {t.approvedBy.name} on {t.approvedAt ? new Date(t.approvedAt).toLocaleDateString() : "—"}</p>
              )}
              {t.effectiveFrom && (
                <p><span className="text-slate-500">Effective from:</span> {new Date(t.effectiveFrom).toLocaleDateString()}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
