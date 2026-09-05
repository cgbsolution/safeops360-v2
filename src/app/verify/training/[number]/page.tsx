// PUBLIC verification page — accessed by anyone scanning the QR code on
// a printed/PDF certificate, OR by an auditor entering the cert number.
// No authentication required. Calls the backend's public verify
// endpoint directly (bypassing the auth-aware proxy) so that an
// unauthenticated viewer doesn't trigger a login redirect.

import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  XCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

type VerifyData = {
  certificateNumber: string;
  programName: string;
  holderName: string;
  plantName: string | null;
  issuedAt: string;
  validFrom: string;
  validTo: string | null;
  status: string;
  isStatutory: boolean;
  statutoryReference: string | null;
  revoked: boolean;
  revocationReason: string | null;
};

async function fetchVerify(number: string): Promise<VerifyData | null> {
  try {
    const r = await fetch(
      `${BACKEND_URL.replace(/\/$/, "")}/api/training/certificates/verify/${encodeURIComponent(
        number
      )}`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    return (await r.json()) as VerifyData;
  } catch {
    return null;
  }
}

const STATUS_DISPLAY: Record<
  string,
  { label: string; tone: "valid" | "warn" | "expired" | "revoked" }
> = {
  ACTIVE: { label: "Valid", tone: "valid" },
  EXPIRING_SOON: { label: "Valid (expiring soon)", tone: "warn" },
  EXPIRED: { label: "Expired", tone: "expired" },
  LAPSED: { label: "Lapsed", tone: "expired" },
  REVOKED: { label: "REVOKED", tone: "revoked" },
};

export default async function VerifyTrainingCertificatePage(props: {
  params: Promise<{ number: string }>;
}) {
  const params = await props.params;
  const data = await fetchVerify(params.number);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md w-full bg-white rounded-xl shadow-sm border border-rose-200 p-8 text-center">
          <XCircle size={56} className="mx-auto mb-4 text-rose-600" />
          <h1 className="text-xl font-bold text-rose-900 mb-2">
            Certificate not found
          </h1>
          <p className="text-sm text-slate-600">
            No certificate exists with the number{" "}
            <span className="font-mono">{params.number}</span>. Verify you've
            entered the correct number, or contact the issuing plant.
          </p>
        </Alert>
      </div>
    );
  }

  const display = STATUS_DISPLAY[data.status] ?? { label: data.status, tone: "valid" as const };
  const cardBorder =
    display.tone === "valid"
      ? "border-emerald-300"
      : display.tone === "warn"
      ? "border-amber-300"
      : display.tone === "expired"
      ? "border-slate-300"
      : "border-rose-300";
  const banner =
    display.tone === "valid"
      ? "bg-emerald-600 text-white"
      : display.tone === "warn"
      ? "bg-amber-600 text-white"
      : display.tone === "expired"
      ? "bg-slate-600 text-white"
      : "bg-rose-600 text-white";

  const Icon =
    display.tone === "valid"
      ? CheckCircle2
      : display.tone === "warn"
      ? AlertTriangle
      : display.tone === "revoked"
      ? XCircle
      : XCircle;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-primary-700 text-white px-4 py-2 rounded-md font-semibold text-sm">
            S360 SafeOps360 — Certificate Verification
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Independent verification of training records
          </p>
        </div>

        {/* Result card */}
        <div className={`bg-white rounded-xl shadow-md border-2 ${cardBorder} overflow-hidden`}>
          <div className={`${banner} px-6 py-4 flex items-center gap-3`}>
            <Icon size={28} />
            <div>
              <div className="text-xs uppercase tracking-wider opacity-90">Status</div>
              <div className="text-xl font-bold">{display.label}</div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {data.revoked && (
              <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <strong>This certificate has been revoked.</strong>
                {data.revocationReason && (
                  <> Reason category: {data.revocationReason.replace(/_/g, " ").toLowerCase()}.</>
                )}{" "}
                Revoked certificates are not valid for any operational purpose.
              </Alert>
            )}

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Field label="Certificate Number" value={data.certificateNumber} mono />
              <Field label="Holder" value={data.holderName} />
              <Field label="Program" value={data.programName} />
              <Field label="Plant" value={data.plantName ?? "—"} />
              <Field label="Issued" value={formatDate(data.issuedAt)} />
              <Field label="Valid From" value={formatDate(data.validFrom)} />
              <Field
                label="Valid Until"
                value={data.validTo ? formatDate(data.validTo) : "Lifetime"}
              />
              <Field
                label="Statutory"
                value={
                  data.isStatutory
                    ? data.statutoryReference ?? "Yes"
                    : "No"
                }
              />
            </div>

            {data.isStatutory && (
              <Alert variant="destructive" className="rounded-md border border-rose-200 bg-rose-50/60 p-3 flex items-start gap-2 text-xs text-rose-800">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <div>
                  This is a <strong>statutory training</strong> certificate.
                  {data.statutoryReference && (
                    <> Issued under {data.statutoryReference}.</>
                  )}{" "}
                  Statutory records are subject to regulatory inspection.
                </div>
              </Alert>
            )}
          </div>

          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 text-[11px] text-slate-500 text-center">
            Verification served at {new Date().toLocaleString()} UTC. This page
            queries the issuing plant's record directly — no third party caches
            this data.
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Found a discrepancy? Contact the plant's HSE Manager or report to{" "}
          <span className="font-mono">hse@vizionforge.com</span>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={[
          "font-medium text-slate-900 mt-0.5",
          mono ? "font-mono text-xs" : "text-sm",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
