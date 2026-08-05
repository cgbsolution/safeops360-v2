"use client";

// Route guard (build prompt §5.2): blocks direct navigation to a module the
// licence doesn't include and renders a "not in your edition" page instead.
// One guard for the whole content area — maps the current pathname to a module
// and checks entitlement. Core/unmatched routes always pass.
//
// This is UX hardening; the Python API independently 403s the same module, so
// even if this guard were bypassed the data stays protected.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { moduleForPath } from "@/lib/licensing/route-map";
import { useLicence } from "./licence-provider";

export function ModuleRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hasModule, loading, view } = useLicence();

  const moduleCode = moduleForPath(pathname);
  // Pass while loading / on fetch error (fail open — API still enforces), for
  // core routes, and for entitled modules.
  if (!moduleCode || loading || !view || hasModule(moduleCode)) {
    return <>{children}</>;
  }

  return (
    <div>
      <PageHeader
        title="Not included in your edition"
        description="This module isn’t part of your current licence"
      />
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 max-w-2xl">
        <div className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
          <Lock size={18} className="text-slate-500" />
          This module isn’t enabled on your licence
        </div>
        <p className="text-sm text-slate-600">
          Your edition
          {view.editionName ? ` (${view.editionName})` : ""} doesn’t include this module. Contact
          Vizionforge to add it — once a new licence is uploaded, it’s available immediately, no
          reinstall.
        </p>
        <div className="flex gap-2 mt-5">
          <Button asChild variant="outline">
            <Link href="/dashboard">← Back to dashboard</Link>
          </Button>
          {view.isAdmin && (
            <Button asChild>
              <Link href="/licence">Manage licence</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
