"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Search, Shield, X } from "lucide-react";
import {
  DEMO_PLANTS,
  DEMO_DEPARTMENTS,
  DEMO_ROLES,
  DEMO_PASSWORD,
  buildDemoEmail
} from "../../../prisma/demo-users-config";

/**
 * Where to land after a successful sign-in.
 *
 * Notification emails link to `/go?to=<path>`, which sends a signed-out reader
 * here with `?callbackUrl=<path>`. Without honouring it, every emailed deep
 * link would dump the recipient on the Inbox and lose the record the email was
 * about — which is most of the point of sending the email.
 *
 * Read from `window.location` at submit time rather than via `useSearchParams`
 * so this page needs no Suspense boundary and cannot cause a hydration
 * mismatch. Same-origin absolute paths only: anything else (a full URL, a
 * protocol-relative `//host`) is an open redirect, so it falls back to /inbox.
 */
function resolveCallbackUrl(): string {
  if (typeof window === "undefined") return "/inbox";
  const raw = new URLSearchParams(window.location.search).get("callbackUrl");
  if (!raw) return "/inbox";
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return "/inbox";
  }
  // NextAuth writes an absolute callbackUrl of its own; accept it when it is
  // this origin and reduce it to a path, reject it otherwise.
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      if (u.origin !== window.location.origin) return "/inbox";
      path = `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return "/inbox";
    }
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/inbox";
  // Bouncing back to /login would loop.
  if (path === "/login" || path.startsWith("/login?")) return "/inbox";
  return path;
}

const ANCHOR_ADMIN = {
  label: "Global Admin",
  email: "admin@safeops360.in",
  password: DEMO_PASSWORD,
  hint: "Anchor admin (no plant/dept slot)"
};

// Single, plant-wide "base" accounts — one named account per role (not the
// role×dept×plant cartesian). These span the whole org and unlock the ERM
// suite (register, BCM, controls, vendor, insurance) end-to-end.
const PERSONA_GROUPS = ["Enterprise Risk Leadership", "Tier 3 Specialists", "Risk Owners & Operations"] as const;
const KEY_PERSONAS: { email: string; name: string; designation: string; group: (typeof PERSONA_GROUPS)[number]; covers: string }[] = [
  { email: "anand.krishnan@safeops360.in", name: "Anand Krishnan", designation: "Chief Risk Officer", group: "Enterprise Risk Leadership", covers: "All ERM phases + Controls · Vendor · Insurance" },
  { email: "farhan.qureshi@safeops360.in", name: "Farhan Qureshi", designation: "BCM Coordinator", group: "Enterprise Risk Leadership", covers: "Business Continuity (BCM)" },
  { email: "nandini.subramaniam@safeops360.in", name: "Nandini Subramaniam", designation: "Compliance Officer", group: "Enterprise Risk Leadership", covers: "Compliance Obligations + Vendor ESG" },
  { email: "ravi.menon@safeops360.in", name: "Ravi Menon", designation: "Controls Tester · Internal Audit", group: "Tier 3 Specialists", covers: "Internal Controls Register" },
  { email: "sneha.kulkarni@safeops360.in", name: "Sneha Kulkarni", designation: "Vendor Risk Manager", group: "Tier 3 Specialists", covers: "Vendor / Third-Party + ESG" },
  { email: "aditya.bose@safeops360.in", name: "Aditya Bose", designation: "Insurance Manager", group: "Tier 3 Specialists", covers: "Insurance & Risk Transfer" },
  { email: "rajesh.nair@safeops360.in", name: "Rajesh Nair", designation: "CFO · Risk Owner", group: "Risk Owners & Operations", covers: "Owned financial risks" },
  { email: "kavita.rao@safeops360.in", name: "Kavita Rao", designation: "CIO · Risk Owner", group: "Risk Owners & Operations", covers: "Owned IT / cyber risks" },
  { email: "devendra.kulkarni@safeops360.in", name: "Devendra Kulkarni", designation: "Plant HSE Head — North Works", group: "Risk Owners & Operations", covers: "Own-site OPS risks + sev-1 crisis" },
  { email: "priya.nair@safeops360.in", name: "Priya Nair", designation: "HSE Manager (primary demo)", group: "Risk Owners & Operations", covers: "Shop-floor EHS modules" },
];

// One row of the "search any user" picker — mirrors the payload returned by
// /api/login/demo-search (backend `/api/auth/demo-search`, Prisma fallback).
type DirectoryHit = {
  email: string;
  name: string;
  role: string | null;
  designation: string | null;
  department: string | null;
  plantCode: string | null;
  plantName: string | null;
};

// Role codes are stored as WORKER / HSE_MANAGER / … — render the human label
// from the demo taxonomy when it's known, otherwise title-case the code so a
// role added outside DEMO_ROLES still reads as words, never as a raw enum.
function roleLabel(code: string | null): string {
  if (!code) return "—";
  const known = DEMO_ROLES.find((r) => r.roleCode === code || r.legacyRole === code);
  if (known) return known.label;
  return code
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Demo picker mode: "persona" shows the single plant-wide base accounts,
  // "matrix" shows the Meridian role×dept×plant full matrix.
  const [pickerMode, setPickerMode] = useState<"persona" | "matrix">("persona");

  // Filter UI: pick plant + dept + role to compose a demo email.
  const [plantSlug, setPlantSlug] = useState(DEMO_PLANTS[0].slug);
  const [deptSlug, setDeptSlug] = useState(DEMO_DEPARTMENTS[0].slug);
  const [roleSlug, setRoleSlug] = useState(DEMO_ROLES[0].emailSlug);

  // Free-text search over every seeded demo account (name or email), so a
  // demo can be driven from a person's name instead of the role×dept×plant
  // email pattern. Sits above the two pickers below.
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<DirectoryHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchActive = searchQuery.trim().length >= 2;

  function fillPersona(personaEmail: string) {
    setEmail(personaEmail);
    setPassword(DEMO_PASSWORD);
  }

  const composedEmail = useMemo(
    () => buildDemoEmail(roleSlug, deptSlug, plantSlug),
    [roleSlug, deptSlug, plantSlug]
  );

  const selectedRole = DEMO_ROLES.find((r) => r.emailSlug === roleSlug);
  const selectedPlant = DEMO_PLANTS.find((p) => p.slug === plantSlug);
  const selectedDept = DEMO_DEPARTMENTS.find((d) => d.slug === deptSlug);

  // Resolve the actual user name for the composed demo email. Quick lookup
  // via /api/login/demo-user — debounced via cancellation flag so flipping
  // dropdowns rapidly doesn't race.
  const [demoUserName, setDemoUserName] = useState<string | null>(null);
  const [demoUserLoading, setDemoUserLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setDemoUserLoading(true);
    setDemoUserName(null);
    (async () => {
      try {
        const r = await fetch(`/api/login/demo-user?email=${encodeURIComponent(composedEmail)}`);
        const j = await r.json().catch(() => ({}));
        if (!cancelled) setDemoUserName(r.ok && j.name ? j.name : null);
      } catch {
        if (!cancelled) setDemoUserName(null);
      } finally {
        if (!cancelled) setDemoUserLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [composedEmail]);

  // Debounced directory search (250ms) — cancellation flag so a slow response
  // for an earlier keystroke can't overwrite the results of a later one.
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) {
      setSearchHits([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/login/demo-search?q=${encodeURIComponent(term)}`);
        const j = await r.json().catch(() => ({}));
        if (!cancelled) setSearchHits(r.ok && Array.isArray(j.results) ? j.results : []);
      } catch {
        if (!cancelled) setSearchHits([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setLoading(false);
      // res.error carries the code thrown by authorize() in src/lib/auth.ts.
      if (res.error === "USER_NOT_FOUND") {
        toast({
          variant: "error",
          title: "User not found",
          description: "No account exists for that email address."
        });
      } else if (res.error === "BACKEND_UNREACHABLE") {
        toast({
          variant: "error",
          title: "Server unreachable",
          description: "Couldn't reach the authentication server. Please try again."
        });
      } else if (res.error === "BACKEND_TIMEOUT") {
        // Distinct from BACKEND_UNREACHABLE: the server WAS reachable but did
        // not answer within 30s. Without this branch it fell through to the
        // catch-all below and wrongly told the user their password was wrong.
        toast({
          variant: "error",
          title: "Server is slow to respond",
          description: "The authentication server didn't answer in time. Please try again."
        });
      } else {
        // INVALID_CREDENTIALS, CredentialsSignin, or anything unexpected.
        toast({
          variant: "error",
          title: "Invalid credentials. Please try again."
        });
      }
    } else {
      setLoading(false);
      setRedirecting(true);
      router.push(resolveCallbackUrl());
    }
  }

  function fillFromFilter() {
    setEmail(composedEmail);
    setPassword(DEMO_PASSWORD);
  }

  function fillAnchorAdmin() {
    setEmail(ANCHOR_ADMIN.email);
    setPassword(ANCHOR_ADMIN.password);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Hero panel */}
        <div className="text-white p-6 hidden lg:block">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center font-bold text-primary-800 text-lg">
              S360
            </div>
            <div>
              <div className="text-3xl font-bold">SafeOps360</div>
              <div className="text-primary-300 text-sm uppercase tracking-wider">EHS Management System</div>
            </div>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Digital EHS <br />
            {/* <span className="text-primary-300">Star Cement India</span> */}
          </h1>
          <p className="text-primary-100 text-lg mb-6 leading-relaxed">
            A unified platform for safety observations, near miss reporting, permits, incidents,
            training, inspections, and KPIs — across all plants and grinding units.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              "Safety Observation",
              "Near Miss Reporting",
              "Permit to Work + FLRA",
              "Incident Investigation",
              "Training Compliance",
              "Inspection Schedule",
              "Manhours & LTIFR",
              "Real-time MIS Dashboard"
            ].map((m) => (
              <div key={m} className="flex items-center gap-2 text-primary-200">
                <Shield size={14} className="text-primary-300" />
                {m}
              </div>
            ))}
          </div>
          <div className="mt-10 text-xs text-primary-300">
            Powered by <span className="text-white font-semibold">Vizionforge Technologies</span>
          </div>
        </div>

        {/* Login card */}
        <Card className="shadow-2xl">
          <CardHeader>
            <div className="lg:hidden flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary-700 flex items-center justify-center font-bold text-white text-sm">
                S360
              </div>
              <div>
                <div className="font-bold">SafeOps360</div>
                <div className="text-xs text-slate-500"></div>
              </div>
            </div>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Welcome back. Pick a demo role below or sign in directly.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="role.dept.plant@safeops360.in" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" disabled={loading || redirecting}>
                {redirecting ? "Opening dashboard…" : loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t space-y-3">
              {/* ── Search any user — name or email, across every demo tenant ── */}
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  {/* type="text", not "search" — a search input adds a second,
                      browser-native clear affordance next to our own X. */}
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search any user by name or email — e.g. deepak"
                    aria-label="Search demo users by name or email"
                    className="h-9 pl-9 pr-8 text-sm"
                  />
                  {searchQuery && (
                    <Button variant="ghost"
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <X size={14} />
                    </Button>
                  )}
                </div>

                {searchActive && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-slate-500">
                      {searchLoading
                        ? "Searching…"
                        : searchHits.length
                          ? `${searchHits.length} user${searchHits.length === 1 ? "" : "s"} matched "${searchQuery.trim()}"`
                          : `No user matched "${searchQuery.trim()}"`}
                    </div>
                    {searchHits.length > 0 && (
                      <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                        {searchHits.map((u) => (
                          <Card key={u.email} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 shadow-none">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[11px] font-semibold text-slate-900">{u.name}</div>
                              <div className="truncate text-[10px] text-slate-500">
                                {[u.plantCode ?? "Cross-plant", u.department, u.designation ?? roleLabel(u.role)]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                              <div className="truncate font-mono text-[10px] text-slate-400">{u.email}</div>
                            </div>
                            <Button type="button" size="sm" onClick={() => fillPersona(u.email)} className="shrink-0">Use this</Button>
                          </Card>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500">
                      Password: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{DEMO_PASSWORD}</code> · clear the search to go back to the pickers.
                    </div>
                  </div>
                )}
              </div>

              {/* Mode toggle — hidden while a search is running so the card stays compact */}
              <div className={`flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 ${searchActive ? "hidden" : ""}`}>
                <Button variant="ghost"
                  type="button"
                  onClick={() => setPickerMode("persona")}
                  className={`flex-1 text-[11px] font-medium py-1.5 px-2 rounded-md transition-colors ${pickerMode === "persona" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  Key Accounts
                </Button>
                <Button variant="ghost"
                  type="button"
                  onClick={() => setPickerMode("matrix")}
                  className={`flex-1 text-[11px] font-medium py-1.5 px-2 rounded-md transition-colors ${pickerMode === "matrix" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  Meridian Full Matrix
                </Button>
              </div>

              {/* ── Key Accounts mode — single plant-wide base accounts ── */}
              {!searchActive && pickerMode === "persona" && (
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-500">Meridian Manufacturing — one named account per role, plant-wide (not the dept×plant matrix).</div>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {PERSONA_GROUPS.map((grp) => (
                      <div key={grp} className="space-y-1.5">
                        <div className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{grp}</div>
                        {KEY_PERSONAS.filter((p) => p.group === grp).map((p) => (
                          <Card key={p.email} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 shadow-none">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[11px] font-semibold text-slate-900">
                                {p.name} <span className="font-normal text-slate-500">· {p.designation}</span>
                              </div>
                              <div className="truncate text-[10px] text-slate-500">{p.covers}</div>
                              <div className="truncate font-mono text-[10px] text-slate-400">{p.email}</div>
                            </div>
                            <Button type="button" size="sm" onClick={() => fillPersona(p.email)} className="shrink-0">Use this</Button>
                          </Card>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Password: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{DEMO_PASSWORD}</code> · Anand Krishnan (CRO) sees every ERM module.
                  </div>
                </div>
              )}

              {/* ── Meridian Full Matrix mode ── */}
              {!searchActive && pickerMode === "matrix" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-slate-500">Meridian Manufacturing — {DEMO_PLANTS.length}P × {DEMO_DEPARTMENTS.length}D × {DEMO_ROLES.length}R = {DEMO_PLANTS.length * DEMO_DEPARTMENTS.length * DEMO_ROLES.length} users</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-slate-500 uppercase tracking-wider">Plant</Label>
                      <SelectField value={plantSlug} onChange={(value) => setPlantSlug(value)} className="h-9 text-sm"
                        options={DEMO_PLANTS.map((p) => ({ value: String(p.slug), label: p.code }))}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500 uppercase tracking-wider">Department</Label>
                      <SelectField value={deptSlug} onChange={(value) => setDeptSlug(value)} className="h-9 text-sm"
                        options={DEMO_DEPARTMENTS.map((d) => ({ value: String(d.slug), label: d.name }))}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500 uppercase tracking-wider">Role</Label>
                      <SelectField value={roleSlug} onChange={(value) => setRoleSlug(value)} className="h-9 text-sm"
                        options={DEMO_ROLES.map((r) => ({ value: String(r.emailSlug), label: r.label }))}
                      />
                    </div>
                  </div>
                  <Card className="rounded-md bg-slate-50 border border-slate-200 p-2.5 text-[11px] flex items-center justify-between gap-2 shadow-none">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900 truncate">
                        {demoUserLoading ? "…" : demoUserName ?? <span className="text-slate-400 italic">No user seeded for this combo</span>}
                      </div>
                      <div className="font-mono text-slate-500 truncate text-[10px]">{composedEmail}</div>
                    </div>
                    <Button type="button" size="sm" onClick={fillFromFilter} disabled={!demoUserName}>Use this</Button>
                  </Card>
                  <div className="text-[11px] text-slate-500">
                    <strong>{selectedRole?.label}</strong> in <strong>{selectedDept?.name}</strong> at <strong>{selectedPlant?.code}</strong> ·
                    Password: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{DEMO_PASSWORD}</code>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  Cross-plant admin:
                </div>
                <Button variant="link"
                  type="button"
                  onClick={fillAnchorAdmin} className="text-[11px] font-mono underline">
                  admin@safeops360.in
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
