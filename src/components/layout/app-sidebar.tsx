"use client";

// SafeOps app sidebar built on shadcn/ui Sidebar primitives.
// Owns the nav structure + permission filtering + inbox-count polling;
// delegates layout, collapse, mobile drawer, tooltips to shadcn.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Activity,
  AlertTriangle,
  Banknote,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  ChevronRight,
  ChevronsUpDown,
  ClipboardCheck,
  Clock,
  Eye,
  FileBarChart,
  FileCheck,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  Globe2,
  GraduationCap,
  Grid3x3,
  Hammer,
  Handshake,
  HardHat,
  Inbox,
  Layers,
  Leaf,
  LayoutDashboard,
  LogOut,
  Network,
  Radar,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Sparkles,
  Telescope,
  Trophy,
  Umbrella,
  Users,
  Workflow,
} from "lucide-react";
import { usePermissions } from "@/components/auth/can";
import { shortPlantName } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type NavItem = {
  href: string;
  label: string;
  icon: any;
  showBadge?: boolean;
  permission?: string;
  /** When true, only highlight this item on an exact pathname match (no sub-path prefix match). */
  exact?: boolean;
};

type NavSection = {
  key: string;
  label: string | null;
  items: NavItem[];
  permissionPrefix?: string;
};

const SECTIONS: NavSection[] = [
  {
    key: "top",
    label: null,
    items: [
      { href: "/inbox", label: "Inbox", icon: Inbox, showBadge: true },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
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
    ],
  },
  {
    key: "risk_management",
    label: "Risk Management",
    items: [
      { href: "/hira", label: "HIRA — Risk Register", icon: ShieldAlert, permission: "HIRA.READ" },
      { href: "/hira/reviews", label: "Review Cycles", icon: ClipboardCheck, permission: "HIRA.READ" },
      { href: "/eai", label: "EAI — Environmental Register", icon: ShieldAlert, permission: "EAI.READ", exact: true },
      { href: "/eai/reviews", label: "EAI Reviews", icon: Leaf, permission: "EAI.READ" },
      { href: "/risk-register", label: "Combined Risk Register", icon: ShieldAlert, permission: "RISK.COMBINED_VIEW" },
      { href: "/risk-dashboard", label: "Risk Aggregation Dashboard", icon: ClipboardCheck, permission: "RISK.DASHBOARD_VIEW" },
      { href: "/capa", label: "CAPA — Universal", icon: ClipboardCheck, permission: "CAPA.READ" },
      { href: "/moc", label: "MOC — Management of Change", icon: GitBranch },
      { href: "/compliance", label: "Statutory Registers", icon: ClipboardCheck }
    ],
  },
  {
    key: "erm",
    label: "Enterprise Risk (ERM)",
    permissionPrefix: "ERM",
    items: [
      { href: "/erm", label: "ERM Dashboard", icon: Gauge, permission: "ERM.READ", exact: true },
      { href: "/erm/register", label: "Risk Register", icon: ShieldAlert, permission: "ERM.READ" },
      { href: "/erm/heatmap", label: "Heat Map Explorer", icon: Grid3x3, permission: "ERM.READ" },
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
      { href: "/erm/bcm", label: "BCM Dashboard", icon: Building2, permission: "BCM.READ", exact: true },
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
      { href: "/erm/controls", label: "Controls Dashboard", icon: ShieldCheck, permission: "CONTROL.READ", exact: true },
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
      { href: "/erm/vendors", label: "Vendor Dashboard", icon: Gauge, permission: "VENDOR.READ", exact: true },
      { href: "/erm/vendors/register", label: "Vendor Register", icon: Handshake, permission: "VENDOR.READ" },
      { href: "/erm/vendors/esg", label: "ESG Portfolio", icon: Globe2, permission: "VENDOR.READ" },
    ],
  },
  {
    key: "insurance",
    label: "Insurance & Transfer",
    permissionPrefix: "INSURANCE",
    items: [
      { href: "/erm/insurance", label: "Insurance Dashboard", icon: Umbrella, permission: "INSURANCE.READ", exact: true },
      { href: "/erm/insurance/policies", label: "Policy Register", icon: FileText, permission: "INSURANCE.READ" },
      { href: "/erm/insurance/coverage-gap", label: "Coverage Gap", icon: Scale, permission: "INSURANCE.READ" },
    ],
  },
  {
    // CAMS — Compliance & Audit Management System. The audit-execution flow now
    // runs through the Audit & Compliance module (auditor -> Plant Head ->
    // auditee -> auditor -> Plant Head acceptance); CAMS keeps the dashboards
    // (Command Centre / CAPA / Compliance Tracker / Analytics) which reflect
    // those audits via the mirror in audit_compliance_cams_bridge.
    key: "cams",
    label: "CAMS — Audit & Compliance",
    items: [
      { href: "/cams", label: "Command Centre", icon: LayoutDashboard, permission: "CAMS.READ", exact: true },
      { href: "/audit-compliance", label: "Audit & Compliance", icon: ClipboardCheck, permission: "AUDIT_COMPLIANCE.READ" },
      { href: "/cams/capa", label: "CAPA (Audit Source)", icon: Layers, permission: "CAMS.READ" },
      { href: "/cams/compliance", label: "Compliance Tracker", icon: ShieldCheck, permission: "CAMS.READ" },
      { href: "/cams/analytics", label: "Analytics & Benchmarking", icon: BarChart3, permission: "CAMS.ANALYTICS" },
      { href: "/cams/board-pack", label: "Board Pack", icon: FileText, permission: "CAMS.ANALYTICS" },
      { href: "/cams/admin/types", label: "Audit Types", icon: Shield, permission: "CAMS.TYPE_CONFIG" },
    ],
  },
  {
    // AI Assistance — visible to every logged-in user (no permission gate).
    // Invocation on a specific incident is still gated by AGENT.RCA_INVOKE
    // at the backend, but discovering that the feature exists is free.
    key: "ai",
    label: "AI Assistance",
    items: [
      { href: "/configuration/agents", label: "AI Agents", icon: Sparkles },
    ],
  },
  {
    key: "people",
    label: "People & Competency",
    items: [
      { href: "/training", label: "Training", icon: GraduationCap, permission: "TRAINING.READ" },
      { href: "/skill-matrix", label: "Skill Matrix", icon: Grid3x3 },
      { href: "/sci", label: "Safety Culture Index", icon: Trophy },
      { href: "/sci/kaizen", label: "Safety Kaizen Wall", icon: Hammer }
    ],
  },
  {
    key: "assets",
    label: "Assets & Inspection",
    items: [
      { href: "/ppe", label: "PPE Management", icon: HardHat },
      { href: "/inspections", label: "Inspection Schedule", icon: CalendarDays, permission: "INSPECTION.READ", exact: true },
      { href: "/inspections/inbox", label: "My Inspections", icon: ClipboardCheck, permission: "INSPECTION.READ" },
      { href: "/inspections/findings", label: "Findings", icon: AlertTriangle, permission: "INSPECTION_FINDING.READ" },
      { href: "/inspections/equipment", label: "Equipment Master", icon: Hammer, permission: "EQUIPMENT_MASTER.READ" },
      { href: "/inspections/types", label: "Inspection Types", icon: Shield, permission: "INSPECTION_TYPE.READ" },
      { href: "/inspections/checklists", label: "Checklist Templates", icon: FileCheck, permission: "CHECKLIST_TEMPLATE.READ" },
      { href: "/inspections/analytics", label: "Inspection Analytics", icon: BarChart3, permission: "INSPECTION.READ" },
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
      { href: "/configuration", label: "Admin Panel", icon: Shield },
      { href: "/configuration/dropdowns", label: "Form Dropdowns", icon: FileCheck, permission: "CONFIGURATION.MASTERS" },
      { href: "/configuration/users", label: "Users", icon: Users, permission: "CONFIGURATION.USERS" },
      { href: "/configuration/roles", label: "Roles & Permissions", icon: ShieldAlert, permission: "CONFIGURATION.ROLES" },
      { href: "/configuration/workflows", label: "Workflows", icon: Workflow, permission: "CONFIGURATION.WORKFLOWS" },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;
  const permissions = usePermissions();
  const [inboxCount, setInboxCount] = React.useState<number | null>(null);

  // Inbox poll — every 60s, paused when tab hidden
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const r = await fetch("/api/workflow/my-count");
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setInboxCount(j.count ?? 0);
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

  const { isMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      {/* ─── Brand header (with plant-info dropdown) ─── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  tooltip="SafeOps360"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-xs shrink-0">
                    S360
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-bold">SafeOps360</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      {shortPlantName(user?.plantName) ?? "All Plants"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 opacity-70" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                align="start"
                side={isMobile ? "bottom" : "right"}
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Plant
                </DropdownMenuLabel>
                <DropdownMenuItem className="gap-2 p-2" disabled>
                  <Building2 className="size-4 shrink-0 text-primary-700" />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="font-medium">{shortPlantName(user?.plantName) ?? "All Plants"}</span>
                    <span className="text-xs text-muted-foreground">Active scope</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-4" /> Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/inbox">
                    <Inbox className="size-4" /> Inbox
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ─── Nav body ─── */}
      <SidebarContent>
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

          // Render the items list (used in both labelled + unlabelled variants)
          const itemsBlock = (
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={`${section.key}-${item.href}-${item.label}`}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.showBadge && inboxCount !== null && inboxCount > 0 && (
                      <SidebarMenuBadge className="bg-rose-500 text-white">
                        {inboxCount > 99 ? "99+" : inboxCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          );

          // Sections without a label (Inbox / Dashboard) are non-collapsible
          if (!section.label) {
            return (
              <SidebarGroup key={section.key}>
                <SidebarGroupContent>{itemsBlock}</SidebarGroupContent>
              </SidebarGroup>
            );
          }

          // Labelled sections: collapsible with rotating chevron.
          // defaultOpen=true so the user sees everything on first paint;
          // they can collapse from there. Radix handles the animation.
          return (
            <Collapsible
              key={section.key}
              defaultOpen
              className="group/collapsible"
            >
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
                    <span className="flex-1 text-left">{section.label}</span>
                    <ChevronRight className="size-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                  <SidebarGroupContent>{itemsBlock}</SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      {/* ─── User footer (with profile dropdown) ─── */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  tooltip={user?.name ?? "Profile"}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-xs">
                    {user?.name
                      ? user.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .slice(0, 2)
                          .join("")
                      : "—"}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.name ?? "Loading..."}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      {user?.role?.replace(/_/g, " ") ?? ""}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 opacity-70" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white font-semibold text-xs">
                      {user?.name
                        ? user.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .slice(0, 2)
                            .join("")
                        : "—"}
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.name ?? "—"}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email ?? ""}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Role · {user?.role?.replace(/_/g, " ") ?? ""}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/training/my-certifications">
                      <Sparkles className="size-4" /> My Certifications
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/inbox">
                      <Bell className="size-4" /> Inbox
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-rose-600 focus:text-rose-700 focus:bg-rose-50"
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
