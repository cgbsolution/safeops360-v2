import { RcaFieldGate } from "@/components/capture/rca-field-gate";

// Technician-facing guided RCA contribution (spec 1.3). Same low-literacy
// pattern as the capture wizard: context card with TTS, cascading cause
// picker (fishbone bones → narrow), prevention suggestions, voice notes.
export default async function RcaFieldPage(props: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await props.params;
  return <RcaFieldGate requestId={requestId} />;
}
