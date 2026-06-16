import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Leaf,
  ArrowLeft,
  ClipboardList,
  Wind,
  Scale,
  ShieldCheck,
  Gavel,
  CalendarClock,
  History,
  ArrowRight
} from "lucide-react";

export const dynamic = "force-dynamic";

// EAI quick-start guide. Linked from the EAI register empty state
// (src/app/(dashboard)/eai/page.tsx → "EAI quick-start guide").
// Content mirrors the actual implementation: status lifecycle from the
// register's STATUS_OPTIONS, and the significance bands from the backend
// _resolve_impact_level (LOW ≤4, MODERATE ≤9, SIGNIFICANT ≤16, MAJOR >16).

const LIFECYCLE = [
  { code: "DRAFT", label: "Draft", note: "Study scaffold created; scope and team being defined." },
  { code: "IN_PROGRESS", label: "In Progress", note: "Entries being added — activities, aspects, impacts, controls." },
  { code: "TEAM_REVIEW", label: "Team Review", note: "Cross-functional team reviews entries and scoring." },
  { code: "APPROVAL_PENDING", label: "Approval Pending", note: "Awaiting sign-off from the approving authority." },
  { code: "ACTIVE", label: "Active", note: "Approved and live; drives the plant's significant-aspect register." },
  { code: "SUPERSEDED", label: "Superseded", note: "Replaced by a newer revision after a review cycle." }
];

const BANDS = [
  { level: "LOW", range: "1 – 4", color: "bg-emerald-100 text-emerald-800 border-emerald-200", sig: "Not significant" },
  { level: "MODERATE", range: "5 – 9", color: "bg-amber-100 text-amber-800 border-amber-200", sig: "Not significant" },
  { level: "SIGNIFICANT", range: "10 – 16", color: "bg-orange-100 text-orange-800 border-orange-200", sig: "Significant" },
  { level: "MAJOR", range: "17 – 25", color: "bg-rose-100 text-rose-800 border-rose-200", sig: "Significant" }
];

export default async function EaiDocsPage(
  props: { searchParams: Promise<{ plantId?: string }> }
) {
  const { plantId } = await props.searchParams;
  const registerHref = plantId ? `/eai?plantId=${plantId}` : "/eai";

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="EAI Quick-Start Guide"
        description="How to build an ISO 14001 §6.1.2 environmental aspect & impact register"
        breadcrumbs={[
          { label: "EAI — Environmental Register", href: registerHref },
          { label: "Quick-start guide" }
        ]}
        action={
          <Button asChild variant="outline">
            <Link href={registerHref}>
              <ArrowLeft size={16} /> Back to register
            </Link>
          </Button>
        }
      />

      {/* Intro */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 mb-6 flex gap-4">
        <div className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100">
          <Leaf className="text-emerald-600" size={22} />
        </div>
        <div className="text-sm text-emerald-900">
          An <strong>EAI study</strong> scopes a plant, department, area, or process and
          systematically identifies its <strong>environmental aspects</strong> (the ways an
          activity interacts with the environment — air emissions, effluent, waste, noise,
          resource use) and the <strong>impacts</strong> those aspects cause. Each entry is
          scored on an impact matrix so the most <strong>significant</strong> aspects rise to
          the top and drive controls, compliance obligations, and periodic review.
        </div>
      </div>

      {/* Step-by-step */}
      <h2 className="text-lg font-semibold text-slate-900 mb-3">The workflow</h2>
      <div className="space-y-3 mb-8">
        <StepCard
          n={1}
          icon={<ClipboardList size={18} className="text-emerald-600" />}
          title="Create a study & set its scope"
          body="Start a new EAI study, choose the scope (whole plant, a department, an area, or a specific process/activity set), assign a team leader and team members, and pick the environmental impact matrix to score against. The study gets a number like EAI-2026-LMS-001."
        />
        <StepCard
          n={2}
          icon={<Wind size={18} className="text-emerald-600" />}
          title="Add entries — activity → aspects → impacts"
          body="For each activity in scope, add an entry describing the activity, where it happens, and how often. Attach the environmental aspects it produces (from the aspect library), then describe the resulting impacts — affected receptor, impact type, reversibility, and geographic/temporal extent."
        />
        <StepCard
          n={3}
          icon={<Scale size={18} className="text-emerald-600" />}
          title="Score initial significance"
          body="Pick a likelihood and a magnitude from the matrix. The system multiplies them into an impact score and assigns a band (see below). Aspects landing in SIGNIFICANT or MAJOR are flagged as significant and counted on the register dashboard."
        />
        <StepCard
          n={4}
          icon={<ShieldCheck size={18} className="text-emerald-600" />}
          title="Record controls & re-score residual"
          body="List the existing controls already in place (by hierarchy — elimination, substitution, engineering, administrative, PPE) and any recommended controls to add. Re-score the residual likelihood/magnitude to show the risk after controls, and mark whether the residual is acceptable."
        />
        <StepCard
          n={5}
          icon={<Gavel size={18} className="text-emerald-600" />}
          title="Link compliance obligations"
          body="Attach the regulations that apply (e.g. Air/Water Acts, Hazardous Waste Rules) with permitted limits, monitoring frequency, and reporting authority. These become trackable compliance obligations tied to the entry."
        />
        <StepCard
          n={6}
          icon={<CalendarClock size={18} className="text-emerald-600" />}
          title="Submit, approve & review"
          body="Move the study through Team Review and Approval. Once Active it sets a next-review date. Reviews are either scheduled (annual by default) or triggered by events — and each change is captured as an immutable version."
        />
      </div>

      {/* Lifecycle */}
      <h2 className="text-lg font-semibold text-slate-900 mb-3">Study lifecycle</h2>
      <Card className="mb-8">
        <CardContent className="p-0">
          <ul className="divide-y divide-slate-100">
            {LIFECYCLE.map((s, i) => (
              <li key={s.code} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {i + 1}
                </span>
                <span className="font-medium text-slate-800 w-40 shrink-0">{s.label}</span>
                <span className="text-slate-500">{s.note}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Significance bands */}
      <h2 className="text-lg font-semibold text-slate-900 mb-1">How significance is scored</h2>
      <p className="text-sm text-slate-500 mb-3">
        Impact score = <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">likelihood × magnitude</code>.
        The score maps to a band:
      </p>
      <Card className="mb-8">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="text-left px-5 py-2.5">Band</th>
                <th className="text-left px-5 py-2.5">Score range</th>
                <th className="text-left px-5 py-2.5">Significant?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {BANDS.map((b) => (
                <tr key={b.level}>
                  <td className="px-5 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded border ${b.color}`}>
                      {b.level}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-slate-700">{b.range}</td>
                  <td className="px-5 py-2.5 text-slate-700">
                    {b.sig === "Significant" ? (
                      <span className="font-medium text-rose-700">{b.sig}</span>
                    ) : (
                      <span className="text-slate-400">{b.sig}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Reviews & versioning */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock size={16} className="text-emerald-600" /> Review cycles
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 pt-0">
            Active entries carry a next-review date. Reviews are <strong>scheduled</strong> (annual
            by default, or a custom frequency) or <strong>triggered</strong> by events such as an
            incident, a process change, or a regulatory update. Completing a cycle records the
            outcome and bumps the entry&apos;s review count.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History size={16} className="text-emerald-600" /> Versioning
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 pt-0">
            Every material change to an entry is snapshotted as an immutable version with the
            reason and trigger. You can always trace what an aspect&apos;s scoring and controls
            looked like at any point — important for ISO 14001 audits.
          </CardContent>
        </Card>
      </div>

      {/* CTA */}
      <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-6 text-center">
        <div className="text-base font-semibold text-slate-800">Ready to start?</div>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          Head back to the register and create your first EAI study for this plant.
        </p>
        <Button asChild>
          <Link href={registerHref}>
            Go to EAI register <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function StepCard({
  n,
  icon,
  title,
  body
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4 rounded-xl border bg-white p-4">
      <div className="shrink-0 flex flex-col items-center gap-1">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
          {n}
        </span>
      </div>
      <div>
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          {icon} {title}
        </div>
        <p className="text-sm text-slate-600 mt-1">{body}</p>
      </div>
    </div>
  );
}
