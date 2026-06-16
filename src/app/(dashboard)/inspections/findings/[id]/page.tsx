import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Star, AlertTriangle } from "lucide-react";
import { FindingActions } from "../finding-actions";
import { FindingCapaList } from "../finding-capa-list";
import { requirePermission } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-rose-100 text-rose-800 border-rose-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  DEFERRED: "bg-slate-200 text-slate-600 border-slate-300",
  DUPLICATE: "bg-slate-100 text-slate-500 border-slate-200",
  CLOSED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  VERIFIED: "bg-emerald-600 text-white border-emerald-700"
};

const SEV_BADGE: Record<string, string> = {
  CRITICAL: "bg-rose-600 text-white",
  HIGH: "bg-rose-100 text-rose-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-slate-100 text-slate-700"
};

export default async function FindingDetailPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("INSPECTION_FINDING.READ");
  const params = await props.params;
  const f = await prisma.inspectionFinding.findUnique({
    where: { id: params.id },
    include: {
      inspection: {
        select: {
          id: true, number: true, plantId: true, scheduledDate: true,
          plant: { select: { name: true, code: true } },
          equipment: { select: { id: true, name: true, code: true } },
          inspectionType: { select: { name: true, isStatutory: true } }
        }
      },
      itemResult: { select: { sequence: true, itemTextSnapshot: true, valueText: true, valueNumeric: true } },
      owner: { select: { id: true, name: true, email: true } },
      closedBy: { select: { name: true } },
      verifiedBy: { select: { name: true } },
      effectivenessReviewedBy: { select: { name: true } },
      capas: {
        include: {
          owner: { select: { name: true } },
          completedBy: { select: { name: true } },
          verifiedBy: { select: { name: true } }
        },
        orderBy: { createdAt: "asc" }
      },
      duplicateOfFinding: { select: { id: true, findingNumber: true, title: true } }
    }
  });
  if (!f) return notFound();

  const overdue = f.dueDate && f.dueDate < new Date() && !["CLOSED", "VERIFIED", "DUPLICATE"].includes(f.status);

  return (
    <div>
      <PageHeader
        title={f.title}
        description={`${f.findingNumber} · spawned from ${f.inspection.number}`}
        breadcrumbs={[
          { label: "Inspections", href: "/inspections" },
          { label: "Findings", href: "/inspections/findings" },
          { label: f.findingNumber }
        ]}
        action={
          <div className="flex gap-2 items-center">
            <Badge className={SEV_BADGE[f.severity]}>
              {f.isCritical && <Star size={10} className="fill-current" />}
              {f.severity}
            </Badge>
            <Badge className={STATUS_BADGE[f.status]}>{f.status.replace(/_/g, " ")}</Badge>
          </div>
        }
      />

      {overdue && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="text-rose-600" />
          This finding is past its due date ({f.dueDate?.toLocaleDateString()}).
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{f.description}</p>
            {f.rootCauseCategory && (
              <div className="mt-3 text-xs">
                <span className="text-slate-500">Root cause category:</span>{" "}
                <Badge className="bg-blue-50 text-blue-700">{f.rootCauseCategory}</Badge>
              </div>
            )}
            {f.rootCauseNote && (
              <div className="mt-2 text-xs">
                <span className="text-slate-500">Root cause note:</span>
                <div className="text-slate-700 mt-1">{f.rootCauseNote}</div>
              </div>
            )}
            {f.itemResult && (
              <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="text-slate-500 mb-1">Source item ({f.itemResult.sequence})</div>
                <div className="font-medium">{f.itemResult.itemTextSnapshot}</div>
                {(f.itemResult.valueText || f.itemResult.valueNumeric !== null) && (
                  <div className="mt-1 text-slate-600">
                    Value: {f.itemResult.valueNumeric ?? f.itemResult.valueText}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <Field label="Plant" value={`${f.inspection.plant.name} (${f.inspection.plant.code})`} />
            <Field
              label="Equipment"
              value={<span className="text-slate-900">{f.inspection.equipment.name}</span>}
            />
            <Field
              label="Type"
              value={
                <span className="flex items-center gap-1">
                  {f.inspection.inspectionType?.isStatutory && <ShieldAlert size={11} className="text-rose-600" />}
                  {f.inspection.inspectionType?.name ?? "—"}
                </span>
              }
            />
            <Field label="Owner" value={f.owner ? f.owner.name : <span className="text-amber-700">— unassigned —</span>} />
            <Field label="Due" value={f.dueDate ? f.dueDate.toLocaleDateString() : "—"} />
            {f.closedBy && <Field label="Closed by" value={`${f.closedBy.name} on ${f.closedAt?.toLocaleDateString()}`} />}
            {f.verifiedBy && <Field label="Verified by" value={`${f.verifiedBy.name} on ${f.verifiedAt?.toLocaleDateString()}`} />}
            {f.duplicateOfFinding && (
              <Field
                label="Duplicate of"
                value={
                  <Link href={`/inspections/findings/${f.duplicateOfFinding.id}`} className="text-primary-700 hover:underline">
                    {f.duplicateOfFinding.findingNumber}
                  </Link>
                }
              />
            )}
            {f.effectivenessReviewedAt && (
              <Field
                label="Effectiveness review"
                value={`${f.effectivenessReviewedBy?.name ?? "—"} · ${f.effectivenessRating ?? "—"}`}
              />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <FindingActions findingId={f.id} status={f.status} severity={f.severity} ownerId={f.ownerId} />
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>CAPAs ({f.capas.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <FindingCapaList findingId={f.id} capas={f.capas as any} status={f.status} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-slate-500 text-xs uppercase tracking-wide">{label}</span>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
