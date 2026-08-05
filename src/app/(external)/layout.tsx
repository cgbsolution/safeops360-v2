// External route group — surfaces reached by people who have no account.
//
// Deliberately NOT the (dashboard) layout: no AppShell, no sidebar, no session
// redirect and no permission provider, because the visitor is a supplier's
// factory manager holding a link, not a user. The (field) group set the
// precedent for a chrome-free group; this one goes further by having no auth
// concept at all.
//
// Everything here authenticates by token at the API layer.

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "SafeOps360 — Corrective Actions",
  // An external link should not turn up in search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function ExternalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-slate-50 text-slate-900">{children}</div>;
}
