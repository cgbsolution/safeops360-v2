import Link from "next/link";
import { Shield, Wind, EyeOff, Stethoscope, Siren, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const MODULES = [
  { href: "/process-safety", name: "Process Safety", icon: Shield, accent: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { href: "/industrial-hygiene", name: "Industrial Hygiene", icon: Wind, accent: "bg-amber-50 text-amber-700 border-amber-200" },
  { href: "/bbs", name: "Behaviour-Based Safety", icon: EyeOff, accent: "bg-violet-50 text-violet-700 border-violet-200" },
  { href: "/occupational-health", name: "Occupational Health", icon: Stethoscope, accent: "bg-rose-50 text-rose-700 border-rose-200" },
  { href: "/emergency-response", name: "Emergency Response", icon: Siren, accent: "bg-blue-50 text-blue-700 border-blue-200" }
];

const AVAILABILITY = "Available Q3 2026";

export function Phase2ModulesPreview() {
  return (
    <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-3">
      <div className="flex items-center gap-3 mb-3">
        <Sparkles size={14} className="text-amber-500" />
        <h2 className="text-sm font-semibold text-slate-800">Phase 2 Modules — Coming Soon</h2>
        <span className="text-[11px] text-slate-500 hidden sm:inline">Preview the platform roadmap</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className="flex-shrink-0 w-56 rounded-lg border border-slate-200 bg-white p-3 hover:border-primary-300 hover:shadow-sm transition group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className={cn("w-9 h-9 rounded-md border flex items-center justify-center", m.accent)}>
                  <Icon size={16} />
                </div>
                <ArrowRight size={13} className="text-slate-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition" />
              </div>
              <div className="mt-2.5 text-sm font-semibold text-slate-900 leading-snug">{m.name}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{AVAILABILITY}</div>
              <div className="text-[11px] text-primary-700 mt-2 font-medium">Learn more →</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
