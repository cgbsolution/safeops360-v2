"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { RcaFieldFlow } from "./rca-field-flow";
import { Spinner } from "@/components/ui/spinner";

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
        <Spinner size="lg" tone="gold" />
      </div>
    );
  }
  return <RcaFieldFlow requestId={requestId} />;
}
