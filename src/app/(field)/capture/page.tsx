import { CaptureGate } from "@/components/capture/gate";

// Field technicians land here as their home screen (Role.defaultLanding).
// The quick, guided, one-screen-at-a-time capture flow (voice + AI + per-flow
// fields) for all report types — the spec's mobile capture shell, NOT the full
// desktop forms. A thin server shell; everything interactive is client-side so
// the offline PWA can serve it from cache.
//
// `?fireAsset=<id>` is the "log a finding" entry point off a fire asset's QR
// sticker — the unscheduled-finding path, as distinct from the periodic
// checklist the same sticker also offers. The wizard treats it exactly like an
// in-wizard scan of that asset, so there is one code path for both doors.
export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const raw = sp.fireAsset;
  const fireAssetId = (Array.isArray(raw) ? raw[0] : raw) ?? null;
  return <CaptureGate view="wizard" fireAssetId={fireAssetId} />;
}
