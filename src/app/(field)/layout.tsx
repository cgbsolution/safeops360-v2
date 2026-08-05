// Field route group — the low-literacy capture surface. Deliberately NOT the
// (dashboard) layout: no AppShell/sidebar chrome, no server-side session
// redirect (offline relaunch must render from cache — DECISIONS.md D11; the
// pages check the session client-side instead). Midnight Executive skin is
// scoped to this group.

import type { Metadata, Viewport } from "next";
import { SwRegistrar } from "@/components/capture/sw-registrar";

export const metadata: Metadata = {
  title: "SafeOps360 — Field Capture",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SafeOps Field" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // no pinch — spec 1.1.8; large type is built in
  themeColor: "#0B1F4D",
};

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#F4F7FC] text-[#1A1A2E]">
      <SwRegistrar />
      {children}
    </div>
  );
}
