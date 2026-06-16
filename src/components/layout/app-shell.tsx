"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="min-w-0 max-w-full overflow-hidden">
        <Header />
        <div className="min-w-0 flex-1 p-4 lg:p-8">{children}</div>
        <footer className="border-t bg-white py-4 px-8 text-xs text-slate-500 text-center">
          SafeOps360 · Powered by{" "}
          <span className="font-semibold text-primary-800">Vizionforge Technologies</span>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
