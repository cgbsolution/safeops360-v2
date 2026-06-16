import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Server-safe back-compat shim for the legacy KpiCard signature.
 *
 * Lives outside `kpi-card.tsx` (which has `"use client"`) so server
 * components can pass it Lucide icon functions as props — those
 * functions can't be serialised across the React Server Components
 * boundary, so the new client KpiCard cannot accept them directly.
 *
 * Delete in Commit 3 once /dashboard/page.tsx switches to the engine-
 * driven KpiCard API.
 */
export function KpiCardLegacy({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  tone = "default",
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { dir: "up" | "down"; text: string; positive?: boolean };
  tone?: "default" | "success" | "warning" | "danger";
  href?: string;
}) {
  const toneMap = {
    default: "bg-primary-50 text-primary-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
  };
  const inner = (
    <Card className="h-full elevation-1 hover:elevation-hover hover:border-primary-200 transition group">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-overline text-slate-500">{title}</div>
            <div className="text-display-2 font-numeric text-slate-900 mt-2">{value}</div>
            {subtitle && <div className="text-caption text-slate-500 mt-1">{subtitle}</div>}
          </div>
          <div className={cn("rounded-lg p-2.5", toneMap[tone])}>
            <Icon size={20} />
          </div>
        </div>
        {trend && (
          <div className={cn("mt-3 text-caption font-medium", trend.positive ? "text-emerald-700" : "text-rose-600")}>
            {trend.dir === "up" ? "↑" : "↓"} {trend.text}
          </div>
        )}
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}
