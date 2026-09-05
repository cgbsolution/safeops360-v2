"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Activity,
  Banknote,
  Boxes,
  Building2,
  CalendarDays,
  FlaskConical,
  Flame,
  History,
  Radar,
  Telescope,
  Clock,
  Eye,
  EyeOff,
  FileBarChart,
  FileCheck,
  FileText,
  Gauge,
  GitBranch,
  Globe2,
  Scale,
  ShieldCheck,
  GraduationCap,
  Grid3x3,
  Hammer,
  HardHat,
  Inbox,
  Layers,
  LayoutDashboard,
  Network,
  Shield,
  ShieldAlert,
  Siren,
  SlidersHorizontal,
  Stethoscope,
  Handshake,
  Umbrella,
  Wind,
  Workflow,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/components/auth/can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  href: string;
  label: string;
  icon: any;
  showBadge?: boolean;
  phase2?: boolean;
  permission?: string;
};

type NavSection = {
  key: string;
  label: string | null;
  items: NavItem[];
  permissionPrefix?: string;
};

// Sidebar structure. Order matters — keep matching the brief's grouping.
const SECTIONS: NavSection[] = [
  {
    key: "top",
    label: null,
    items: [
      { href: "/inbox", label: "Inbox", icon: Inbox, showBadge: true },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/audit-trail", label: "Audit Trail", icon: History, permission: "AUDIT_COMPLIANCE.READ" },
    ],
  },
  {
    key: "erm",
    label: "Enterprise Risk (ERM)",
    permissionPrefix: "ERM",
    items: [
      { href: "/erm", label: "ERM Dashboard", icon: Gauge, permission: "ERM.READ" },
      { href: "/erm/register", label: "Risk Register", icon: ShieldAlert, permission: "ERM.READ" },
      { href: "/erm/heatmap", label: "Heat Map Explorer", icon: Grid3x3, permission: "ERM.READ" },
      { href: "/erm/exposure", label: "Exposure & VaR", icon: Banknote, permission: "ERM.READ" },
      { href: "/erm/network", label: "Interconnection Map", icon: Network, permission: "ERM.READ" },
      { href: "/erm/treatments", label: "Treatment Tracker", icon: Layers, permission: "ERM.READ" },
      { href: "/erm/kris", label: "KRI Monitoring", icon: Activity, permission: "KRI.READ" },
      { href: "/erm/appetite", label: "Risk Appetite", icon: Scale, permission: "APPETITE.READ" },
      { href: "/erm/compliance", label: "Compliance Register", icon: ShieldCheck, permission: "COMPLIANCE.READ" },
      { href: "/erm/loss", label: "Loss Events", icon: Banknote, permission: "LOSS.READ" },
      { href: "/erm/reviews", label: "Review Calendar", icon: CalendarDays, permission: "ERM.READ" },
      { href: "/erm/board-packs", label: "Board Packs", icon: FileText, permission: "ERM.READ" },
      { href: "/erm/reports", label: "Reports", icon: FileBarChart, permission: "ERM.EXPORT" },
      { href: "/erm/admin/taxonomy", label: "Taxonomy Admin", icon: Workflow, permission: "ERM.TAXONOMY_ADMIN" },
      { href: "/erm/admin/matrix", label: "Scoring Matrix", icon: SlidersHorizontal, permission: "ERM.MATRIX_ADMIN" },
      { href: "/erm/admin/rollup", label: "Rollup Rules", icon: GitBranch, permission: "ERM.ROLLUP_ADMIN" },
    ],
  },
  {
    key: "bcm",
    label: "Business Continuity (BCM)",
    permissionPrefix: "BCM",
    items: [
      { href: "/erm/bcm", label: "BCM Dashboard", icon: Building2, permission: "BCM.READ" },
      { href: "/erm/bcm/processes", label: "Critical Processes", icon: Boxes, permission: "BCM.READ" },
      { href: "/erm/bcm/dependency-map", label: "Dependency Map", icon: Network, permission: "BCM.READ" },
      { href: "/erm/bcm/plans", label: "Continuity Plans", icon: FileText, permission: "BCM.READ" },
      { href: "/erm/bcm/crisis", label: "Crisis Management", icon: Siren, permission: "BCM.READ" },
      { href: "/erm/bcm/exercises", label: "Exercises & Drills", icon: FlaskConical, permission: "BCM.READ" },
      { href: "/erm/bcm/scenarios", label: "Scenario Analysis", icon: Radar, permission: "BCM.READ" },
      { href: "/erm/bcm/horizon", label: "Horizon Watchlist", icon: Telescope, permission: "BCM.READ" },
    ],
  },
  {
    key: "controls",
    label: "Internal Controls",
    permissionPrefix: "CONTROL",
    items: [
      { href: "/erm/controls", label: "Controls Dashboard", icon: ShieldCheck, permission: "CONTROL.READ" },
      { href: "/erm/controls/library", label: "Control Library", icon: ClipboardCheck, permission: "CONTROL.READ" },
      { href: "/erm/controls/matrix", label: "Risk-Control Matrix", icon: Grid3x3, permission: "CONTROL.READ" },
      { href: "/erm/controls/deficiencies", label: "Deficiency Tracker", icon: AlertTriangle, permission: "CONTROL.READ" },
    ],
  },
  {
    key: "vendors",
    label: "Vendor Risk",
    permissionPrefix: "VENDOR",
    items: [
      { href: "/erm/vendors", label: "Vendor Dashboard", icon: Gauge, permission: "VENDOR.READ" },
      { href: "/erm/vendors/register", label: "Vendor Register", icon: Handshake, permission: "VENDOR.READ" },
      { href: "/erm/vendors/esg", label: "ESG Portfolio", icon: Globe2, permission: "VENDOR.READ" },
    ],
  },
  {
    key: "insurance",
    label: "Insurance & Transfer",
    permissionPrefix: "INSURANCE",
    items: [
      { href: "/erm/insurance", label: "Insurance Dashboard", icon: Umbrella, permission: "INSURANCE.READ" },
      { href: "/erm/insurance/policies", label: "Policy Register", icon: FileText, permission: "INSURANCE.READ" },
      { href: "/erm/insurance/coverage-gap", label: "Coverage Gap", icon: Scale, permission: "INSURANCE.READ" },
    ],
  },
  {
    key: "operational",
    label: "Operational Safety",
    items: [
      { href: "/observations", label: "Safety Observation", icon: Eye, permission: "OBSERVATION.READ" },
      { href: "/near-miss", label: "Near Miss", icon: AlertTriangle, permission: "NEAR_MISS.READ" },
      { href: "/ptw", label: "Permit to Work", icon: FileCheck, permission: "PTW.READ" },
      { href: "/flra", label: "FLRA", icon: Hammer, permission: "FLRA.READ" },
      { href: "/incidents", label: "Incident Investigation", icon: ShieldAlert, permission: "INCIDENT.READ" },
      { href: "/fire-safety", label: "Fire Safety & ER", icon: Flame, permission: "INCIDENT.READ" },
    ],
  },
  {
    key: "people",
    label: "People & Competency",
    items: [
      { href: "/training", label: "Training", icon: GraduationCap, permission: "TRAINING.READ" },
      { href: "/occupational-health", label: "Occupational Health", icon: Stethoscope, phase2: true },
      { href: "/bbs", label: "Behaviour-Based Safety", icon: EyeOff, phase2: true },
    ],
  },
  {
    key: "assets",
    label: "Assets & Inspection",
    items: [
      { href: "/inspections", label: "Inspection Schedule", icon: ClipboardCheck, permission: "INSPECTION.READ" },
      { href: "/process-safety", label: "Process Safety Management", icon: Shield, phase2: true },
    ],
  },
  {
    key: "environment",
    label: "Environment & Sustainability",
    items: [
      { href: "/environmental", label: "Environmental Compliance", icon: Globe2, phase2: true },
      { href: "/industrial-hygiene", label: "Industrial Hygiene", icon: Wind, phase2: true },
    ],
  },
  {
    key: "contractor",
    label: "Contractor & Emergency",
    items: [
      { href: "/contractors", label: "Contractor Management", icon: HardHat, phase2: true },
      { href: "/emergency-response", label: "Emergency Response", icon: Siren, phase2: true },
    ],
  },
  {
    key: "performance",
    label: "Performance",
    items: [
      { href: "/manhours", label: "Manhours & KPIs", icon: Clock, permission: "MANHOURS.READ" },
      { href: "/manhours/mis-dashboard", label: "MIS Dashboard", icon: BarChart3 },
      { href: "/anomalies", label: "Anomalies", icon: AlertTriangle },
    ],
  },
  {
    key: "configuration",
    label: "Configuration",
    permissionPrefix: "CONFIGURATION",
    items: [
      { href: "/configuration/workflows", label: "Workflows", icon: Workflow, permission: "CONFIGURATION.WORKFLOWS" },
    ],
  },
];

const SECTION_COLLAPSE_KEY = "safeops_sidebar_collapsed";

function loadSectionCollapse(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SECTION_COLLAPSE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveSectionCollapse(state: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SECTION_COLLAPSE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function Sidebar({
  mobileOpen,
  onMobileClose,
  desktopCollapsed,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
  desktopCollapsed: boolean;
}) {
  const pathname = usePathname();
  useSession();
  const permissions = usePermissions();
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [sectionCollapse, setSectionCollapse] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSectionCollapse(loadSectionCollapse());
  }, []);

  function toggleSection(key: string) {
    setSectionCollapse((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSectionCollapse(next);
      return next;
    });
  }

  // Poll inbox count every 60s; pause when tab hidden.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const r = await fetch("/api/workflow/my-count");
        if (!r.ok) return;
        const j = await r.json();
        // See app-sidebar.tsx — `count` omits the Notifications tab.
        if (!cancelled) setInboxCount((j.count ?? 0) + (j.unreadNotifications ?? 0));
      } catch {}
    }

    function start() {
      if (timer) return;
      load();
      timer = setInterval(load, 60_000);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    start();
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // When desktop is collapsed we ignore the per-section collapse map and
  // force every section to be open in icon-only mode (otherwise the user
  // hits sections that look broken because labels are hidden anyway).
  // Mobile drawer always shows full labels regardless of desktopCollapsed.
  const collapsedDesktop = desktopCollapsed;

  return (
    <>
      {/* Mobile backdrop — only shows when drawer is open on mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={cn(
          // Base
          "fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col",
          "bg-gradient-to-b from-primary-900 via-primary-900 to-primary-950",
          "border-r border-primary-800/50",
          // Smooth width transition for desktop collapse
          "transition-[width,transform] duration-200 ease-out",
          // Width: collapsed on desktop = 72px, expanded = 256px
          // Mobile drawer always uses 256px (it's a temporary slide-over)
          collapsedDesktop ? "lg:w-[72px]" : "lg:w-64",
          "w-64",
          // Mobile slide-in/out
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* ─── Brand row ─── */}
        <div
          className={cn(
            "flex items-center justify-between border-b border-primary-800/50 h-16",
            collapsedDesktop ? "lg:px-3 px-5" : "px-5",
          )}
        >
          <Link
            href="/inbox"
            className="flex items-center gap-3 min-w-0"
            title={collapsedDesktop ? "SafeOps360" : undefined}
          >
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center font-bold text-primary-800 text-sm shrink-0">
              S360
            </div>
            <div
              className={cn(
                "overflow-hidden transition-opacity",
                collapsedDesktop ? "lg:opacity-0 lg:w-0" : "opacity-100",
              )}
            >
              <div className="text-white font-bold text-base leading-none whitespace-nowrap">
                SafeOps360
              </div>
            </div>
          </Link>
          <Button variant="ghost"
            onClick={onMobileClose} className="lg:hidden"
            aria-label="Close menu">
            <X size={20} />
          </Button>
        </div>

        {/* ─── Nav body ─── */}
        <nav
          className={cn(
            "flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden",
            collapsedDesktop ? "lg:px-2 px-3" : "px-3",
          )}
        >
          {SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) => {
              if (!item.permission) return true;
              return !!permissions[item.permission];
            });
            if (visibleItems.length === 0) return null;
            if (section.permissionPrefix) {
              const anyMatching = Object.keys(permissions).some(
                (k) => k.startsWith(`${section.permissionPrefix}.`) && permissions[k],
              );
              if (!anyMatching) return null;
            }

            const isSectionCollapsed = !!sectionCollapse[section.key];

            return (
              <div key={section.key} className={section.label ? "mt-3 first:mt-0" : ""}>
                {section.label && (
                  <Button variant="ghost"
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    className={cn(
                      "w-full flex items-center gap-1 pt-2 pb-1 px-3",
                      "text-[10px] uppercase tracking-wider font-semibold text-primary-300/70 hover:text-primary-200",
                      "transition-colors",
                      // Hide section labels on collapsed desktop — show only a thin divider
                      collapsedDesktop && "lg:hidden",
                    )}
                    title={collapsedDesktop ? section.label : undefined}>
                    {isSectionCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                    <span>{section.label}</span>
                  </Button>
                )}
                {/* Collapsed-desktop divider in place of the label */}
                {section.label && collapsedDesktop && (
                  <div className="hidden lg:block h-px bg-primary-800/40 mx-2 my-2" />
                )}

                {(!isSectionCollapsed || collapsedDesktop) &&
                  visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active =
                      pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={`${section.key}-${item.href}-${item.label}`}
                        href={item.href}
                        onClick={onMobileClose}
                        title={collapsedDesktop ? item.label : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
                          "px-3 py-2",
                          collapsedDesktop && "lg:justify-center lg:px-2",
                          active
                            ? "bg-white/15 text-white"
                            : "text-primary-100/80 hover:text-white hover:bg-white/10",
                        )}
                      >
                        {/* Active indicator bar (left edge) — only in expanded mode */}
                        {active && !collapsedDesktop && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-r" />
                        )}
                        <Icon size={18} className="shrink-0" />
                        <span
                          className={cn(
                            "flex-1 truncate transition-opacity",
                            collapsedDesktop ? "lg:hidden" : "block",
                          )}
                        >
                          {item.label}
                        </span>

                        {/* Phase 2 chip */}
                        {item.phase2 && !collapsedDesktop && (
                          <Badge variant="warning" className="bg-amber-400/20 text-amber-200 text-[9px] font-semibold uppercase tracking-wider rounded-full px-1.5 py-0.5">
                            Phase 2
                          </Badge>
                        )}

                        {/* Inbox badge — full count expanded, dot collapsed */}
                        {item.showBadge && inboxCount !== null && inboxCount > 0 && (
                          <>
                            <span
                              className={cn(
                                "bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] items-center justify-center",
                                collapsedDesktop ? "lg:hidden flex" : "flex",
                              )}
                            >
                              {inboxCount > 99 ? "99+" : inboxCount}
                            </span>
                            {/* Tiny dot when collapsed */}
                            <span
                              className={cn(
                                "absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-primary-900",
                                collapsedDesktop ? "hidden lg:block" : "hidden",
                              )}
                            />
                          </>
                        )}
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </nav>

        {/* ─── Footer ─── */}
        <div
          className={cn(
            "border-t border-primary-800/50 text-[11px] text-primary-300",
            collapsedDesktop ? "lg:hidden px-5 py-4" : "px-5 py-4",
          )}
        >
          <div className="font-medium text-primary-200">EHS Management System</div>
          <div className="mt-1">v1.0 — Powered by</div>
          <div className="font-semibold text-white">Vizionforge Technologies</div>
        </div>
      </aside>
    </>
  );
}
