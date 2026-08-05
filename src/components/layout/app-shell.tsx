"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";
import { LicenceProvider, useLicence } from "@/components/licensing/licence-provider";
import { LicenceLockedScreen } from "@/components/licensing/licence-locked-screen";
import { LicenceBanner } from "@/components/licensing/licence-banner";
import { ModuleRouteGuard } from "@/components/licensing/module-route-guard";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LicenceProvider>
      <AppShellInner>{children}</AppShellInner>
    </LicenceProvider>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { isLocked } = useLicence();

  // EXPIRED_LOCKED / INVALID / MISSING → the whole app routes to the restricted
  // licence screen (view status / export data / upload renewal) only.
  if (isLocked) {
    return <LicenceLockedScreen />;
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="min-w-0 max-w-full overflow-hidden">
        <Header />
        <LicenceBanner />
        <div className="min-w-0 flex-1 p-4 lg:p-8">
          <ModuleRouteGuard>{children}</ModuleRouteGuard>
        </div>
        <footer className="border-t bg-white py-4 px-8 text-xs text-slate-500 text-center">
          SafeOps360 · Powered by{" "}
          <span className="font-semibold text-primary-800">Vizionforge Technologies</span>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
