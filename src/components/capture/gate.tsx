"use client";

// Client-side auth gate for the (field) group. Server redirects are avoided
// on purpose (offline relaunch — DECISIONS.md D11): the session is checked in
// the browser, and every API write still requires the NextAuth cookie.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CaptureWizard } from "./wizard";
import { MyReports } from "./my-reports";

export function CaptureGate({
  view,
  // Carried from `/capture?fireAsset=<id>` — the "log a finding" door off a
  // fire asset's QR sticker, as opposed to scanning one inside the wizard.
  // Both paths end in the same wizard state.
  fireAssetId = null,
}: {
  view: "wizard" | "mine";
  fireAssetId?: string | null;
}) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E8EEF7] border-t-[#C9A961]" />
      </div>
    );
  }

  return view === "wizard" ? <CaptureWizard initialFireAssetId={fireAssetId} /> : <MyReports />;
}
