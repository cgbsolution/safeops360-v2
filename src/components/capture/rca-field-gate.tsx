"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { RcaFieldFlow } from "./rca-field-flow";

// Client-side auth gate (offline relaunch friendly, like CaptureGate).
export function RcaFieldGate({ requestId }: { requestId: string }) {
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
  return <RcaFieldFlow requestId={requestId} />;
}
