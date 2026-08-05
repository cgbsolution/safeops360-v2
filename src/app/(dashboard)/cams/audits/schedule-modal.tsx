"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Check, Building2, Factory } from "lucide-react";
import { cn } from "@/lib/utils";
import { IndependenceCheck, IndependenceDot } from "@/components/assurance/independence-check";
import { usePickerPreflight } from "@/components/assurance/use-picker-preflight";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { AuditLibrary, AuditTemplate, PlantUser, SCOPE_PRESETS, presetDisciplineCodes } from "./lib";

/** A row from /api/cams-completion/suppliers/vendors (the vendor boundary DTO). */
type VendorOption = {
  vendorProfileId: string;
  vendorCode: string | null;
  legalName: string;
  category: string | null;
  criticality: string | null;
  tier: string | null;
  isSingleSource: boolean;
  currentRiskBand: string | null;
  relationshipOwnerId: string | null;
};

/** Scope-filtered candidates per assignment slot, from
 *  GET /api/audit-compliance/assignable-users. Keys mirror SLOT_PERMISSION in
 *  the backend's services/audit_assignment.py. */
type AssignableSlots = {
  leadAuditor: PlantUser[];
  coAuditor: PlantUser[];
  plantManager: PlantUser[];
  auditee: PlantUser[];
};

/** The own-facility checklist for this instance — the Page Industries internal
 *  audit (HR / EHS / Production). There is no industry selector: this library
 *  is resolved, and the scheduler chooses disciplines within it. */
const PAGE_LIBRARY_CODE = "PAGE_INDUSTRIES";

export function ScheduleModal({
  plantId, templates, libraries, users, onClose, defaultTitle, dialogTitle,
}: {
  plantId: string | null;
  templates: AuditTemplate[];
  libraries: AuditLibrary[];
  users: PlantUser[];
  onClose: () => void;
  // Optional pre-fill — used when launching from a Facility's Compliance tab so
  // the title arrives suggested and the header names the facility (Change 4).
  defaultTitle?: string;
  dialogTitle?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  // ── Audit subject (WP-45) ────────────────────────────────────────────
  // The plant selected on the page stays the OWNING plant either way: it drives
  // audit numbering, RBAC scoping and programme coverage, and a supplier's
  // factory is not a Plant row. Picking "Supplier" names who is audited, it
  // does not move the audit to another site.
  //
  // Declared first because the checklist list below is derived from it.
  const [subjectType, setSubjectType] = useState<"OWN_SITE" | "VENDOR">("OWN_SITE");
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorsLoaded, setVendorsLoaded] = useState(false);
  const [vendorProfileId, setVendorProfileId] = useState("");
  const [vendorSiteRef, setVendorSiteRef] = useState("");
  const [supplierContactName, setSupplierContactName] = useState("");
  const [supplierContactEmail, setSupplierContactEmail] = useState("");

  // ── Checklist libraries, scoped to the audit SUBJECT ──────────────────
  //
  // The bug this prevents: the selector used to render the same list whatever
  // the subject was, so a supplier audit could be scoped against
  // "Garments 82" — an own-facility checklist — and would materialise plant
  // checkpoints. The resulting report reads as an internal plant inspection of
  // someone else's factory.
  //
  // `subjectScope` is derived on the backend so there is one classifier; a
  // library missing the field (older payload) is treated as OWN_SITE, which
  // fails toward "not offered for supplier audits" rather than toward offering
  // plant checklists.
  const libsForSubject = useMemo(() => {
    const wanted = subjectType === "VENDOR" ? "VENDOR" : "OWN_SITE";
    const scoped = libraries.filter((l) => {
      const scope = l.subjectScope ?? "OWN_SITE";
      return scope === wanted || scope === "BOTH";
    });
    // Removing the industry PICKER is not the same as removing the industry
    // CHOICE. The older libraries are still rows in the database (audits
    // already materialised from them keep rendering), so if they stayed in this
    // list an own-facility audit could still land on Garments or Cement purely
    // by whichever sorted first. On this instance an own-facility audit means
    // the Page Industries checklist and nothing else.
    if (subjectType !== "VENDOR") {
      const page = scoped.filter((l) => l.industryCode === PAGE_LIBRARY_CODE);
      // Fall through to the full scoped list only if the Page library is
      // genuinely absent — an honest empty state beats a silent wrong one, but
      // a demo with no checklist at all is worse than either.
      if (page.length > 0) return page;
    }
    return scoped;
  }, [libraries, subjectType]);

  // Structure without content is not selectable: the buyer regimes ship with
  // zero checkpoints because the criteria are licensed, and scheduling against
  // one would create an audit with nothing to assess.
  const selectableLibs = useMemo(
    () => libsForSubject.filter((l) => l.isSelectable ?? l.checkpointCount > 0),
    [libsForSubject],
  );
  // Scoped correctly but empty — worth naming, because "5 supplier regimes
  // exist but none have content" is a different problem from "none exist", and
  // it tells the admin exactly what to load.
  const awaitingContentLibs = useMemo(
    () => libsForSubject.filter((l) => !(l.isSelectable ?? l.checkpointCount > 0)),
    [libsForSubject],
  );

  // There is no industry to choose on this instance. An own-facility audit runs
  // the Page Industries internal-audit checklist (HR / EHS / Production); a
  // supplier audit runs whichever supplier-scoped checklist is configured. The
  // library is therefore RESOLVED rather than picked — the scheduler's real
  // choice is which disciplines are in scope, which is the field below.
  //
  // The ordering still matters: `orderedLibs[0]` is what every reset seeds
  // from, so pinning PAGE_INDUSTRIES first is what makes "the default" correct
  // rather than alphabetical.
  const orderedLibs = useMemo(() => {
    const page = selectableLibs.filter((l) => l.industryCode === PAGE_LIBRARY_CODE);
    const rest = selectableLibs.filter((l) => l.industryCode !== PAGE_LIBRARY_CODE);
    return [...page, ...rest];
  }, [selectableLibs]);

  const [title, setTitle] = useState(defaultTitle ?? "");
  const [industryCode, setIndustryCode] = useState(orderedLibs[0]?.industryCode ?? "");
  const [templateId, setTemplateId] = useState("");
  // Seed from the default library synchronously so the first paint already
  // reflects the "Full library" default (no "Will materialize 0" flash).
  const [selectedDisc, setSelectedDisc] = useState<string[]>(() => orderedLibs[0]?.categories.map((c) => c.category_code) ?? []);
  const [scopePreset, setScopePreset] = useState<string>("FULL");
  const [scheduledDate, setScheduledDate] = useState(() => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
  // No default lead: pre-selecting the alphabetically-first plant user was how
  // an unauthorised person got seated by simply not touching the field. The
  // scheduler now picks from the authorised list explicitly.
  const [leadAuditorUserId, setLead] = useState("");
  const [plantManagerUserId, setPM] = useState("");
  const [auditeeIds, setAuditeeIds] = useState<string[]>([]);
  // Co-auditors with per-discipline scope: coAuditorIds = chosen auditors,
  // auditorDisc = userId → discipline codes they conduct (lead covers the rest).
  const [coAuditorIds, setCoAuditorIds] = useState<string[]>([]);
  const [auditorDisc, setAuditorDisc] = useState<Record<string, string[]>>({});

  // Loaded lazily — an own-facility audit (the common case) should not pay for
  // the vendor list.
  useEffect(() => {
    if (subjectType !== "VENDOR" || vendorsLoaded) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/cams-completion/suppliers/vendors");
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        if (alive) setVendors(j.vendors ?? []);
      } catch {
        if (alive) setVendors([]);
      } finally {
        if (alive) setVendorsLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [subjectType, vendorsLoaded]);

  const vendor = vendors.find((v) => v.vendorProfileId === vendorProfileId);

  // ── Scope-filtered assignment pickers ──────────────────────────────────
  // Each slot lists only people who hold the permission that slot's workflow
  // actions require (EXECUTE to conduct, APPROVE to review, UPDATE to respond).
  // Fetched on open rather than passed down from the server page so the lists
  // always reflect the CURRENT admin scope assignments — revoke a role in
  // Configuration and the next open of this modal has already dropped them.
  // `users` (the full plant directory) is still used to render names elsewhere.
  const [assignable, setAssignable] = useState<AssignableSlots | null>(null);
  const [assignableError, setAssignableError] = useState<string | null>(null);
  useEffect(() => {
    if (!plantId) return;
    let alive = true;
    setAssignable(null);
    setAssignableError(null);
    (async () => {
      try {
        const res = await fetch(`/api/audit-compliance/assignable-users?plantId=${encodeURIComponent(plantId)}`);
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        if (alive) setAssignable(j.assignable ?? null);
      } catch {
        // Fail closed. Falling back to the full directory would re-open the
        // hole this replaces — better an empty picker with a visible reason.
        if (alive) {
          setAssignable({ leadAuditor: [], coAuditor: [], plantManager: [], auditee: [] });
          setAssignableError("Could not load who is authorised for these roles. Reload before scheduling.");
        }
      }
    })();
    return () => { alive = false; };
  }, [plantId]);

  const leadCandidates = assignable?.leadAuditor ?? [];
  const pmCandidates = assignable?.plantManager ?? [];
  const auditeeCandidates = assignable?.auditee ?? [];
  const assignableLoading = assignable === null;

  const [touched, setTouched] = useState(false);
  // Set by the inline independence check. The backend blocks this anyway on
  // create_audit; disabling here just stops the user submitting a form that is
  // already known to fail, with the reason already on screen.
  const [independenceBlocked, setIndependenceBlocked] = useState(false);

  const library = orderedLibs.find((l) => l.industryCode === industryCode);
  const industryTemplates = useMemo(() => templates.filter((t) => t.baseIndustry === industryCode), [templates, industryCode]);

  // When the resolved library changes, reset template + select all of its
  // disciplines (= "Full library" preset).
  useEffect(() => {
    setTemplateId("");
    setSelectedDisc(library ? library.categories.map((c) => c.category_code) : []);
    setScopePreset("FULL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industryCode]);

  // Changing the SUBJECT invalidates the checklist choice.
  //
  // This is the sharp edge of the bug, not the visible list: narrowing the
  // own-facility options is not enough, because `industryCode` would still hold
  // the own-facility code from before the toggle and submit would post it. The
  // selection is therefore cleared and re-seeded from the libraries that are
  // valid for the new subject — and left EMPTY when none are, so there is no
  // path to scheduling against a checklist the subject cannot use.
  useEffect(() => {
    const first = orderedLibs[0];
    setIndustryCode(first?.industryCode ?? "");
    setSelectedDisc(first ? first.categories.map((c) => c.category_code) : []);
    setTemplateId("");
    setScopePreset("FULL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectType]);

  const template = industryTemplates.find((t) => t.id === templateId);

  // Live count = sum of checkpoints across the ticked disciplines.
  const checkpointCount = useMemo(() => {
    if (!library) return 0;
    return library.categories
      .filter((c) => selectedDisc.includes(c.category_code))
      .reduce((sum, c) => sum + (c.checkpointCount ?? 0), 0);
  }, [library, selectedDisc]);

  function applyPreset(presetKey: string) {
    if (!library) return;
    const preset = SCOPE_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    const codes = presetDisciplineCodes(preset, library.categories);
    if (codes.length === 0) return; // preset matched nothing — leave selection
    setSelectedDisc(codes);
    setScopePreset(presetKey);
  }

  function toggleDiscipline(code: string) {
    setSelectedDisc((prev) => {
      const next = prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code];
      return next;
    });
    setScopePreset("CUSTOM"); // manual edit → custom scope
  }

  // Field-level validation
  const titleError = title.trim().length < 4 ? "Title must be at least 4 characters." : null;
  // No checklist is AVAILABLE for this subject at all — a content gap, not
  // something the scheduler can fix by choosing differently. Worded so it points
  // at the person who can fix it.
  const noLibraryForSubject = orderedLibs.length === 0;
  // With the checklist resolved rather than chosen, the only remaining failure
  // is that no checklist EXISTS for this subject — a content gap for an admin
  // to fix, never something the scheduler can correct by choosing differently.
  const industryError = noLibraryForSubject
    ? subjectType === "VENDOR"
      ? "No supplier compliance checklist is configured yet — contact your admin."
      : "No checklist library is available — contact your admin."
    : !industryCode || !library
      ? "The checklist could not be resolved — reload and try again."
      : null;
  const leadError = !leadAuditorUserId ? "Pick a lead auditor." : null;
  const disciplineError = selectedDisc.length === 0 ? "Select at least one discipline." : null;
  const supplierError =
    subjectType === "VENDOR" && !vendorProfileId ? "Pick the supplier being audited." : null;

  // Hard block on submit, distinct from field-level validation: these are
  // states where the form CANNOT produce a valid audit, so the button is
  // disabled rather than failing on click. Submitting against zero checkpoints
  // would create an audit with nothing to assess, which the backend now also
  // refuses — the button is the courtesy, the server guard is the rule.
  const scheduleBlockReason =
    noLibraryForSubject
      ? subjectType === "VENDOR"
        ? "No supplier compliance checklist is configured yet — contact your admin."
        : "No checklist library is available."
      : !library
        ? "Select a checklist first."
        : checkpointCount === 0
          ? "This selection materialises no checkpoints — there would be nothing to assess."
          : null;
  const cannotSchedule = scheduleBlockReason !== null;
  const firstError = titleError ?? industryError ?? supplierError ?? disciplineError ?? leadError;

  function toggleAuditee(id: string) {
    setAuditeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleCoAuditor(id: string) {
    setCoAuditorIds((prev) => {
      if (prev.includes(id)) {
        setAuditorDisc((m) => { const n = { ...m }; delete n[id]; return n; });
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }
  function toggleAuditorDisc(uid: string, code: string) {
    setAuditorDisc((m) => {
      const cur = m[uid] ?? [];
      return { ...m, [uid]: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code] };
    });
  }
  // Split the in-scope disciplines round-robin across the chosen co-auditors.
  function autoDistribute() {
    if (coAuditorIds.length === 0) return;
    const map: Record<string, string[]> = {};
    coAuditorIds.forEach((id) => (map[id] = []));
    selectedDisc.forEach((c, i) => { map[coAuditorIds[i % coAuditorIds.length]].push(c); });
    setAuditorDisc(map);
  }
  // Co-auditors need the same EXECUTE permission as the lead, minus whoever is
  // already the lead.
  const coAuditorUsers = (assignable?.coAuditor ?? []).filter((u) => u.id !== leadAuditorUserId);
  const discName = (code: string) => library?.categories.find((c) => c.category_code === code)?.category_name ?? code;

  // Picker-wide pre-flight: every visible candidate gets a verdict as soon as
  // the scope settles, so a scheduler can see who is assignable BEFORE clicking
  // anyone. Debounced, cached by (candidate, scopeHash) and sent as one batched
  // request — see `use-picker-preflight`.
  //
  // Auditors and auditees are checked separately because the guard's answer
  // genuinely differs by role: `assigningAs` selects which rules apply, and a
  // person blocked as an auditor is frequently the correct auditee.
  const pickerScope = useMemo(
    () => ({
      engagementKind: "AUDIT" as const,
      engagementId: null,
      siteId: plantId,
      disciplineCodes: selectedDisc,
      areaIds: [] as string[],
      departments: [] as string[],
      // Included so the picker flags the vendor's relationship owner BEFORE
      // anyone is chosen — procurement auditing its own supplier is the first
      // objection a buyer raises, and it should never reach submit.
      vendorProfileId: subjectType === "VENDOR" ? vendorProfileId || null : null,
    }),
    [plantId, selectedDisc, subjectType, vendorProfileId],
  );
  // Independence is only worth computing for people who could actually be
  // assigned, so the preflight follows the scope-filtered pickers. Union of the
  // auditor and auditee slots — the two preflights below share one request.
  const allCandidateIds = useMemo(
    () => [...new Set([
      ...(assignable?.coAuditor ?? []).map((u) => u.id),
      ...(assignable?.leadAuditor ?? []).map((u) => u.id),
      ...(assignable?.auditee ?? []).map((u) => u.id),
    ])],
    [assignable],
  );
  const auditorPreflight = usePickerPreflight({
    candidateIds: allCandidateIds,
    scope: pickerScope,
    assigningAs: "AUDITOR",
    enabled: !!plantId && selectedDisc.length > 0,
  });
  const auditeePreflight = usePickerPreflight({
    candidateIds: allCandidateIds,
    scope: pickerScope,
    assigningAs: "AUDITEE",
    enabled: !!plantId && selectedDisc.length > 0,
  });

  async function submit() {
    setTouched(true);
    if (!plantId) { toast({ variant: "error", title: "No plant selected", description: "Select a plant before scheduling an audit." }); return; }
    if (firstError) { toast({ variant: "error", title: "Missing required fields", description: firstError }); return; }

    // Distribute only the IN-SCOPE disciplines across the chosen auditees.
    const cats = selectedDisc;
    const chosen = auditeeIds;
    const auditees = chosen.map((userId, idx) => ({
      userId,
      responsibleCategories: cats.filter((_, ci) => chosen.length ? ci % chosen.length === idx : false),
    }));

    // Co-auditors with their in-scope discipline assignment (lead conducts the rest).
    const coAuditors = coAuditorIds.map((userId) => ({
      userId,
      disciplineIds: (auditorDisc[userId] ?? []).filter((c) => selectedDisc.includes(c)),
    }));

    setBusy(true);
    const res = await fetch("/api/audit-compliance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        plantId, title, industryCode, templateId: templateId || null,
        auditType: template?.auditType ?? "integrated_compliance_audit",
        // The audited party. `plantId` above remains the owning plant.
        subjectType,
        vendorProfileId: subjectType === "VENDOR" ? vendorProfileId : null,
        vendorSiteRef: subjectType === "VENDOR" ? vendorSiteRef || null : null,
        supplierContactName: subjectType === "VENDOR" ? supplierContactName || null : null,
        supplierContactEmail: subjectType === "VENDOR" ? supplierContactEmail || null : null,
        selectedDisciplineIds: selectedDisc,
        scopePresetUsed: scopePreset,
        scheduledDate: new Date(scheduledDate + "T09:00:00").toISOString(),
        scheduledStartTime: "09:00", estimatedDurationHours: 4,
        leadAuditorUserId, plantManagerUserId: plantManagerUserId || null,
        coAuditors, auditees, scopeDescription: `${library!.industryName} compliance audit`,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Couldn't schedule audit", description: j.detail || j.error || "Please try again." });
      return;
    }
    const created = await res.json();
    toast({ variant: "success", title: "Audit scheduled", description: `${created.auditNumber} — ${created.totalCheckpoints} checkpoints materialized.` });
    startTransition(() => {
      onClose();
      router.push(`/cams/audits/${created.id}`);
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl gap-3 p-0">
        <DialogHeader className="border-b px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList size={18} className="text-primary-700" /> {dialogTitle ?? "Schedule Audit"}
          </DialogTitle>
          <DialogDescription className="sr-only">Schedule an audit: choose disciplines in scope, lead auditor and auditees.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[68vh] space-y-3 overflow-y-auto px-5 py-1">
          <Field label="Audit title" required error={touched ? titleError : null}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 Integrated SA8000 + ISO 45001 Audit" aria-invalid={!!(touched && titleError)} />
          </Field>

          {/* ── Audit subject: our facility, or a supplier's ─────────────── */}
          <Field label="Audit subject" required>
            <div className="flex gap-1.5">
              {([
                { key: "OWN_SITE", label: "Own facility", Icon: Factory },
                { key: "VENDOR", label: "Supplier", Icon: Building2 },
              ] as const).map(({ key, label, Icon }) => {
                const on = subjectType === key;
                return (
                  <Button
                    key={key} type="button" size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={() => setSubjectType(key)}
                    className="flex-1 gap-1.5"
                  >
                    <Icon size={13} /> {label}
                  </Button>
                );
              })}
            </div>
            {subjectType === "VENDOR" && (
              <p className="mt-1 text-[11px] text-slate-500">
                The plant above stays the owning site for numbering, permissions and
                programme coverage — it is not the audited premises.
              </p>
            )}
          </Field>

          {subjectType === "VENDOR" && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <Field label="Supplier" required error={touched ? supplierError : null}>
                <Select
                  value={vendorProfileId}
                  onChange={(e) => setVendorProfileId(e.target.value)}
                  aria-invalid={!!(touched && supplierError)}
                >
                  <option value="">
                    {vendorsLoaded ? "— select a supplier —" : "Loading suppliers…"}
                  </option>
                  {vendors.map((v) => (
                    <option key={v.vendorProfileId} value={v.vendorProfileId}>
                      {v.legalName}
                      {v.vendorCode ? ` (${v.vendorCode})` : ""}
                      {v.criticality ? ` · ${v.criticality}` : ""}
                    </option>
                  ))}
                </Select>
                {vendorsLoaded && vendors.length === 0 && (
                  <p className="mt-1 text-[11px] text-rose-600">
                    No suppliers are on record. Add one in Vendor Risk before scheduling
                    a supplier audit.
                  </p>
                )}
              </Field>

              {/* Posture at scheduling — snapshotted server-side onto the link so
                  a later re-tier cannot rewrite why this audit was scheduled. */}
              {vendor && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {vendor.criticality && (
                    <Badge className="border-0 bg-amber-600 text-white">{vendor.criticality}</Badge>
                  )}
                  {vendor.tier && (
                    <Badge className="border-0 bg-slate-200 text-slate-600">Tier {vendor.tier}</Badge>
                  )}
                  {vendor.isSingleSource && (
                    <Badge className="border-0 bg-rose-600 text-white">Single source</Badge>
                  )}
                  {vendor.currentRiskBand && (
                    <span className="text-slate-500">Current risk: {vendor.currentRiskBand}</span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Supplier site / unit">
                  <Input
                    value={vendorSiteRef}
                    onChange={(e) => setVendorSiteRef(e.target.value)}
                    placeholder="e.g. Unit 2, Tirupur"
                  />
                </Field>
                <Field label="Supplier contact name">
                  <Input
                    value={supplierContactName}
                    onChange={(e) => setSupplierContactName(e.target.value)}
                    placeholder="Factory manager"
                  />
                </Field>
              </div>
              <Field label="Supplier contact email">
                <Input
                  type="email"
                  value={supplierContactEmail}
                  onChange={(e) => setSupplierContactEmail(e.target.value)}
                  placeholder="name@supplier.com"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Used to send the corrective-action link after the audit closes. It can
                  be added later.
                </p>
              </Field>
            </div>
          )}

          {/* There is NO checklist field. This instance audits one thing — the
              Page Industries internal checklist (HR / EHS / Production) for an
              own-facility audit, the supplier checklist for a supplier audit —
              so `industryCode` is resolved above and never shown. The
              scheduler's real choice is the discipline scope below.

              The empty state survives, because "no checklist exists for this
              subject" is a content gap an admin has to fix and silently
              scheduling against nothing would be worse than saying so. */}
          {noLibraryForSubject && (
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-3">
              <p className="text-[12px] font-medium text-amber-900">
                {subjectType === "VENDOR"
                  ? "Supplier compliance checklist not yet configured — contact your admin."
                  : "The Page Industries checklist is not loaded — contact your admin."}
              </p>
              {subjectType === "VENDOR" && (
                <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                  {awaitingContentLibs.length > 0 ? (
                    <>
                      {awaitingContentLibs.length} supplier regime
                      {awaitingContentLibs.length === 1 ? " is" : "s are"} set up (
                      {awaitingContentLibs.map((l) => l.industryName).join(", ")}) but
                      {awaitingContentLibs.length === 1 ? " has" : " have"} no
                      checkpoints loaded yet. The own-facility checklist is not offered
                      here — it would audit this supplier against our own plant
                      requirements.
                    </>
                  ) : (
                    <>
                      The own-facility checklist is not offered for supplier audits —
                      it would audit this supplier against our own plant requirements.
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Discipline scope — selectable chips + preset shortcuts */}
          {library && (
            <Field label={`Disciplines in scope — ${selectedDisc.length}/${library.categories.length} selected`} required error={touched ? disciplineError : null}>
              <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-3">
                {/* Preset shortcuts */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-500">Presets</span>
                  {SCOPE_PRESETS.map((p) => {
                    const codes = presetDisciplineCodes(p, library.categories);
                    if (codes.length === 0) return null;
                    return (
                      <Button key={p.key} type="button" size="sm" variant={scopePreset === p.key ? "default" : "outline"} onClick={() => applyPreset(p.key)} className="h-6 rounded-full px-2 text-[11px]" title={`${p.desc} · ${codes.length} disciplines`}>
                        {p.label}
                      </Button>
                    );
                  })}
                  {scopePreset === "CUSTOM" && <Badge className="border-0 bg-primary-600 text-white">Custom</Badge>}
                </div>

                {/* Selectable discipline chips */}
                <div className="flex flex-wrap gap-1.5">
                  {library.categories.map((c) => {
                    const on = selectedDisc.includes(c.category_code);
                    return (
                      <Button
                        key={c.category_code}
                        type="button"
                        variant="ghost"
                        onClick={() => toggleDiscipline(c.category_code)}
                        aria-pressed={on}
                        className={cn(
                          "h-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition",
                          on ? "border-primary-500 bg-white text-slate-700 shadow-sm" : "border-slate-200 bg-white/40 text-slate-400",
                        )}
                      >
                        <span className={cn("flex size-3.5 items-center justify-center rounded-full", on ? "text-white" : "")} style={{ backgroundColor: on ? c.category_color : "transparent", border: on ? "none" : `1.5px solid ${c.category_color}` }}>
                          {on && <Check size={9} strokeWidth={3} />}
                        </span>
                        {c.category_name}
                        <span className={cn("tabular-nums", on ? "text-slate-400" : "text-slate-300")}>{c.checkpointCount}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </Field>
          )}

          {/* Optional template (sets audit type / standard) */}
          {industryTemplates.length > 0 && (
            <Field label="Template (optional)">
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">No template — full discipline scope above</option>
                {industryTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
              {template?.description && <p className="mt-1 text-[11px] text-slate-500">{template.description}</p>}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Scheduled date" required><Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></Field>
            <Field label="Lead auditor" required error={touched ? leadError : null}>
              <Select value={leadAuditorUserId} onChange={(e) => setLead(e.target.value)} aria-invalid={!!(touched && leadError)} disabled={assignableLoading}>
                <option value="">{assignableLoading ? "loading…" : "— select —"}</option>
                {leadCandidates.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, " ")})</option>)}
              </Select>
              <SlotHint
                loading={assignableLoading}
                count={leadCandidates.length}
                permission="AUDIT_COMPLIANCE.EXECUTE"
                error={assignableError}
              />
            </Field>
          </div>

          <Field label="Plant manager (reviewer)">
            <Select value={plantManagerUserId} onChange={(e) => setPM(e.target.value)} disabled={assignableLoading}>
              <option value="">— none —</option>
              {pmCandidates.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, " ")})</option>)}
            </Select>
            <SlotHint
              loading={assignableLoading}
              count={pmCandidates.length}
              permission="AUDIT_COMPLIANCE.APPROVE"
              error={assignableError}
            />
          </Field>

          {/* Co-auditors by discipline — the lead conducts any discipline not
              assigned to a co-auditor. */}
          <Field label={`Co-auditors by discipline — ${coAuditorIds.length} selected`}>
            <SlotHint
              loading={assignableLoading}
              count={coAuditorUsers.length}
              permission="AUDIT_COMPLIANCE.EXECUTE"
              error={assignableError}
            />
            <PickerLegend state={auditorPreflight} noun="auditor" />
            <div className="max-h-28 overflow-y-auto rounded-md border border-slate-200">
              {coAuditorUsers.length === 0 && !assignableLoading && (
                <div className="p-3 text-xs text-slate-400">No other authorised auditors at this plant.</div>
              )}
              {coAuditorUsers.map((u) => {
                const on = coAuditorIds.includes(u.id);
                const v = auditorPreflight.verdicts[u.id];
                const blocked = !!v && v.blockingCount > 0 && !v.waived;
                return (
                  <Button key={u.id} type="button" variant="ghost" onClick={() => toggleCoAuditor(u.id)} className={cn("h-auto flex w-full items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-left text-sm last:border-0 hover:bg-slate-50", on && "bg-primary-50/60")}>
                    <span className={cn("flex size-4 items-center justify-center rounded border", on ? "border-primary-600 bg-primary-600 text-white" : "border-slate-300")}>{on && <Check size={11} />}</span>
                    <IndependenceDot verdict={v} pending={auditorPreflight.loading} />
                    {/* Blocked candidates stay clickable: selecting one still
                        opens the full reason panel below, which is how a waiver
                        gets requested. Greying them out would hide the reason. */}
                    <span className={cn("text-slate-700", blocked && "text-slate-400 line-through decoration-rose-300")}>{u.name}</span>
                    <span className="ml-auto text-[11px] text-slate-400">{u.role.replace(/_/g, " ")}</span>
                  </Button>
                );
              })}
            </div>
            {coAuditorIds.length > 0 && library && (
              <div className="mt-2 space-y-2 rounded-xl border border-primary-200 bg-primary-50/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-500">Assign disciplines to each auditor</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={autoDistribute}>Distribute evenly</Button>
                </div>
                {coAuditorIds.map((uid) => {
                  const u = users.find((x) => x.id === uid);
                  const mine = auditorDisc[uid] ?? [];
                  return (
                    <div key={uid} className="rounded-lg bg-white p-2">
                      <div className="mb-1 text-[12px] font-medium text-slate-700">{u?.name ?? uid} <span className="text-slate-400">· {mine.length} discipline(s)</span></div>
                      <div className="flex flex-wrap gap-1">
                        {selectedDisc.map((code) => {
                          const on = mine.includes(code);
                          return (
                            <Button key={code} type="button" variant="ghost" onClick={() => toggleAuditorDisc(uid, code)} aria-pressed={on}
                              className={cn("h-auto rounded-full border px-2 py-0.5 text-[11px] transition", on ? "border-primary-500 bg-primary-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")}>
                              {discName(code)}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Field>

          <Field label={`Auditees (failed checkpoints route to them) — ${auditeeIds.length} selected`}>
            <SlotHint
              loading={assignableLoading}
              count={auditeeCandidates.length}
              permission="AUDIT_COMPLIANCE.UPDATE"
              error={assignableError}
            />
            <PickerLegend state={auditeePreflight} noun="auditee" />
            <div className="max-h-28 overflow-y-auto rounded-md border border-slate-200">
              {auditeeCandidates.length === 0 && !assignableLoading && (
                <div className="p-3 text-xs text-slate-400">No authorised auditees at this plant.</div>
              )}
              {auditeeCandidates.map((u) => {
                const on = auditeeIds.includes(u.id);
                const v = auditeePreflight.verdicts[u.id];
                const blocked = !!v && v.blockingCount > 0 && !v.waived;
                return (
                  <Button key={u.id} type="button" variant="ghost" onClick={() => toggleAuditee(u.id)} className={cn("h-auto flex w-full items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-left text-sm last:border-0 hover:bg-slate-50", on && "bg-primary-50/60")}>
                    <span className={cn("flex size-4 items-center justify-center rounded border", on ? "border-primary-600 bg-primary-600 text-white" : "border-slate-300")}>{on && <Check size={11} />}</span>
                    <IndependenceDot verdict={v} pending={auditeePreflight.loading} />
                    <span className={cn("text-slate-700", blocked && "text-slate-400 line-through decoration-rose-300")}>{u.name}</span>
                    <span className="ml-auto text-[11px] text-slate-400">{u.role.replace(/_/g, " ")}</span>
                  </Button>
                );
              })}
            </div>
          </Field>

          {/* Auditor independence, checked INLINE at team assignment
              (docs/cams/09 §2.1.5). Running it here rather than on submit means
              a conflict is shown next to the person while the form is still
              open — a submit-time failure would cost the user the whole form.
              The engagement does not exist yet, so the prospective scope is
              sent directly and a waiver is not offered: "choose another
              auditor" is the only path pre-creation, by design. */}
          <IndependenceCheck
            userIds={[leadAuditorUserId, ...coAuditorIds].filter(Boolean)}
            assigningAs="AUDITOR"
            names={Object.fromEntries(users.map((u) => [u.id, u.name]))}
            scope={{
              engagementKind: "AUDIT",
              engagementId: null,
              siteId: plantId,
              disciplineCodes: selectedDisc,
              leadAuditorId: leadAuditorUserId || null,
              teamAuditorIds: coAuditorIds,
              auditeeUserIds: [...auditeeIds, plantManagerUserId].filter(Boolean),
              vendorProfileId: subjectType === "VENDOR" ? vendorProfileId || null : null,
            }}
            onResult={(r) => setIndependenceBlocked(r.blockedCount > 0)}
          />
        </div>

        <DialogFooter className="items-center justify-between gap-2 border-t px-5 py-3 sm:justify-between">
          {/* An audit with nothing to assess is not a schedulable audit, so the
              count states that plainly rather than reading "0 checkpoints" as
              though it were an ordinary quantity. */}
          {checkpointCount === 0 ? (
            <span className="text-xs font-medium text-amber-700">
              No checkpoints — nothing to assess
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              Will materialize <span className="font-semibold text-slate-700">{checkpointCount}</span> checkpoints
            </span>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              type="button" size="sm" onClick={submit}
              disabled={busy || independenceBlocked || cannotSchedule}
              title={
                independenceBlocked
                  ? "Resolve the auditor independence conflict above first."
                  : cannotSchedule
                    ? scheduleBlockReason ?? undefined
                    : undefined
              }
            >
              {busy ? "Scheduling…" : "Schedule audit"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The one line that turns a list of dots into information.
 *
 * Without it a scheduler sees coloured dots and has to guess the key. With it
 * they get the number that actually matters — how many of these people they can
 * assign — before clicking anyone, which was the whole gap.
 */
/**
 * Names the permission behind a picker, so an admin who sees a short list knows
 * exactly which grant to edit in Configuration → Roles rather than guessing.
 * This is scope eligibility (who MAY hold the role), distinct from the
 * independence legend below it (who SHOULD, per ISO 19011 impartiality).
 */
function SlotHint({
  loading, count, permission, error,
}: {
  loading: boolean;
  count: number;
  permission: string;
  error: string | null;
}) {
  if (error) return <p className="mt-1 text-[11px] text-rose-700">{error}</p>;
  if (loading) return <p className="mt-1 text-[11px] text-slate-400">Checking who is authorised…</p>;
  return (
    <p className={cn("mt-1 text-[11px]", count === 0 ? "text-amber-700" : "text-slate-500")}>
      {count === 0
        ? `Nobody at this plant holds ${permission}. Grant it in Configuration → Roles.`
        : `${count} authorised — holders of ${permission} at this plant.`}
    </p>
  );
}

function PickerLegend({
  state, noun,
}: {
  state: { ready: boolean; loading: boolean; error: string | null; blockedCount: number; verdicts: Record<string, unknown> };
  noun: string;
}) {
  const total = Object.keys(state.verdicts).length;
  if (state.error) {
    return (
      <p className="mb-1 text-[11px] text-amber-700">
        Independence could not be checked for this list — select a person to check them individually.
      </p>
    );
  }
  if (!state.ready && state.loading) {
    return <p className="mb-1 text-[11px] text-slate-400">Checking independence…</p>;
  }
  if (!state.ready || total === 0) {
    return (
      <p className="mb-1 text-[11px] text-slate-400">
        Pick the disciplines in scope to see who is independent.
      </p>
    );
  }
  const assignable = total - state.blockedCount;
  return (
    <p className="mb-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-2 rounded-full bg-emerald-500" />
        {assignable} assignable as {noun}
      </span>
      {state.blockedCount > 0 && (
        <span className="inline-flex items-center gap-1 text-rose-700">
          <span className="inline-block size-2 rounded-full bg-rose-500" />
          {state.blockedCount} blocked
        </span>
      )}
      {state.loading && <span className="text-slate-400">updating…</span>}
    </p>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</Label>
      {children}
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
