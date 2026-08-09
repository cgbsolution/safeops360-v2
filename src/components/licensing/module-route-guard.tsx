"use client";

// Route guard (build prompt §5.2): blocks direct navigation to a module the
// user can't reach and explains why. One guard for the whole content area —
// maps the current pathname to a module and checks entitlement. Core/unmatched
// routes always pass.
//
// Two distinct reasons a module is unreachable, with two different next steps:
//   * the Super Admin turned it off for the organisation → ask your Super Admin
//   * the licence never included it                      → contact Vizionforge
// Collapsing them into one message would send users to the wrong person.
//
// This is UX hardening; the Python API independently 403s the same module, so
// even if this guard were bypassed the data stays protected.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { moduleForPath } from "@/lib/licensing/route-map";
import { useLicence } from "./licence-provider";

export function ModuleRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hasModule, isOrgDisabled, loading, view } = useLicence();

  const moduleCode = moduleForPath(pathname);
  // Pass while loading / on fetch error (fail open — API still enforces), for
  // core routes, and for entitled modules.
  if (!moduleCode || loading || !view || hasModule(moduleCode)) {
    return <>{children}</>;
  }

  // The organisation owns this module but has switched it off. The licence is
  // fine — nothing to renew, nothing to buy — so point at the Super Admin.
  if (isOrgDisabled(moduleCode)) {
    return (
      <div>
        <PageHeader
          title="Module not enabled"
          description="This module is turned off for your organisation"
        />
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 max-w-2xl">
          <div className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
            <ShieldOff size={18} className="text-amber-600" />
            Please contact your Super Admin to request access to this module.
          </div>
          <p className="text-sm text-slate-600">
            {view.customerName ?? "Your organisation"} has this module available, but it is
            currently disabled for everyone. Your Super Admin can turn it back on from
            Organisation → Modules — it becomes available immediately, with no reinstall and no
            licence change.
          </p>
          <div className="flex gap-2 mt-5">
            <Button asChild variant="outline">
              <Link href="/dashboard">← Back to dashboard</Link>
            </Button>
            {view.isSuperAdmin && (
              <Button asChild>
                <Link href="/organisation/modules">Manage organisation modules</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
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
