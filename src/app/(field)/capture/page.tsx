import { CaptureGate } from "@/components/capture/gate";

// Field technicians land here as their home screen (Role.defaultLanding).
// The quick, guided, one-screen-at-a-time capture flow (voice + AI + per-flow
// fields) for all report types — the spec's mobile capture shell, NOT the full
// desktop forms. A thin server shell; everything interactive is client-side so
// the offline PWA can serve it from cache.
export default function CapturePage() {
  return <CaptureGate view="wizard" />;
}
