import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Workflow, ListChecks, Users, Shield, ChevronRight, Flag,
  Sparkles, Grid3X3, AlertTriangle, ShieldCheck, CalendarClock, Gauge, Building2
} from "lucide-react";
import { requirePermission } from "@/lib/auth/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPermissions } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function ConfigurationLandingPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const userId = (session.user as any).id;
  const perms = await getPermissions(userId);

  // Don't hard-block — admin is a multi-tile landing; show only the tiles
  // the caller has permission for, and 403 in deeper pages.
  const tiles: { title: string; href: string; icon: any; description: string; permission: string; badge?: string | number }[] = [
    // Super Admin only — listed first because it sits above everything else
    // here: a module switched off org-wide is gone from every plant at once.
    { title: "Organisation Modules", href: "/organisation/modules", icon: Building2, permission: "ORGANISATION.MODULES",
      description: "Super Admin — enable or disable modules for the whole organisation. Applies to every plant and every user immediately." },
    { title: "Form Dropdowns", href: "/configuration/dropdowns", icon: ListChecks, permission: "CONFIGURATION.MASTERS",
      description: "Add, edit, or remove values used in module form dropdowns (shifts, hazard categories, root causes, observation categories, etc.)." },
    { title: "Users", href: "/configuration/users", icon: Users, permission: "CONFIGURATION.USERS",
      description: "View all users, change roles, deactivate accounts, and create new users." },
    { title: "Roles & Permissions", href: "/configuration/roles", icon: Shield, permission: "CONFIGURATION.ROLES",
      description: "Edit role × permission × scope matrix. Changes apply on next request — no redeploy needed." },
    { title: "Workflows", href: "/configuration/workflows", icon: Workflow, permission: "CONFIGURATION.WORKFLOWS",
      description: "Customize approval / verification / closure steps per module." },
    { title: "Feature Flags", href: "/configuration/feature-flags", icon: Flag, permission: "CONFIGURATION.MASTERS",
      description: "Enable HIRA Phase 2/3 modules per plant — EAI Environmental Register, Combined Risk Register, Risk Aggregation Dashboard, and HIRA Assistant v2." },
    { title: "Observation SLA Matrix", href: "/configuration/observation-sla", icon: CalendarClock, permission: "CONFIGURATION.MASTERS",
      description: "Target closure days by severity × behavioural/physical, plus the deroster review SLA and escalation contact. Applies to new observations only." },
    { title: "Severity Matrix Calibration", href: "/configuration/severity-calibration", icon: Gauge, permission: "OBSERVATION.READ",
      description: "Where observers disagree with the suggested observation severity. A sub-category overridden consistently in one direction means the matrix rule is wrong, not the observers." },
    { title: "AI Agents", href: "/configuration/agents", icon: Sparkles, permission: "AGENT.RCA_INVOKE",
      description: "Operations dashboard for user-initiated AI agents. View metrics, change authority levels, manage prompts, trigger calibration." },
    // HIRA admin — Phase 1 of IMS expansion. Each tile is a master that
    // HIRA studies and entries depend on.
    { title: "Risk Matrices", href: "/configuration/risk-matrices", icon: Grid3X3, permission: "HIRA.MATRIX_CONFIGURE",
      description: "Configure risk assessment matrices (5×5, 3×3 etc.). Sets likelihood / severity scales, cell colors, and acceptable residual risk thresholds." },
    { title: "Hazard Library", href: "/configuration/hazards", icon: AlertTriangle, permission: "HIRA.LIBRARY_MANAGE",
      description: "Manage the structured hazard library used by HIRA studies. Add tenant-specific hazards on top of the pre-seeded global set." },
    { title: "Control Library", href: "/configuration/controls", icon: ShieldCheck, permission: "HIRA.LIBRARY_MANAGE",
      description: "Manage reusable control descriptions across the hazard hierarchy (elimination, substitution, engineering, administrative, PPE)." }
  ];

  // Side stats
  const [userCount, roleCount, masterTypeCount, perPlantDepts] = await Promise.all([
    prisma.user.count(),
    prisma.role.count({ where: { isActive: true } }),
    prisma.masterItem.findMany({ select: { type: true }, distinct: ["type"] }).then((r) => r.length),
    prisma.department.count({ where: { active: true } })
  ]);

  return (
    <div>
      <PageHeader
        title="Configuration"
        description="Admin panel — manage users, roles, dropdown values, plants, and workflows. Changes are applied immediately."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => {
          const allowed = !!perms[t.permission];
          if (!allowed) return null;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="group block border border-slate-200 rounded-lg p-5 bg-white hover:border-primary-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-md bg-primary-50 text-primary-700 flex items-center justify-center group-hover:bg-primary-100">
                  <Icon size={20} />
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-primary-700" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900">{t.title}</h3>
              <p className="text-sm text-slate-500 mt-1">{t.description}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <Stat label="Users" value={userCount} />
        <Stat label="Active roles" value={roleCount} />
        <Stat label="Dropdown types" value={masterTypeCount} />
        <Stat label="Departments" value={perPlantDepts} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-slate-200 rounded-md p-3 bg-white">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1 text-slate-900">{value}</div>
    </div>
  );
}
