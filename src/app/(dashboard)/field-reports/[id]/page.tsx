import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { backendFetch, BackendError } from "@/lib/backend/fetch";
import type { SubmissionOut } from "@/lib/capture/types";
import { MediaGallery } from "./media-gallery";
import { TriagePanel } from "./triage-panel";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const CONVERTED_HREF: Record<string, (id: string) => string> = {
  Observation: (id) => `/observations/${id}`,
  NearMiss: (id) => `/near-miss/${id}`,
  Incident: (id) => `/incidents/${id}`,
};

// Friendly, non-crashing states so a permission/backend error shows a clear
// message with a way out — instead of the generic "This page didn't load".
function CenteredNotice({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">{icon}</div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link href="/field-reports" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
          Back to Field Reports
        </Link>
        <Link href="/dashboard" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
          Dashboard
        </Link>
      </div>
    </div>
  );
}

export default async function FieldReportDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  let sub: SubmissionOut;
  try {
    sub = await backendFetch<SubmissionOut>(`/api/capture/submissions/${id}`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    // No permission — field reports are reviewed by safety officers, and a
    // worker can only open their own. Show a clear message, not a crash.
    if (e instanceof BackendError && (e.status === 403 || e.status === 401)) {
      return (
        <CenteredNotice
          icon={<ShieldAlert className="h-7 w-7 text-amber-600" />}
          title="You don't have access to this report"
          body="Field reports are reviewed by safety officers, and you can only open reports you raised yourself. Ask your HSE manager if you need review access."
        />
      );
    }
    // Any other backend error — don't crash the whole page; explain and offer a way back.
    return (
      <CenteredNotice
        icon={<AlertTriangle className="h-7 w-7 text-rose-600" />}
        title="This report couldn't be loaded"
        body={e instanceof BackendError && e.message ? e.message : "A server error stopped this report from loading. Please try again."}
      />
    );
  }

  const l1 = sub.categorySnapshot?.l1;
  const l2 = sub.categorySnapshot?.l2;
  const convertedHref =
    sub.converted.entityType && sub.converted.entityId
      ? CONVERTED_HREF[sub.converted.entityType]?.(sub.converted.entityId)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Field Report ${sub.number}`}
        breadcrumbs={[{ label: "Field Reports", href: "/field-reports" }, { label: sub.number }]}
        description="Raw guided-capture submission — review the evidence, triage on the 5×5 matrix, then convert it into the right module record."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* summary */}
          <Card className="p-5 shadow-none">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Report</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium capitalize">{sub.type.replace("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">{sub.status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium">
                  {l1 ? `${l1.labels?.en ?? l1.code}${l2 ? " — " + (l2.labels?.en ?? l2.code) : ""}` : "—"}
                  {sub.aiSuggested ? <span className="ml-2 rounded bg-violet-50 px-1.5 py-0.5 text-xs text-violet-700">AI suggested</span> : null}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Self-reported severity</dt>
                <dd className="font-medium capitalize">{sub.severitySelfReported}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reporter</dt>
                <dd className="font-medium">
                  {sub.isAnonymous ? "Anonymous (masked)" : (sub.reporter?.name ?? "—")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reported</dt>
                <dd className="font-medium">
                  {sub.createdAt ? new Date(sub.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                  {sub.capture.offline ? " · synced offline" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Location</dt>
                <dd className="font-medium">
                  {sub.areaId ? `Area ${sub.areaId}` : "—"}
                  {sub.qrScanned ? " · via QR" : ""}
                  {sub.equipmentId ? ` · equipment ${sub.equipmentId}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Capture metrics</dt>
                <dd className="font-medium">
                  {sub.capture.tapCount != null ? `${sub.capture.tapCount} taps` : "—"}
                  {sub.capture.durationMs != null ? ` · ${Math.round(sub.capture.durationMs / 1000)}s` : ""}
                  {sub.capture.deviceLang ? ` · ${sub.capture.deviceLang}` : ""}
                </dd>
              </div>
            </dl>
            {sub.description ? (
              <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm">{sub.description}</p>
            ) : null}
            {sub.transcriptOriginal || sub.transcriptEnglish ? (
              <div className="mt-4 space-y-2">
                {sub.transcriptOriginal ? (
                  <p className="rounded-md bg-muted/50 p-3 text-sm">
                    <span className="mr-2 text-xs font-semibold uppercase text-muted-foreground">Voice ({sub.voiceLangCode ?? "?"})</span>
                    {sub.transcriptOriginal}
                  </p>
                ) : null}
                {sub.transcriptEnglish ? (
                  <p className="rounded-md bg-muted/50 p-3 text-sm">
                    <span className="mr-2 text-xs font-semibold uppercase text-muted-foreground">English</span>
                    {sub.transcriptEnglish}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>

          {/* evidence */}
          <Card className="p-5 shadow-none">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Evidence ({sub.attachments.length})
            </h2>
            <MediaGallery submissionId={sub.id} attachments={sub.attachments} />
          </Card>
        </div>

        <div className="space-y-6">
          {convertedHref ? (
            <Card className="border-emerald-200 bg-emerald-50 p-5 text-sm shadow-none">
              <p className="font-semibold text-emerald-800">Converted</p>
              <p className="mt-1 text-emerald-700">
                This report became{" "}
                <Link href={convertedHref} className="font-medium underline underline-offset-2">
                  {sub.converted.entityType}
                </Link>
                {sub.converted.at ? ` on ${new Date(sub.converted.at).toLocaleDateString("en-IN")}` : ""}.
              </p>
            </Card>
          ) : null}
          <TriagePanel sub={sub} />
        </div>
      </div>
    </div>
  );
}
