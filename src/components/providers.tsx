"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ToastProvider } from "@/components/ui/toast";

// `session` is hydrated from the server in the root layout via
// getServerSession — passing it here skips the client's initial /api/auth/session
// round-trip on every navigation. refetchOnWindowFocus=false stops NextAuth
// from re-pinging the endpoint every time the tab regains focus, which was
// the source of the "auth checks on every page" behavior in dev logs.
export function Providers({
  children,
  session
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider
      session={session}
      refetchOnWindowFocus={false}
      // JWT decode is local, so we never need to refetch — the cookie change
      // events that SessionProvider listens to (sign-in / sign-out) still fire.
      refetchInterval={0}
    >
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
