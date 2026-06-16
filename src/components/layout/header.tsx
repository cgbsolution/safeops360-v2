"use client";

import { useSession } from "next-auth/react";
import { Building2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { shortPlantName } from "@/lib/utils";

export function Header() {
  const { data: session } = useSession();
  const user = session?.user as any;

  return (
    <header className="sticky top-0 z-30 bg-white border-b h-16 flex items-center justify-between px-3 sm:px-4 lg:px-6 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {/* shadcn SidebarTrigger — handles desktop collapse + mobile drawer
            via the SidebarProvider context. Ctrl/Cmd+B also works. */}
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4 hidden sm:block" />
        <div className="hidden sm:block min-w-0">
          <div className="text-base font-semibold text-slate-900 truncate">
            Vizionforge Technologies
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Building2 size={12} />
            {shortPlantName(user?.plantName) ?? "All Plants"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-medium text-slate-900">{user?.name}</div>
          <div className="text-xs text-slate-500">
            {user?.designation} ·{" "}
            <span className="text-primary-700 font-medium">{user?.role?.replace(/_/g, " ")}</span>
          </div>
        </div>
        <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-800 font-semibold text-sm shrink-0">
          {user?.name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("") ?? "—"}
        </div>
      </div>
    </header>
  );
}
