"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Check, Building2, Factory, Layers, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { IndependenceCheck, IndependenceDot } from "@/components/assurance/independence-check";
import { usePickerPreflight } from "@/components/assurance/use-picker-preflight";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { PERSON_CLEAR, PersonSelect } from "@/components/ui/person-select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  AuditCategory, AuditCategoryCode, AuditLibrary, AuditTemplate, PlantUser,
  AUDIT_CATEGORY_FALLBACK, AUDIT_CATEGORY_ICON, SCOPE_PRESETS,
  presetDisciplineCodes, resolveAuditCategories, scopedSelectableLibs, scopeAxisWords,
} from "./lib";

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

/** Shared with the annual-programme wizard, which offers the same categories —
 *  see `AUDIT_CATEGORY_ICON` in ./lib. */
const CATEGORY_ICON = AUDIT_CATEGORY_ICON;

/**
 * An external participant on a supplier audit.
 *
 * No `userId`: they have no account here. The email is the identity and the thing
 * the access link is issued to, which is why it is the only required field.
 */
type ExternalParty = { email: string; name: string; disciplineIds: string[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ScheduleModal({
  plantId: initialPlantId, plant, plants = [], templates, libraries, users, auditCategories,
  onClose, defaultTitle, dialogTitle,
}: {
  plantId: string | null;
  // The owning site. `plant` is the one the page opened on; `plants` is every
  // site this caller may audit (AUDIT_COMPLIANCE.READ scope). When there is
  // more than one, the choice is made HERE rather than in the page header the
  // dialog covers — asking someone to cancel, scroll up, switch and reopen is
  // not a plant picker.
  plant?: { id: string; code: string; name: string } | null;
  plants?: { id: string; code: string; name: string }[];
  templates: AuditTemplate[];
  libraries: AuditLibrary[];
  users: PlantUser[];
  /** The category menu from /api/audit-compliance/library. Optional so callers
   *  that predate it keep working — the client-side mirror stands in. */
  auditCategories?: AuditCategory[];
  onClose: () => void;
  // Optional pre-fill — used when launching from a Facility's Compliance tab so
  // the title arrives suggested and the header names the facility (Change 4).
  defaultTitle?: string;
  dialogTitle?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  // `isPending` is true from the moment the post-success transition starts until
  // the audit page has loaded. That gap used to render as "Schedule audit" again
  // — the request had returned, so `busy` was already false — which read as if
  // nothing had happened and invited a second click on an audit that existed.
  const [isPending, startTransition] = useTransition();
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

  // ── Audit category → checklist → disciplines ──────────────────────────
  //
  // The category is the scheduler's first real choice and the head of the
  // chain: category resolves the library, the library supplies the disciplines,
  // the ticked disciplines decide which checkpoints materialise. Nothing here
  // is picked by sort order, which is the failure the previous single-library
  // shortcut was written to avoid and this generalises rather than reopens.
  const catalogue = auditCategories?.length ? auditCategories : AUDIT_CATEGORY_FALLBACK;
  // Categories are filtered by the SUBJECT, so the two axes stay untangled:
  // Own facility offers Internal and QMS/EMS/OHS; Supplier offers Social
  // Compliance and the Supplier Code of Conduct. Social Compliance sits on the
  // supplier side because its questions — valid factory licence, minimum wages,
  // no child labour — are put to a supplier's factory, and for our own site the
  // internal HR/EHS audit already covers that ground.
  const categoryOptions = useMemo(
    () => resolveAuditCategories(libraries, catalogue, subjectType),
    [libraries, catalogue, subjectType],
  );
  const [auditCategory, setAuditCategory] = useState<AuditCategoryCode | "">(
    () => resolveAuditCategories(libraries, catalogue, "OWN_SITE")[0]?.code ?? "",
  );
  // Falls back to the first option for THIS subject, which is what makes the
  // toggle land on a valid category instead of stranding a supplier audit on
  // "Internal" — the codes are per-subject and do not survive the switch.
  const activeCategory =
    categoryOptions.find((c) => c.code === auditCategory) ?? categoryOptions[0] ?? null;

  // ── Supplier checklists, scoped to the audit SUBJECT ──────────────────
  //
  // The bug this prevents: the selector used to render the same list whatever
  // the subject was, so a supplier audit could be scoped against an
  // own-facility checklist and would materialise plant checkpoints. The
  // resulting report reads as an internal plant inspection of someone else's
  // factory.
  //
  // `subjectScope` is derived on the backend so there is one classifier; a
  // library missing the field (older payload) is treated as OWN_SITE, which
  // fails toward "not offered for supplier audits" rather than toward offering
  // plant checklists. `vendorLibs` now only answers "does a supplier checklist
  // exist at all" for the empty state — WHICH one is used is the category's job.
  const vendorLibs = useMemo(
    () => (subjectType === "VENDOR" ? scopedSelectableLibs(libraries, "VENDOR") : []),
    [libraries, subjectType],
  );
  const isVendor = subjectType === "VENDOR";
  // Scoped correctly but empty — worth naming, because "5 supplier regimes
  // exist but none have content" is a different problem from "none exist", and
  // it tells the admin exactly what to load.
  const awaitingContentLibs = useMemo(
    () =>
      subjectType === "VENDOR"
        ? libraries.filter((l) => {
            const scope = l.subjectScope ?? "OWN_SITE";
            return (scope === "VENDOR" || scope === "BOTH") && !(l.isSelectable ?? l.checkpointCount > 0);
          })
        : [],
    [libraries, subjectType],
  );

  // The resolved checklist. Own facility → whichever library the chosen
  // category points at; supplier → whichever supplier-scoped checklist is
  // configured. Derived rather than held in state so the category and the
  // checklist can never disagree.
  // ONE rule for both subjects: the chosen category names the checklist. The
  // supplier branch used to take `vendorLibs[0]` — whichever sorted first — and
  // with two supplier checklists now live (Social Compliance and the Code of
  // Conduct) that is exactly the pick-by-sort-order bug the categories replaced.
  const library = activeCategory?.library ?? null;
  const industryCode = library?.industryCode ?? "";

  const [title, setTitle] = useState(defaultTitle ?? "");
  const [templateId, setTemplateId] = useState("");
  // Seed from the resolved library synchronously so the first paint already
  // reflects the "Full library" default (no "Will materialize 0" flash).
  const [selectedDisc, setSelectedDisc] = useState<string[]>(
    () => categoryOptions[0]?.library.categories.map((c) => c.category_code) ?? [],
  );
  const [scopePreset, setScopePreset] = useState<string>("FULL");
  const [scheduledDate, setScheduledDate] = useState(() => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
  // The owning plant, selectable in-dialog when the caller has more than one.
  // Free-text filters for the two long people pickers. Held per-picker so
  // narrowing the auditee list does not also narrow the auditors'.
  const [coAuditorQuery, setCoAuditorQuery] = useState("");
  const [auditeeQuery, setAuditeeQuery] = useState("");

  const [plantId, setPlantId] = useState<string | null>(initialPlantId);
  useEffect(() => { setPlantId(initialPlantId); }, [initialPlantId]);
  const activePlant = plants.find((x) => x.id === plantId) ?? plant ?? null;

  /** Candidates as PersonSelect options — one flat, unlabelled group. */
  const asOptions = (list: { id: string; name: string; role: string; department?: string }[]) =>
    list.length ? [{ label: "", members: list.map((u) => ({
      id: u.id, name: u.name, role: u.role.replace(/_/g, " "), department: u.department,
    })) }] : [];

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
  // External parties on a SUPPLIER audit. They hold no platform seat, so there
  // is nothing to pick from a directory — the email IS the identity, and each
  // address gets its own access link.
  const [extCoAuditors, setExtCoAuditors] = useState<ExternalParty[]>([]);
  const [extAuditees, setExtAuditees] = useState<ExternalParty[]>([]);

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
  // `users` (the plant directory) is merged with these into `directory` below,
  // which is what resolves a name anywhere in this dialog.
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

  const industryTemplates = useMemo(() => templates.filter((t) => t.baseIndustry === industryCode), [templates, industryCode]);

  // The resolved checklist changed — because the category changed, or because
  // the SUBJECT toggle swapped the whole axis. Either way the previous
  // discipline selection belongs to a different library and its codes are
  // meaningless here, so it is re-seeded to that library's full scope and left
  // EMPTY when there is no library at all. Keying on `industryCode` covers both
  // causes with one rule, so there is no path to submitting disciplines the
  // resolved checklist does not contain.
  //
  // `industryCode` is derived, so this effect only ever follows the resolution —
  // it cannot fight it.
  useEffect(() => {
    setTemplateId("");
    setSelectedDisc(library ? library.categories.map((c) => c.category_code) : []);
    setScopePreset("FULL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industryCode]);

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
  const noLibraryForSubject =
    subjectType === "VENDOR" ? vendorLibs.length === 0 : categoryOptions.length === 0;
  // With the checklist resolved by the category rather than chosen, the only
  // remaining failure is that no checklist EXISTS for this subject — a content
  // gap for an admin to fix, never something the scheduler can correct by
  // choosing differently.
  const industryError = noLibraryForSubject
    ? subjectType === "VENDOR"
      ? "No supplier compliance checklist is configured yet — contact your admin."
      : "No audit category has a checklist loaded — contact your admin."
    : !industryCode || !library
      ? "The checklist could not be resolved — reload and try again."
      : null;
  const categoryError =
    subjectType === "VENDOR" || activeCategory ? null : "Choose an audit category.";
  const leadError = !leadAuditorUserId ? "Pick a lead auditor." : null;
  const disciplineError = selectedDisc.length === 0 ? "Select at least one discipline." : null;
  const supplierError =
    subjectType === "VENDOR" && !vendorProfileId ? "Pick the supplier being audited." : null;
  // Required on a supplier audit, not optional as the old "contact" fields were.
  // They are no longer a nicety for a follow-up email: the supplier manager IS
  // the reviewer counterpart, and their address is the credential the access
  // link is issued to — an audit with neither has nobody to answer for it.
  const supplierManagerError =
    isVendor && supplierContactName.trim().length < 2
      ? "Name the supplier manager who answers for this factory."
      : null;
  const supplierEmailError =
    isVendor && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(supplierContactEmail.trim())
      ? "A valid email is needed — the access link is issued to it."
      : null;

  // Hard block on submit, distinct from field-level validation: these are
  // states where the form CANNOT produce a valid audit, so the button is
  // disabled rather than failing on click. Submitting against zero checkpoints
  // would create an audit with nothing to assess, which the backend now also
  // refuses — the button is the courtesy, the server guard is the rule.
  const scheduleBlockReason =
    noLibraryForSubject
      ? subjectType === "VENDOR"
        ? "No supplier compliance checklist is configured yet — contact your admin."
        : "No audit category has a checklist loaded."
      : !library
        ? "Choose an audit category first."
        : checkpointCount === 0
          ? "This selection materialises no checkpoints — there would be nothing to assess."
          : null;
  const cannotSchedule = scheduleBlockReason !== null;
  const firstError = titleError ?? categoryError ?? industryError ?? supplierError
    ?? supplierManagerError ?? supplierEmailError ?? disciplineError ?? leadError;

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
  // Match on everything the row can show plus the email behind it, so a
  // search works whether you remember the person, their address or their job.
  const matchesQuery = (u: PlantUser, q: string) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [u.name, u.email, u.role, u.department]
      .some((f) => (f ?? "").toLowerCase().includes(t));
  };

  const coAuditorUsers = (assignable?.coAuditor ?? []).filter((u) => u.id !== leadAuditorUserId);

  // Every person this dialog can NAME, keyed by id.
  //
  // `users` is the plant DIRECTORY — people whose home plant is this one. The
  // assignable slots are scope-based, and an auditor's AUDIT_COMPLIANCE grant is
  // deliberately ALL_PLANTS so audit independence can send a lead or co-auditor
  // to a site that is not their own. Those people are offered by the picker and
  // absent from `users`, so resolving a name against `users` alone rendered a
  // raw cuid instead of the person — in the per-auditor assignment panel below
  // and in the independence check's name map.
  //
  // Assignable wins on conflict: it is fetched on open and reflects the current
  // scope, while `users` came down with the page.
  const directory = useMemo(() => {
    const m = new Map<string, PlantUser>();
    for (const u of users) m.set(u.id, u);
    for (const slot of [assignable?.leadAuditor, assignable?.coAuditor, assignable?.plantManager, assignable?.auditee]) {
      for (const u of slot ?? []) m.set(u.id, u);
    }
    return m;
  }, [users, assignable]);
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
        // The category's own audit type, so a report names the regime it was run
        // under (internal / management system / social compliance) instead of
        // the one generic label all three used to share. A template still wins
        // when one is chosen — it is the more specific statement of intent.
        auditType:
          template?.auditType ?? activeCategory?.auditType ?? "integrated_compliance_audit",
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
        leadAuditorUserId,
        // Not merely hidden — cleared. A reviewer chosen before the subject was
        // switched to Supplier would otherwise still be posted, seating an
        // internal plant manager over an audit of someone else's factory.
        plantManagerUserId: isVendor ? null : plantManagerUserId || null,
        coAuditors: isVendor ? [] : coAuditors,
        auditees: isVendor ? [] : auditees,
        // Externals only travel on a supplier audit. Sending them for an
        // own-facility audit would mint external credentials for an audit whose
        // participants all have accounts.
        externalCoAuditors: isVendor ? extCoAuditors.filter((p) => p.email.trim()) : [],
        externalAuditees: isVendor ? extAuditees.filter((p) => p.email.trim()) : [],
        scopeDescription: `${library!.industryName} compliance audit`,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ variant: "error", title: "Couldn't schedule audit", description: j.detail || j.error || "Please try again." });
      return;
    }
    const created = await res.json();
    // The links come back ONCE — only a hash of each token is stored, so this
    // response is the only place the usable URLs ever exist. Saying how many went
    // out is the difference between "scheduled" and "scheduled AND the factory can
    // actually reach it".
    const links: { role: string; email: string }[] = created.portalLinks ?? [];
    toast({
      variant: "success",
      title: "Audit scheduled",
      description: links.length
        ? `${created.auditNumber} — ${created.totalCheckpoints} checkpoints. ${links.length} access link${links.length === 1 ? "" : "s"} issued (${[...new Set(links.map((l) => l.role.replace(/_/g, " ").toLowerCase()))].join(", ")}).`
        : `${created.auditNumber} — ${created.totalCheckpoints} checkpoints materialized.`,
    });
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
          <DialogDescription className="sr-only">Schedule an audit: choose the disciplines or departments in scope, lead auditor and auditees.</DialogDescription>
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
            {plants.length > 1 ? (
              // Same Field + Select pair as Lead auditor and Plant manager
              // below. A hand-rolled <select> here rendered as a bare native
              // dropdown in the middle of a styled form — the one control on
              // the dialog that did not look like the others.
              <div className="mt-2">
                <Field label="Owning site" required>
                  <SelectField
                    value={plantId ?? ""}
                    onChange={(value) => setPlantId(value || null)}
                    options={plants.map((x) => ({ value: x.id, label: `${x.code} — ${x.name}` }))}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    The audit, its numbering and its checkpoints are created against this site.
                  </p>
                </Field>
              </div>
            ) : activePlant ? (
              <p className="mt-1 text-[11px] text-slate-500">
                Owning site: <span className="font-medium text-slate-700">{activePlant.code} — {activePlant.name}</span>
                {" "}· the only site your role may audit.
              </p>
            ) : null}
            {subjectType === "VENDOR" && (
              <p className="mt-1 text-[11px] text-slate-500">
                The owning site selected above stays the owner for numbering, permissions
                and programme coverage — it is not the audited premises.
              </p>
            )}
          </Field>

          {/* ── Audit category — what KIND of audit this is ───────────────
              The head of the scope chain: the category resolves the checklist,
              and the discipline chips below are that checklist's. Rendered for
              own-facility audits only — a supplier audit's checklist is already
              filtered by that subject: Own facility offers Internal and
              QMS/EMS/OHS, Supplier offers Social Compliance and the Code of
              Conduct. Same control either way — only the options change.

              Only categories with a loaded checklist appear. A category on
              screen is therefore always schedulable, and the count under each
              says what it would cost before it is picked. */}
          {categoryOptions.length > 0 && (
            <Field label="Audit category" required error={touched ? categoryError : null}>
              {/* Columns follow the count, because the count is not fixed: only
                  categories with a loaded checklist are rendered, so a partly
                  seeded instance shows one or two — and three hardcoded columns
                  would leave them squeezed into a third of the row. */}
              <div
                className={cn(
                  "grid gap-1.5",
                  categoryOptions.length === 1 ? "grid-cols-1"
                    : categoryOptions.length === 2 ? "grid-cols-2" : "grid-cols-3",
                )}
              >
                {categoryOptions.map((c) => {
                  const on = activeCategory?.code === c.code;
                  const Icon = CATEGORY_ICON[c.code] ?? Layers;
                  return (
                    <Button
                      key={c.code} type="button" variant="ghost"
                      onClick={() => setAuditCategory(c.code)}
                      aria-pressed={on}
                      title={`${c.description} · ${c.library.checkpointCount} checkpoints across ${c.library.categories.length} ${scopeAxisWords(c.library).many}`}
                      className={cn(
                        "justify-start h-auto flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition",
                        on
                          ? "border-primary-600 bg-primary-50 text-primary-900 shadow-sm"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold leading-tight">
                        <Icon size={13} className={on ? "text-primary-700" : "text-slate-400"} />
                        {c.label}
                      </span>
                      <span className={cn("text-[10px] tabular-nums", on ? "text-primary-700" : "text-slate-400")}>
                        {c.library.categories.length} {scopeAxisWords(c.library).many} · {c.library.checkpointCount} checkpoints
                      </span>
                    </Button>
                  );
                })}
              </div>
              {activeCategory && (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  {activeCategory.description}
                  {/* Said once, here: the category changes which questions are
                      asked, never how they are answered. Every category grades
                      on the same Grade / Compliance / Risk vocabulary and rolls
                      up into the same score, so a scheduler picking QMS or
                      Social Compliance knows they are not opting into a
                      different kind of report. */}
                  {activeCategory.code !== "INTERNAL" && activeCategory.library.segregation !== "DEPARTMENT" && (
                    <> Conducted, graded and reported in the internal-audit format.</>
                  )}
                </p>
              )}
              {/* A department library is the one category that IS answered and
                  reported differently, so the two things a scheduler cannot
                  discover from the chips below are said here: three parameters
                  instead of the grade ladder, and two documents out of one
                  audit. Both are read from the payload, never from the
                  category code. */}
              {activeCategory?.library.segregation === "DEPARTMENT" && (
                <Card className="mt-1.5 space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-600 shadow-none">
                  <div>
                    Each <span className="font-medium text-slate-700">department</span> is audited
                    against both source sheets, and each checkpoint is answered{" "}
                    {activeCategory.library.conformanceMode === "TRISTATE"
                      ? "Conformance / Non-Conformance / Observation."
                      : "on the standard grading vocabulary."}
                  </div>
                  {(activeCategory.library.streams?.length ?? 0) > 1 && (
                    <div>
                      <span className="font-medium text-slate-700">
                        {activeCategory.library.streams!.length} separate reports
                      </span>{" "}
                      are issued —{" "}
                      {activeCategory.library.streams!
                        .map((s) => `${s.label} (${s.standards})`)
                        .join(" and ")}.
                    </div>
                  )}
                </Card>
              )}
            </Field>
          )}

          {subjectType === "VENDOR" && (
            <Alert variant="warning" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <Field label="Supplier" required error={touched ? supplierError : null}>
                <SelectField
                  value={vendorProfileId}
                  onChange={setVendorProfileId}
                  aria-invalid={!!(touched && supplierError)}
                  placeholder={`${vendorsLoaded ? "— select a supplier —" : "Loading suppliers…"}`}
                  options={vendors.map((v) => ({ value: v.vendorProfileId, label: `${v.legalName} ${v.vendorCode ? ` (${v.vendorCode})` : ""} ${v.criticality ? ` · ${v.criticality}` : ""}` }))}
                />
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
                <Field label="Supplier manager" required error={touched ? supplierManagerError : null}>
                  <Input
                    value={supplierContactName}
                    onChange={(e) => setSupplierContactName(e.target.value)}
                    placeholder="Name of the factory / supplier manager"
                    aria-invalid={!!(touched && supplierManagerError)}
                  />
                </Field>
              </div>
              <Field label="Supplier manager email" required error={touched ? supplierEmailError : null}>
                <Input
                  type="email"
                  value={supplierContactEmail}
                  onChange={(e) => setSupplierContactEmail(e.target.value)}
                  placeholder="manager@supplier.com"
                  aria-invalid={!!(touched && supplierEmailError)}
                />
                {/* The supplier manager stands in for the plant manager on a
                    supplier audit: they are the counterpart who answers for the
                    factory. They hold no platform seat, so the email is the
                    identity — it is what the access link is issued to. */}
                <p className="mt-1 text-[11px] text-slate-500">
                  A secure link is issued to this address. The supplier manager signs in
                  with the link alone — no account — and sees only this audit, nothing else
                  in SafeOps360.
                </p>
              </Field>
            </Alert>
          )}

          {/* There is still NO checklist field. The audit CATEGORY above names
              the checklist for an own-facility audit and the subject names it
              for a supplier audit, so `industryCode` is resolved either way and
              never picked from a list of library names. The scheduler's choices
              are the category and the discipline scope below it.

              The empty state survives, because "no checklist exists for this
              subject" is a content gap an admin has to fix and silently
              scheduling against nothing would be worse than saying so. */}
          {noLibraryForSubject && (
            <Alert variant="warning" className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-3">
              <p className="text-[12px] font-medium text-amber-900">
                {subjectType === "VENDOR"
                  ? "Supplier compliance checklist not yet configured — contact your admin."
                  : "No audit category has a checklist loaded — contact your admin."}
              </p>
              {subjectType === "OWN_SITE" && (
                <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                  Seed them with <code className="rounded bg-amber-100 px-1">scripts/seed_page_industries_library.py</code>{" "}
                  (Internal) and{" "}
                  <code className="rounded bg-amber-100 px-1">scripts/seed_page_audit_category_libraries.py</code>{" "}
                  (QMS/EMS/OHS and Social Compliance).
                </p>
              )}
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
            </Alert>
          )}

          {/* Scope — selectable chips + preset shortcuts.
              The axis is the LIBRARY's: "Disciplines in scope" over a list
              reading HR / Admin / OHC is a false statement in the one place a
              scheduler decides what the audit covers. */}
          {library && (
            <Field label={`${scopeAxisWords(library).Title} in scope — ${selectedDisc.length}/${library.categories.length} selected`} required error={touched ? disciplineError : null}>
              <Card className="rounded-xl border border-primary-200 bg-primary-50/60 p-3 shadow-none">
                {/* Preset shortcuts */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-500">Presets</span>
                  {SCOPE_PRESETS.map((p) => {
                    const codes = presetDisciplineCodes(p, library.categories);
                    if (codes.length === 0) return null;
                    return (
                      <Button key={p.key} type="button" size="sm" variant={scopePreset === p.key ? "default" : "outline"} onClick={() => applyPreset(p.key)} className="h-6 rounded-full px-2 text-[11px]" title={`${p.desc} · ${codes.length} ${scopeAxisWords(library).many}`}>
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
              </Card>
            </Field>
          )}

          {/* Optional template (sets audit type / standard) */}
          {industryTemplates.length > 0 && (
            <Field label="Template (optional)">
              <SelectField value={templateId} onChange={setTemplateId}
                placeholder={`No template — full ${scopeAxisWords(library).one} scope above`}
                options={industryTemplates.map((t) => ({ value: t.id, label: t.name }))}
              />
              {template?.description && <p className="mt-1 text-[11px] text-slate-500">{template.description}</p>}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Scheduled date" required><Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></Field>
            <Field label="Lead auditor" required error={touched ? leadError : null}>
              <PersonSelect
                value={leadAuditorUserId}
                groups={asOptions(leadCandidates)}
                placeholder={assignableLoading ? "loading…" : "— select —"}
                emptyText="Nobody at this site holds AUDIT_COMPLIANCE.EXECUTE."
                invalid={!!(touched && leadError)}
                disabled={assignableLoading}
                onPick={(v) => setLead(v === PERSON_CLEAR ? "" : v)}
              />
              <SlotHint
                loading={assignableLoading}
                count={leadCandidates.length}
                permission="AUDIT_COMPLIANCE.EXECUTE"
                error={assignableError}
              />
            </Field>
          </div>

          {/* The reviewer seat, and who fills it.
              On an OWN-FACILITY audit it is our plant manager. On a SUPPLIER
              audit there is no plant manager to name — the audited factory is
              not ours — so the counterpart is the supplier manager captured
              above, and this internal picker is not shown at all rather than
              offered and left empty. */}
          {!isVendor && (
            <Field label="Plant manager (reviewer)">
              <PersonSelect
                value={plantManagerUserId}
                groups={asOptions(pmCandidates)}
                placeholder="— none —" clearLabel="— none —"
                emptyText="Nobody at this site holds AUDIT_COMPLIANCE.APPROVE."
                disabled={assignableLoading}
                onPick={(v) => setPM(v === PERSON_CLEAR ? "" : v)}
              />
              <SlotHint
                loading={assignableLoading}
                count={pmCandidates.length}
                permission="AUDIT_COMPLIANCE.APPROVE"
                error={assignableError}
              />
            </Field>
          )}

          {/* ── External co-auditors and auditees (supplier audits) ───────
              A supplier audit is conducted at a factory that is not ours, by and
              with people who have no accounts here. So instead of directory
              pickers this collects addresses: every one gets its own link into
              this audit and nothing else.

              The internal pickers below are hidden for a supplier audit rather
              than shown alongside — offering both would leave it ambiguous who
              is actually expected to turn up. */}
          {isVendor && (
            <>
              <EmailPartyField
                label="External co-auditors"
                hint={`Each auditor gets their own link and conducts the ${scopeAxisWords(library).many} you scope them to. Leave empty if the audit is conducted only by our own team.`}
                parties={extCoAuditors}
                onChange={setExtCoAuditors}
                disciplines={selectedDisc.map((c) => ({ code: c, name: discName(c) }))}
                addLabel="Add co-auditor"
              />
              <EmailPartyField
                label="Factory auditees"
                hint={`Findings in their ${scopeAxisWords(library).many} route to them, and they respond through their own link.`}
                parties={extAuditees}
                onChange={setExtAuditees}
                disciplines={selectedDisc.map((c) => ({ code: c, name: discName(c) }))}
                addLabel="Add auditee"
              />
            </>
          )}

          {/* Co-auditors by discipline — the lead conducts any discipline not
              assigned to a co-auditor. */}
          {!isVendor && (
          <Field label={`Co-auditors by ${scopeAxisWords(library).one} — ${coAuditorIds.length} selected`}>
            <SlotHint
              loading={assignableLoading}
              count={coAuditorUsers.length}
              permission="AUDIT_COMPLIANCE.EXECUTE"
              error={assignableError}
            />
            <PickerLegend state={auditorPreflight} noun="auditor" />
            <PickerSearch
              value={coAuditorQuery}
              onChange={setCoAuditorQuery}
              placeholder="Search auditors by name or email…"
              shown={coAuditorUsers.filter((u) => matchesQuery(u, coAuditorQuery)).length}
              total={coAuditorUsers.length}
            />
            <Card className="max-h-28 overflow-y-auto rounded-md border border-slate-200 shadow-none">
              {coAuditorUsers.length === 0 && !assignableLoading && (
                <div className="p-3 text-xs text-slate-400">No other authorised auditors at this plant.</div>
              )}
              {coAuditorUsers.length > 0
                && coAuditorUsers.filter((u) => matchesQuery(u, coAuditorQuery)).length === 0 && (
                <div className="p-3 text-xs text-slate-400">
                  No auditor matches “{coAuditorQuery}”.
                </div>
              )}
              {coAuditorUsers.filter((u) => matchesQuery(u, coAuditorQuery)).map((u) => {
                const on = coAuditorIds.includes(u.id);
                const v = auditorPreflight.verdicts[u.id];
                const blocked = !!v && v.blockingCount > 0 && !v.waived;
                return (
                  <Button key={u.id} type="button" variant="ghost" onClick={() => toggleCoAuditor(u.id)} className={cn("justify-start h-auto flex w-full items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-left text-sm last:border-0 hover:bg-slate-50", on && "bg-primary-50/60")}>
                    <span className={cn("flex size-4 items-center justify-center rounded border", on ? "border-primary-600 bg-primary-600 text-white" : "border-slate-300")}>{on && <Check size={11} />}</span>
                    <IndependenceDot verdict={v} pending={auditorPreflight.loading} />
                    {/* Blocked candidates stay clickable: selecting one still
                        opens the full reason panel below, which is how a waiver
                        gets requested. Greying them out would hide the reason. */}
                    <span className={cn("min-w-0 truncate text-slate-700", blocked && "text-slate-400 line-through decoration-rose-300")}>
                      {u.name}
                      {/* Two people share a display name in this directory;
                          without the address the picker cannot be used safely. */}
                      {u.email && <span className="ml-1.5 text-[11px] text-slate-400">{u.email}</span>}
                    </span>
                    <span className="ml-auto flex-shrink-0 text-[11px] text-slate-400">{u.role.replace(/_/g, " ")}</span>
                  </Button>
                );
              })}
            </Card>
            {coAuditorIds.length > 0 && library && (
              <Card className="mt-2 space-y-2 rounded-xl border border-primary-200 bg-primary-50/50 p-3 shadow-none">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-500">Assign {scopeAxisWords(library).many} to each auditor</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={autoDistribute}>Distribute evenly</Button>
                </div>
                {coAuditorIds.map((uid) => {
                  const u = directory.get(uid);
                  const mine = auditorDisc[uid] ?? [];
                  return (
                    <div key={uid} className="rounded-lg bg-white p-2">
                      {/* Same shape as the picker row above — name, address to
                          separate the two people who share a display name, role
                          on the right. `title` keeps the id reachable for
                          support without putting it on screen. */}
                      <div className="mb-1 flex items-baseline gap-1.5 text-[12px]">
                        <span className="min-w-0 flex-shrink-0 truncate font-medium text-slate-700" title={uid}>
                          {u?.name ?? "Unknown user"}
                        </span>
                        {u?.email && <span className="min-w-0 truncate text-[11px] text-slate-400">{u.email}</span>}
                        <span className="ml-auto flex-shrink-0 text-[11px] text-slate-400">
                          {u?.role ? `${u.role.replace(/_/g, " ")} · ` : ""}
                          {mine.length} {mine.length === 1 ? scopeAxisWords(library).one : scopeAxisWords(library).many}
                        </span>
                      </div>
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
              </Card>
            )}
          </Field>
          )}

          {!isVendor && (
          <Field label={`Auditees (failed checkpoints route to them) — ${auditeeIds.length} selected`}>
            <SlotHint
              loading={assignableLoading}
              count={auditeeCandidates.length}
              permission="AUDIT_COMPLIANCE.UPDATE"
              error={assignableError}
            />
            <PickerLegend state={auditeePreflight} noun="auditee" />
            <PickerSearch
              value={auditeeQuery}
              onChange={setAuditeeQuery}
              placeholder="Search auditees by name or email…"
              shown={auditeeCandidates.filter((u) => matchesQuery(u, auditeeQuery)).length}
              total={auditeeCandidates.length}
            />
            <Card className="max-h-28 overflow-y-auto rounded-md border border-slate-200 shadow-none">
              {auditeeCandidates.length === 0 && !assignableLoading && (
                <div className="p-3 text-xs text-slate-400">No authorised auditees at this plant.</div>
              )}
              {auditeeCandidates.length > 0
                && auditeeCandidates.filter((u) => matchesQuery(u, auditeeQuery)).length === 0 && (
                <div className="p-3 text-xs text-slate-400">
                  No auditee matches “{auditeeQuery}”.
                </div>
              )}
              {auditeeCandidates.filter((u) => matchesQuery(u, auditeeQuery)).map((u) => {
                const on = auditeeIds.includes(u.id);
                const v = auditeePreflight.verdicts[u.id];
                const blocked = !!v && v.blockingCount > 0 && !v.waived;
                return (
                  <Button key={u.id} type="button" variant="ghost" onClick={() => toggleAuditee(u.id)} className={cn("justify-start h-auto flex w-full items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-left text-sm last:border-0 hover:bg-slate-50", on && "bg-primary-50/60")}>
                    <span className={cn("flex size-4 items-center justify-center rounded border", on ? "border-primary-600 bg-primary-600 text-white" : "border-slate-300")}>{on && <Check size={11} />}</span>
                    <IndependenceDot verdict={v} pending={auditeePreflight.loading} />
                    <span className={cn("min-w-0 truncate text-slate-700", blocked && "text-slate-400 line-through decoration-rose-300")}>
                      {u.name}
                      {/* Two people share a display name in this directory;
                          without the address the picker cannot be used safely. */}
                      {u.email && <span className="ml-1.5 text-[11px] text-slate-400">{u.email}</span>}
                    </span>
                    <span className="ml-auto flex-shrink-0 text-[11px] text-slate-400">{u.role.replace(/_/g, " ")}</span>
                  </Button>
                );
              })}
            </Card>
          </Field>
          )}

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
            names={Object.fromEntries([...directory.values()].map((u) => [u.id, u.name]))}
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
              disabled={busy || isPending || independenceBlocked || cannotSchedule}
              title={
                independenceBlocked
                  ? "Resolve the auditor independence conflict above first."
                  : cannotSchedule
                    ? scheduleBlockReason ?? undefined
                    : undefined
              }
            >
              {isPending ? "Redirecting…" : busy ? "Scheduling…" : "Schedule audit"}
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

function PickerSearch({
  value, onChange, placeholder, shown, total,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  shown: number;
  total: number;
}) {
  // Only worth the row it costs once the list is long enough to scroll.
  if (total <= 6) return null;
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <div className="relative flex-1">
        <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-7 pl-7 text-xs"
        />
      </div>
      {value.trim() && (
        <>
          <span className="text-[11px] tabular-nums text-slate-500">{shown} of {total}</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onChange("")}>
            Clear
          </Button>
        </>
      )}
    </div>
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

/**
 * A repeatable list of external participants — name, email, disciplines.
 *
 * Rows rather than a comma-separated textarea, deliberately: each participant
 * carries a discipline scope and gets their own credential, so they are records
 * and not a string to be split. A textarea would also silently accept an address
 * that fails validation, and the whole point of this field is that a mistyped
 * address means one person never gets their link.
 *
 * Empty by default and with no blank first row: a supplier audit conducted only
 * by our own team needs none of these, and an empty row reads as an unfilled
 * required field.
 */
function EmailPartyField({
  label, hint, parties, onChange, disciplines, addLabel,
}: {
  label: string;
  hint: string;
  parties: ExternalParty[];
  onChange: (next: ExternalParty[]) => void;
  disciplines: { code: string; name: string }[];
  addLabel: string;
}) {
  function update(i: number, patch: Partial<ExternalParty>) {
    onChange(parties.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function toggleDisc(i: number, code: string) {
    const cur = parties[i].disciplineIds;
    update(i, { disciplineIds: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code] });
  }

  return (
    <Field label={`${label}${parties.length ? ` — ${parties.length}` : ""}`}>
      <p className="mb-1.5 text-[11px] leading-relaxed text-slate-500">{hint}</p>
      <div className="space-y-2">
        {parties.map((p, i) => {
          // Only flag a bad address once something has been typed — a row the
          // scheduler is still filling in is not an error yet.
          const bad = p.email.trim().length > 0 && !EMAIL_RE.test(p.email.trim());
          return (
            <Alert variant="warning" key={i} className="rounded-lg border border-amber-200 bg-white p-2">
              <div className="flex gap-2">
                <Input
                  value={p.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Name (optional)"
                  className="h-8 flex-1 text-xs"
                />
                <Input
                  type="email"
                  value={p.email}
                  onChange={(e) => update(i, { email: e.target.value })}
                  placeholder="name@company.com"
                  aria-invalid={bad}
                  className={cn("h-8 flex-[1.4] text-xs", bad && "border-rose-300")}
                />
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => onChange(parties.filter((_, idx) => idx !== i))}
                  title="Remove"
                  className="h-8 px-2 text-[11px]"
                >
                  Remove
                </Button>
              </div>
              {bad && <p className="mt-1 text-[11px] text-rose-600">This address can&apos;t receive a link.</p>}
              {disciplines.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Disciplines
                  </span>
                  {disciplines.map((d) => {
                    const on = p.disciplineIds.includes(d.code);
                    return (
                      <Button
                        key={d.code} type="button" variant="ghost" aria-pressed={on}
                        onClick={() => toggleDisc(i, d.code)}
                        className={cn(
                          "h-auto rounded-full border px-2 py-0.5 text-[11px] transition",
                          on ? "border-amber-500 bg-amber-500 text-white"
                             : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                        )}
                      >
                        {d.name}
                      </Button>
                    );
                  })}
                  {/* None ticked is not a mistake — it means the whole audit
                      scope, matching how an empty discipline list is read
                      everywhere else. Said plainly so nobody ticks all of them
                      thinking it is required. */}
                  {p.disciplineIds.length === 0 && (
                    <span className="text-[10px] text-slate-400">none ticked = all in scope</span>
                  )}
                </div>
              )}
            </Alert>
          );
        })}
      </div>
      <Button
        type="button" variant="outline" size="sm"
        onClick={() => onChange([...parties, { email: "", name: "", disciplineIds: [] }])}
        className="mt-2 h-7 px-2 text-[11px]"
      >
        + {addLabel}
      </Button>
    </Field>
  );
}
