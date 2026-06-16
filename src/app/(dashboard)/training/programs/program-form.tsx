"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  GraduationCap,
  Heart,
  Layers,
  Lock,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPicker } from "@/components/ui/user-picker";
import { readApiError } from "@/lib/client-errors";

// ─── Constants ────────────────────────────────────────────────────────

const CATEGORIES = [
  "INDUCTION",
  "TECHNICAL",
  "BEHAVIOURAL",
  "STATUTORY",
  "EMERGENCY",
  "LEADERSHIP",
  "COMPLIANCE",
  "REFRESHER",
] as const;

const TYPES = [
  "CLASSROOM",
  "E_LEARNING",
  "ON_JOB",
  "BLENDED",
  "CERTIFICATION",
  "WORKSHOP",
  "DRILL",
] as const;

const ASSESSMENT_TYPES = [
  "WRITTEN",
  "PRACTICAL",
  "ORAL",
  "PROJECT",
  "OBSERVATION",
] as const;

const QUESTION_TYPES = [
  "MCQ_SINGLE",
  "MCQ_MULTI",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "NUMERIC",
] as const;

const MATERIAL_TYPES = ["PDF", "VIDEO", "SLIDES", "IMAGE", "DOCUMENT", "LINK"] as const;

const LANGUAGES = ["English", "Hindi", "Bengali", "Khasi", "Tamil", "Telugu", "Marathi"];

const ROLE_CODES = [
  "WORKER",
  "CONTRACTOR_WORKMAN",
  "SUPERVISOR",
  "PERMIT_ISSUER",
  "SAFETY_OFFICER",
  "DEPARTMENT_HEAD",
  "MAINTENANCE_HEAD",
  "TRAINER",
  "LD_MANAGER",
  "HSE_MANAGER",
  "PLANT_HEAD",
];

const PERMIT_TYPES = [
  "HOT_WORK",
  "CONFINED_SPACE",
  "WORK_AT_HEIGHT",
  "EXCAVATION",
  "ELECTRICAL_LOTO",
  "GENERAL_COLD",
];

const TABS = [
  { id: 1, title: "Identity", icon: GraduationCap },
  { id: 2, title: "Statutory", icon: ShieldAlert },
  { id: 3, title: "Delivery", icon: Layers },
  { id: 4, title: "Prereqs", icon: ClipboardList },
  { id: 5, title: "Assessment", icon: Dumbbell },
  { id: 6, title: "Certification", icon: Sparkles },
  { id: 7, title: "Content", icon: ClipboardList },
  { id: 8, title: "Trainers", icon: UserCheck },
  { id: 9, title: "Evaluation", icon: Heart },
  { id: 10, title: "Gates", icon: Lock },
] as const;

// ─── Types ────────────────────────────────────────────────────────────

type Plant = { id: string; name: string };

type QuestionDraft = {
  sequence: number;
  questionText: string;
  questionType: (typeof QUESTION_TYPES)[number];
  options: { text: string; isCorrect: boolean }[];
  correctAnswer: string;
  marks: number;
  isCritical: boolean;
  explanation: string;
};

type MaterialDraft = {
  title: string;
  type: (typeof MATERIAL_TYPES)[number];
  fileUrl: string;
  externalUrl: string;
  language: string;
  isMandatory: boolean;
  sequence: number;
};

export type ProgramFormProps = {
  plants: Plant[];
  // For edit mode — pre-populated fields
  initial?: {
    id: string;
    programCode: string;
    programName: string;
    description: string;
    category: string;
    type: string;
    ownerId: string | null;
    plantId: string | null;
    isStatutory: boolean;
    statutoryReference: string;
    isMandatoryForRoles: string[];
    isMandatoryForActivities: string[];
    isMandatoryForPermitTypes: string[];
    durationHours: number;
    durationSessions: number;
    maxParticipantsPerBatch: number;
    language: string[];
    prerequisitePrograms: string[];
    prerequisiteRoles: string[];
    minimumExperienceMonths: number | null;
    medicalFitnessRequired: boolean;
    hasAssessment: boolean;
    assessmentType: string | null;
    passingScorePercent: number | null;
    practicalAssessmentRubric: string;
    attemptsAllowed: number;
    issuesCertificate: boolean;
    certificateTemplateUrl: string;
    certificateValidityMonths: number | null;
    certificateExpiryGracePeriodDays: number;
    refresherProgramCode: string;
    learningObjectives: string[];
    approvedTrainerIds: string[];
    externalTrainerAllowed: boolean;
    trainerQualifications: string;
    evaluatesEffectiveness: boolean;
    effectivenessReviewMonths: number;
    blocksPtwIfMissing: boolean;
    blocksRoleAssignmentIfMissing: boolean;
    blocksContractorOnboardingIfMissing: boolean;
  };
};

export function ProgramForm({ plants, initial }: ProgramFormProps) {
  const router = useRouter();
  const [tab, setTab] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!initial;

  // ─── Tab 1: Identity ───
  const [programCode, setProgramCode] = useState(initial?.programCode ?? "");
  const [programName, setProgramName] = useState(initial?.programName ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "TECHNICAL");
  const [type, setType] = useState(initial?.type ?? "CLASSROOM");
  const [ownerId, setOwnerId] = useState<string | null>(initial?.ownerId ?? null);
  const [plantId, setPlantId] = useState(initial?.plantId ?? "");

  // ─── Tab 2: Statutory ───
  const [isStatutory, setIsStatutory] = useState(initial?.isStatutory ?? false);
  const [statutoryReference, setStatutoryReference] = useState(initial?.statutoryReference ?? "");
  const [mandatoryRoles, setMandatoryRoles] = useState<string[]>(initial?.isMandatoryForRoles ?? []);
  const [mandatoryActivities, setMandatoryActivities] = useState<string[]>(initial?.isMandatoryForActivities ?? []);
  const [mandatoryPermitTypes, setMandatoryPermitTypes] = useState<string[]>(initial?.isMandatoryForPermitTypes ?? []);

  // ─── Tab 3: Delivery ───
  const [durationHours, setDurationHours] = useState(initial?.durationHours ?? 4);
  const [durationSessions, setDurationSessions] = useState(initial?.durationSessions ?? 1);
  const [maxParticipants, setMaxParticipants] = useState(initial?.maxParticipantsPerBatch ?? 20);
  const [language, setLanguage] = useState<string[]>(initial?.language ?? ["English", "Hindi"]);

  // ─── Tab 4: Prerequisites ───
  const [prereqPrograms, setPrereqPrograms] = useState<string[]>(initial?.prerequisitePrograms ?? []);
  const [prereqProgramInput, setPrereqProgramInput] = useState("");
  const [prereqRoles, setPrereqRoles] = useState<string[]>(initial?.prerequisiteRoles ?? []);
  const [minExperience, setMinExperience] = useState<string>(
    initial?.minimumExperienceMonths !== null && initial?.minimumExperienceMonths !== undefined
      ? String(initial.minimumExperienceMonths)
      : ""
  );
  const [medicalFitnessRequired, setMedicalFitnessRequired] = useState(initial?.medicalFitnessRequired ?? false);

  // ─── Tab 5: Assessment ───
  const [hasAssessment, setHasAssessment] = useState(initial?.hasAssessment ?? false);
  const [assessmentType, setAssessmentType] = useState(initial?.assessmentType ?? "WRITTEN");
  const [passingScorePercent, setPassingScorePercent] = useState(initial?.passingScorePercent ?? 70);
  const [practicalRubric, setPracticalRubric] = useState(initial?.practicalAssessmentRubric ?? "");
  const [attemptsAllowed, setAttemptsAllowed] = useState(initial?.attemptsAllowed ?? 3);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  // ─── Tab 6: Certification ───
  const [issuesCertificate, setIssuesCertificate] = useState(initial?.issuesCertificate ?? true);
  const [certTemplateUrl, setCertTemplateUrl] = useState(initial?.certificateTemplateUrl ?? "");
  const [certValidityMonths, setCertValidityMonths] = useState<string>(
    initial?.certificateValidityMonths !== null && initial?.certificateValidityMonths !== undefined
      ? String(initial.certificateValidityMonths)
      : "24"
  );
  const [gracePeriodDays, setGracePeriodDays] = useState(initial?.certificateExpiryGracePeriodDays ?? 30);
  const [refresherProgramCode, setRefresherProgramCode] = useState(initial?.refresherProgramCode ?? "");

  // ─── Tab 7: Content ───
  const [objectives, setObjectives] = useState<string[]>(initial?.learningObjectives ?? []);
  const [objectiveInput, setObjectiveInput] = useState("");
  const [materials, setMaterials] = useState<MaterialDraft[]>([]);

  // ─── Tab 8: Trainer Qualifications ───
  const [approvedTrainers, setApprovedTrainers] = useState<string[]>(initial?.approvedTrainerIds ?? []);
  const [externalTrainerAllowed, setExternalTrainerAllowed] = useState(initial?.externalTrainerAllowed ?? false);
  const [trainerQualifications, setTrainerQualifications] = useState(initial?.trainerQualifications ?? "");

  // ─── Tab 9: Evaluation ───
  const [evaluatesEffectiveness, setEvaluatesEffectiveness] = useState(initial?.evaluatesEffectiveness ?? true);
  const [effectivenessReviewMonths, setEffectivenessReviewMonths] = useState(initial?.effectivenessReviewMonths ?? 3);

  // ─── Tab 10: SafeOps Gates ───
  const [blocksPtw, setBlocksPtw] = useState(initial?.blocksPtwIfMissing ?? false);
  const [blocksRole, setBlocksRole] = useState(initial?.blocksRoleAssignmentIfMissing ?? false);
  const [blocksContractor, setBlocksContractor] = useState(initial?.blocksContractorOnboardingIfMissing ?? false);

  // ─── Validation ────────────────────────────────────────────────────

  function validateAll(): string | null {
    if (!programCode.trim()) return "Tab 1: Program code is required.";
    if (!programName.trim()) return "Tab 1: Program name is required.";
    if (!category) return "Tab 1: Category is required.";
    if (!type) return "Tab 1: Type is required.";
    if (durationHours <= 0) return "Tab 3: Duration hours must be greater than 0.";
    if (hasAssessment && !assessmentType)
      return "Tab 5: Pick an assessment type when assessment is enabled.";
    if (hasAssessment && passingScorePercent !== null && (passingScorePercent < 0 || passingScorePercent > 100))
      return "Tab 5: Passing score must be 0-100.";
    return null;
  }

  // ─── Submit ────────────────────────────────────────────────────────

  async function submit() {
    const err = validateAll();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    setError("");

    const payload = {
      programCode: programCode.trim(),
      programName: programName.trim(),
      description: description || null,
      category,
      type,
      ownerId,
      plantId: plantId || null,
      isStatutory,
      statutoryReference: statutoryReference || null,
      isMandatoryForRoles: mandatoryRoles,
      isMandatoryForActivities: mandatoryActivities,
      isMandatoryForPermitTypes: mandatoryPermitTypes,
      durationHours,
      durationSessions,
      maxParticipantsPerBatch: maxParticipants,
      language,
      prerequisitePrograms: prereqPrograms,
      prerequisiteRoles: prereqRoles,
      minimumExperienceMonths: minExperience ? parseInt(minExperience) : null,
      medicalFitnessRequired,
      hasAssessment,
      assessmentType: hasAssessment ? assessmentType : null,
      passingScorePercent: hasAssessment ? passingScorePercent : null,
      practicalAssessmentRubric: practicalRubric || null,
      attemptsAllowed,
      issuesCertificate,
      certificateTemplateUrl: certTemplateUrl || null,
      certificateValidityMonths: certValidityMonths ? parseInt(certValidityMonths) : null,
      certificateExpiryGracePeriodDays: gracePeriodDays,
      refresherProgramCode: refresherProgramCode || null,
      contentOutline: null,
      learningObjectives: objectives,
      approvedTrainerIds: approvedTrainers,
      externalTrainerAllowed,
      trainerQualifications: trainerQualifications || null,
      evaluatesEffectiveness,
      effectivenessReviewMonths,
      feedbackQuestionnaireId: null,
      blocksPtwIfMissing: blocksPtw,
      blocksRoleAssignmentIfMissing: blocksRole,
      blocksContractorOnboardingIfMissing: blocksContractor,
      questions: hasAssessment
        ? questions.map((q) => ({
            sequence: q.sequence,
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options,
            correctAnswer: q.correctAnswer || null,
            marks: q.marks,
            isCritical: q.isCritical,
            explanation: q.explanation || null,
          }))
        : [],
      materials: materials.map((m) => ({
        title: m.title,
        type: m.type,
        fileUrl: m.fileUrl || null,
        externalUrl: m.externalUrl || null,
        language: m.language || null,
        isMandatory: m.isMandatory,
        sequence: m.sequence,
      })),
    };

    try {
      const url = isEdit ? `/api/training/programs/${initial!.id}` : "/api/training/programs";
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const j = await r.json();
        router.push(`/training/programs/${isEdit ? initial!.id : j.id}`);
        router.refresh();
        return;
      }
      setError(await readApiError(r, "Failed to save program"));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-24">
      <TabIndicator current={tab} setTab={setTab} />

      {tab === 1 && (
        <Tab1Identity
          plants={plants}
          programCode={programCode}
          setProgramCode={setProgramCode}
          isEdit={isEdit}
          programName={programName}
          setProgramName={setProgramName}
          description={description}
          setDescription={setDescription}
          category={category}
          setCategory={setCategory}
          type={type}
          setType={setType}
          ownerId={ownerId}
          setOwnerId={setOwnerId}
          plantId={plantId}
          setPlantId={setPlantId}
        />
      )}

      {tab === 2 && (
        <Tab2Statutory
          isStatutory={isStatutory}
          setIsStatutory={setIsStatutory}
          statutoryReference={statutoryReference}
          setStatutoryReference={setStatutoryReference}
          mandatoryRoles={mandatoryRoles}
          setMandatoryRoles={setMandatoryRoles}
          mandatoryActivities={mandatoryActivities}
          setMandatoryActivities={setMandatoryActivities}
          mandatoryPermitTypes={mandatoryPermitTypes}
          setMandatoryPermitTypes={setMandatoryPermitTypes}
        />
      )}

      {tab === 3 && (
        <Tab3Delivery
          durationHours={durationHours}
          setDurationHours={setDurationHours}
          durationSessions={durationSessions}
          setDurationSessions={setDurationSessions}
          maxParticipants={maxParticipants}
          setMaxParticipants={setMaxParticipants}
          language={language}
          setLanguage={setLanguage}
        />
      )}

      {tab === 4 && (
        <Tab4Prereqs
          prereqPrograms={prereqPrograms}
          setPrereqPrograms={setPrereqPrograms}
          prereqProgramInput={prereqProgramInput}
          setPrereqProgramInput={setPrereqProgramInput}
          prereqRoles={prereqRoles}
          setPrereqRoles={setPrereqRoles}
          minExperience={minExperience}
          setMinExperience={setMinExperience}
          medicalFitnessRequired={medicalFitnessRequired}
          setMedicalFitnessRequired={setMedicalFitnessRequired}
        />
      )}

      {tab === 5 && (
        <Tab5Assessment
          hasAssessment={hasAssessment}
          setHasAssessment={setHasAssessment}
          assessmentType={assessmentType}
          setAssessmentType={setAssessmentType}
          passingScorePercent={passingScorePercent}
          setPassingScorePercent={setPassingScorePercent}
          practicalRubric={practicalRubric}
          setPracticalRubric={setPracticalRubric}
          attemptsAllowed={attemptsAllowed}
          setAttemptsAllowed={setAttemptsAllowed}
          questions={questions}
          setQuestions={setQuestions}
        />
      )}

      {tab === 6 && (
        <Tab6Certification
          issuesCertificate={issuesCertificate}
          setIssuesCertificate={setIssuesCertificate}
          certTemplateUrl={certTemplateUrl}
          setCertTemplateUrl={setCertTemplateUrl}
          certValidityMonths={certValidityMonths}
          setCertValidityMonths={setCertValidityMonths}
          gracePeriodDays={gracePeriodDays}
          setGracePeriodDays={setGracePeriodDays}
          refresherProgramCode={refresherProgramCode}
          setRefresherProgramCode={setRefresherProgramCode}
        />
      )}

      {tab === 7 && (
        <Tab7Content
          objectives={objectives}
          setObjectives={setObjectives}
          objectiveInput={objectiveInput}
          setObjectiveInput={setObjectiveInput}
          materials={materials}
          setMaterials={setMaterials}
        />
      )}

      {tab === 8 && (
        <Tab8Trainers
          approvedTrainers={approvedTrainers}
          setApprovedTrainers={setApprovedTrainers}
          externalTrainerAllowed={externalTrainerAllowed}
          setExternalTrainerAllowed={setExternalTrainerAllowed}
          trainerQualifications={trainerQualifications}
          setTrainerQualifications={setTrainerQualifications}
        />
      )}

      {tab === 9 && (
        <Tab9Evaluation
          evaluatesEffectiveness={evaluatesEffectiveness}
          setEvaluatesEffectiveness={setEvaluatesEffectiveness}
          effectivenessReviewMonths={effectivenessReviewMonths}
          setEffectivenessReviewMonths={setEffectivenessReviewMonths}
        />
      )}

      {tab === 10 && (
        <Tab10Gates
          blocksPtw={blocksPtw}
          setBlocksPtw={setBlocksPtw}
          blocksRole={blocksRole}
          setBlocksRole={setBlocksRole}
          blocksContractor={blocksContractor}
          setBlocksContractor={setBlocksContractor}
        />
      )}

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">
          {error}
        </div>
      )}

      {/* Sticky bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/95 backdrop-blur p-3 z-30 shadow-lg sm:left-64">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => (tab === 1 ? router.back() : setTab((t) => t - 1))}
            disabled={submitting}
          >
            <ChevronLeft size={16} /> {tab === 1 ? "Cancel" : "Back"}
          </Button>
          <div className="text-xs text-slate-500 hidden sm:block">
            Step {tab} of {TABS.length}
          </div>
          {tab < TABS.length ? (
            <Button onClick={() => setTab((t) => t + 1)} disabled={submitting}>
              Next <ChevronRight size={16} />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? (
                "Saving…"
              ) : (
                <>
                  <Send size={16} /> {isEdit ? "Save Changes" : "Save as Draft"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab indicator strip ─────────────────────────────────────────────

function TabIndicator({ current, setTab }: { current: number; setTab: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = current === t.id;
        const isDone = current > t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap shrink-0",
              isActive
                ? "bg-primary-600 text-white border-primary-600"
                : isDone
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-50 text-slate-600 border-slate-200",
            ].join(" ")}
          >
            {isDone ? <CheckCircle2 size={12} /> : <Icon size={12} />}
            <span className="hidden sm:inline">{t.title}</span>
            <span className="sm:hidden">{t.id}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Tab 1: Identity ─────────────────────────────────────────────────

function Tab1Identity(props: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap size={16} /> Identity
        </CardTitle>
        <CardDescription className="text-xs">
          Unique program code + display name + ownership.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Program Code *</Label>
            <Input
              value={props.programCode}
              onChange={(e) => props.setProgramCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
              placeholder="e.g. PTW_HOT_WORK_HOLDER"
              disabled={props.isEdit}
              className="font-mono"
            />
            {props.isEdit && (
              <p className="text-[11px] text-slate-500">
                Code is permanent — locked after creation.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Program Name *</Label>
            <Input
              value={props.programName}
              onChange={(e) => props.setProgramName(e.target.value)}
              placeholder="e.g. Hot Work Permit Holder"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea
            rows={3}
            value={props.description}
            onChange={(e) => props.setDescription(e.target.value)}
            placeholder="Short description of what this program covers and who needs it"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Category *</Label>
            <Select value={props.category} onChange={(e) => props.setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type *</Label>
            <Select value={props.type} onChange={(e) => props.setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Owner</Label>
            <UserPicker
              value={props.ownerId}
              onChange={(id) => props.setOwnerId(id)}
              filter={{ role: ["LD_MANAGER", "HSE_MANAGER", "ADMIN"] }}
              placeholder="L&D Manager / HSE Manager"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Plant Scope</Label>
            <Select value={props.plantId} onChange={(e) => props.setPlantId(e.target.value)}>
              <option value="">— All plants (cross-plant program) —</option>
              {props.plants.map((p: Plant) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab 2: Statutory ────────────────────────────────────────────────

function Tab2Statutory(props: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert size={16} /> Statutory & Regulatory
        </CardTitle>
        <CardDescription className="text-xs">
          Mark statutory programs and link them to roles, activities, or permit types.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-start gap-2 p-2 rounded-md border border-rose-200 bg-rose-50/50 cursor-pointer">
          <input
            type="checkbox"
            checked={props.isStatutory}
            onChange={(e) => props.setIsStatutory(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="text-xs font-medium text-rose-900">This is a statutory training program</div>
            <div className="text-[11px] text-rose-700">
              Tracked in the statutory compliance register; visible to inspectors.
            </div>
          </div>
        </label>

        {props.isStatutory && (
          <div className="space-y-1.5">
            <Label className="text-xs">Statutory Reference</Label>
            <Input
              value={props.statutoryReference}
              onChange={(e) => props.setStatutoryReference(e.target.value)}
              placeholder="e.g. Factories Act 1948 Section 7A"
            />
          </div>
        )}

        <ChipMultiSelect
          label="Mandatory For Roles"
          help="Users with these roles must hold this training to perform their duties"
          options={ROLE_CODES}
          value={props.mandatoryRoles}
          onChange={props.setMandatoryRoles}
        />

        <ChipMultiSelect
          label="Mandatory For Permit Types"
          help="Workers without this training cannot be added as crew on these permit types"
          options={PERMIT_TYPES}
          value={props.mandatoryPermitTypes}
          onChange={props.setMandatoryPermitTypes}
        />

        <FreeChips
          label="Mandatory For Activities"
          help="Activity codes from masters (e.g. RIGGING, GAS_TESTING). Comma or Enter to add."
          value={props.mandatoryActivities}
          onChange={props.setMandatoryActivities}
        />
      </CardContent>
    </Card>
  );
}

// ─── Tab 3: Delivery ─────────────────────────────────────────────────

function Tab3Delivery(props: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers size={16} /> Delivery Format
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Duration (hours) *</Label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              value={props.durationHours}
              onChange={(e) => props.setDurationHours(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sessions</Label>
            <Input
              type="number"
              min="1"
              value={props.durationSessions}
              onChange={(e) => props.setDurationSessions(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max participants per batch</Label>
            <Input
              type="number"
              min="1"
              value={props.maxParticipants}
              onChange={(e) => props.setMaxParticipants(parseInt(e.target.value) || 20)}
            />
          </div>
        </div>
        <ChipMultiSelect
          label="Languages"
          help="Languages this program is delivered in"
          options={LANGUAGES}
          value={props.language}
          onChange={props.setLanguage}
        />
      </CardContent>
    </Card>
  );
}

// ─── Tab 4: Prerequisites ────────────────────────────────────────────

function Tab4Prereqs(props: any) {
  function addPrereqProgram() {
    const v = props.prereqProgramInput.trim().toUpperCase();
    if (!v || props.prereqPrograms.includes(v)) return;
    props.setPrereqPrograms([...props.prereqPrograms, v]);
    props.setPrereqProgramInput("");
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList size={16} /> Prerequisites
        </CardTitle>
        <CardDescription className="text-xs">
          Workers must complete these prerequisites before they can register.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Prerequisite Program Codes</Label>
          <div className="flex gap-2">
            <Input
              value={props.prereqProgramInput}
              onChange={(e) => props.setPrereqProgramInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPrereqProgram();
                }
              }}
              placeholder="e.g. INDUCTION_GENERAL"
              className="font-mono"
            />
            <Button size="sm" variant="outline" onClick={addPrereqProgram}>
              Add
            </Button>
          </div>
          <ChipsList
            items={props.prereqPrograms}
            onRemove={(item) =>
              props.setPrereqPrograms(props.prereqPrograms.filter((i: string) => i !== item))
            }
          />
        </div>

        <ChipMultiSelect
          label="Prerequisite Roles"
          help="User must hold one of these roles before registering"
          options={ROLE_CODES}
          value={props.prereqRoles}
          onChange={props.setPrereqRoles}
        />

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Minimum Experience (months)</Label>
            <Input
              type="number"
              min="0"
              value={props.minExperience}
              onChange={(e) => props.setMinExperience(e.target.value)}
              placeholder="e.g. 6"
            />
          </div>
          <div className="space-y-1.5 flex items-end">
            <label className="flex items-start gap-2 p-2 rounded-md border border-slate-200 bg-white text-xs w-full cursor-pointer">
              <input
                type="checkbox"
                checked={props.medicalFitnessRequired}
                onChange={(e) => props.setMedicalFitnessRequired(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium">Medical fitness required</div>
                <div className="text-slate-600">User must have a current medical fitness certificate.</div>
              </div>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab 5: Assessment ───────────────────────────────────────────────

function Tab5Assessment(props: any) {
  function addQuestion() {
    props.setQuestions([
      ...props.questions,
      {
        sequence: props.questions.length + 1,
        questionText: "",
        questionType: "MCQ_SINGLE",
        options: [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ],
        correctAnswer: "",
        marks: 1,
        isCritical: false,
        explanation: "",
      },
    ]);
  }
  function removeQuestion(idx: number) {
    props.setQuestions(props.questions.filter((_: QuestionDraft, i: number) => i !== idx));
  }
  function updateQuestion(idx: number, patch: Partial<QuestionDraft>) {
    props.setQuestions(
      props.questions.map((q: QuestionDraft, i: number) => (i === idx ? { ...q, ...patch } : q))
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Dumbbell size={16} /> Assessment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-start gap-2 p-2 rounded-md border border-slate-200 bg-white cursor-pointer">
          <input
            type="checkbox"
            checked={props.hasAssessment}
            onChange={(e) => props.setHasAssessment(e.target.checked)}
            className="mt-0.5"
          />
          <div className="text-xs">
            <div className="font-medium">This program has an assessment</div>
            <div className="text-slate-600">
              Workers must pass the assessment to receive a certificate.
            </div>
          </div>
        </label>

        {props.hasAssessment && (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Assessment Type</Label>
                <Select
                  value={props.assessmentType}
                  onChange={(e) => props.setAssessmentType(e.target.value)}
                >
                  {ASSESSMENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Passing Score (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={props.passingScorePercent ?? ""}
                  onChange={(e) => props.setPassingScorePercent(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Attempts allowed</Label>
                <Input
                  type="number"
                  min="1"
                  value={props.attemptsAllowed}
                  onChange={(e) => props.setAttemptsAllowed(parseInt(e.target.value) || 3)}
                />
              </div>
            </div>

            {props.assessmentType === "PRACTICAL" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Practical Assessment Rubric</Label>
                <Textarea
                  rows={4}
                  value={props.practicalRubric}
                  onChange={(e) => props.setPracticalRubric(e.target.value)}
                  placeholder="Criteria the assessor will score against (one per line)"
                />
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Question Bank</div>
                  <div className="text-xs text-slate-500">
                    {props.questions.length} question{props.questions.length === 1 ? "" : "s"}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={addQuestion}>
                  <Plus size={14} /> Add Question
                </Button>
              </div>

              {props.questions.map((q: QuestionDraft, idx: number) => (
                <div
                  key={idx}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700">Question {idx + 1}</div>
                    <button
                      onClick={() => removeQuestion(idx)}
                      className="text-rose-600 hover:text-rose-800"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <Textarea
                    rows={2}
                    value={q.questionText}
                    onChange={(e) => updateQuestion(idx, { questionText: e.target.value })}
                    placeholder="Question text"
                  />
                  <div className="grid sm:grid-cols-3 gap-2">
                    <Select
                      value={q.questionType}
                      onChange={(e) =>
                        updateQuestion(idx, {
                          questionType: e.target.value as QuestionDraft["questionType"],
                        })
                      }
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      value={q.marks}
                      onChange={(e) => updateQuestion(idx, { marks: parseInt(e.target.value) || 1 })}
                      placeholder="Marks"
                    />
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={q.isCritical}
                        onChange={(e) => updateQuestion(idx, { isCritical: e.target.checked })}
                      />
                      <span>Critical (must answer correctly)</span>
                    </label>
                  </div>
                  {(q.questionType === "MCQ_SINGLE" || q.questionType === "MCQ_MULTI") && (
                    <div className="space-y-1">
                      <Label className="text-[11px]">Options</Label>
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={opt.isCorrect}
                            onChange={(e) => {
                              const next = [...q.options];
                              next[oIdx] = { ...next[oIdx], isCorrect: e.target.checked };
                              updateQuestion(idx, { options: next });
                            }}
                          />
                          <Input
                            value={opt.text}
                            onChange={(e) => {
                              const next = [...q.options];
                              next[oIdx] = { ...next[oIdx], text: e.target.value };
                              updateQuestion(idx, { options: next });
                            }}
                            placeholder={`Option ${oIdx + 1}`}
                          />
                          {q.options.length > 2 && (
                            <button
                              onClick={() =>
                                updateQuestion(idx, {
                                  options: q.options.filter((_, i) => i !== oIdx),
                                })
                              }
                              className="text-rose-600"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateQuestion(idx, {
                            options: [...q.options, { text: "", isCorrect: false }],
                          })
                        }
                      >
                        + Option
                      </Button>
                    </div>
                  )}
                  {(q.questionType === "SHORT_ANSWER" || q.questionType === "NUMERIC" || q.questionType === "TRUE_FALSE") && (
                    <Input
                      value={q.correctAnswer}
                      onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })}
                      placeholder={
                        q.questionType === "TRUE_FALSE" ? "true / false" : "Correct answer"
                      }
                    />
                  )}
                  <Textarea
                    rows={1}
                    value={q.explanation}
                    onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                    placeholder="Explanation (shown to learner after assessment)"
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab 6: Certification ────────────────────────────────────────────

function Tab6Certification(props: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles size={16} /> Certification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-start gap-2 p-2 rounded-md border border-slate-200 bg-white cursor-pointer">
          <input
            type="checkbox"
            checked={props.issuesCertificate}
            onChange={(e) => props.setIssuesCertificate(e.target.checked)}
            className="mt-0.5"
          />
          <div className="text-xs">
            <div className="font-medium">Issues certificate</div>
            <div className="text-slate-600">
              Generates a verifiable PDF certificate with QR on successful completion.
            </div>
          </div>
        </label>

        {props.issuesCertificate && (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Validity (months)</Label>
                <Input
                  type="number"
                  min="1"
                  value={props.certValidityMonths}
                  onChange={(e) => props.setCertValidityMonths(e.target.value)}
                  placeholder="24 — leave blank for lifetime"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expiry grace period (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={props.gracePeriodDays}
                  onChange={(e) => props.setGracePeriodDays(parseInt(e.target.value) || 30)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Certificate Template URL</Label>
              <Input
                value={props.certTemplateUrl}
                onChange={(e) => props.setCertTemplateUrl(e.target.value)}
                placeholder="https://… (PDF template with merge fields)"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Refresher Program Code</Label>
              <Input
                value={props.refresherProgramCode}
                onChange={(e) => props.setRefresherProgramCode(e.target.value.toUpperCase())}
                placeholder="e.g. PTW_HOT_WORK_REFRESHER"
                className="font-mono"
              />
              <p className="text-[11px] text-slate-500">
                Auto-registers learners for this refresher when their certificate enters
                EXPIRING_SOON state.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab 7: Content ──────────────────────────────────────────────────

function Tab7Content(props: any) {
  function addObjective() {
    const v = props.objectiveInput.trim();
    if (!v) return;
    props.setObjectives([...props.objectives, v]);
    props.setObjectiveInput("");
  }
  function addMaterial() {
    props.setMaterials([
      ...props.materials,
      {
        title: "",
        type: "PDF",
        fileUrl: "",
        externalUrl: "",
        language: "English",
        isMandatory: true,
        sequence: props.materials.length + 1,
      },
    ]);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Content</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Learning Objectives</Label>
          <div className="flex gap-2">
            <Input
              value={props.objectiveInput}
              onChange={(e) => props.setObjectiveInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addObjective();
                }
              }}
              placeholder="e.g. Identify hot work hazards in cement plant operations"
            />
            <Button size="sm" variant="outline" onClick={addObjective}>
              Add
            </Button>
          </div>
          <ChipsList
            items={props.objectives}
            onRemove={(item) =>
              props.setObjectives(props.objectives.filter((i: string) => i !== item))
            }
          />
        </div>

        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Training Materials</div>
            <Button size="sm" variant="outline" onClick={addMaterial}>
              <Plus size={14} /> Add Material
            </Button>
          </div>
          {props.materials.map((m: MaterialDraft, idx: number) => (
            <div
              key={idx}
              className="rounded-md border border-slate-200 bg-slate-50 p-2 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-700">
                  Material {idx + 1}
                </div>
                <button
                  onClick={() =>
                    props.setMaterials(
                      props.materials.filter((_: MaterialDraft, i: number) => i !== idx)
                    )
                  }
                  className="text-rose-600"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <Input
                value={m.title}
                onChange={(e) => {
                  const next = [...props.materials];
                  next[idx] = { ...next[idx], title: e.target.value };
                  props.setMaterials(next);
                }}
                placeholder="Material title"
              />
              <div className="grid sm:grid-cols-3 gap-2">
                <Select
                  value={m.type}
                  onChange={(e) => {
                    const next = [...props.materials];
                    next[idx] = {
                      ...next[idx],
                      type: e.target.value as MaterialDraft["type"],
                    };
                    props.setMaterials(next);
                  }}
                >
                  {MATERIAL_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
                <Select
                  value={m.language}
                  onChange={(e) => {
                    const next = [...props.materials];
                    next[idx] = { ...next[idx], language: e.target.value };
                    props.setMaterials(next);
                  }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={m.isMandatory}
                    onChange={(e) => {
                      const next = [...props.materials];
                      next[idx] = { ...next[idx], isMandatory: e.target.checked };
                      props.setMaterials(next);
                    }}
                  />
                  Mandatory
                </label>
              </div>
              <Input
                value={m.type === "LINK" ? m.externalUrl : m.fileUrl}
                onChange={(e) => {
                  const next = [...props.materials];
                  next[idx] =
                    m.type === "LINK"
                      ? { ...next[idx], externalUrl: e.target.value }
                      : { ...next[idx], fileUrl: e.target.value };
                  props.setMaterials(next);
                }}
                placeholder={m.type === "LINK" ? "External URL" : "File URL"}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab 8: Trainers ─────────────────────────────────────────────────

function Tab8Trainers(props: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserCheck size={16} /> Trainer Qualifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Approved Trainers</Label>
          <UserPicker
            multiple
            value={props.approvedTrainers}
            onChange={(ids) => props.setApprovedTrainers(ids)}
            filter={{ role: ["TRAINER", "LD_MANAGER", "HSE_MANAGER", "SAFETY_OFFICER"] }}
            placeholder="Pick trainers qualified to deliver this program"
          />
          <p className="text-[11px] text-slate-500">
            Only these users can deliver this program (unless external trainer allowed).
          </p>
        </div>
        <label className="flex items-start gap-2 p-2 rounded-md border border-slate-200 bg-white cursor-pointer">
          <input
            type="checkbox"
            checked={props.externalTrainerAllowed}
            onChange={(e) => props.setExternalTrainerAllowed(e.target.checked)}
            className="mt-0.5"
          />
          <div className="text-xs">
            <div className="font-medium">External trainers allowed</div>
            <div className="text-slate-600">Vendor / consultant trainers can deliver this program.</div>
          </div>
        </label>
        <div className="space-y-1.5">
          <Label className="text-xs">Trainer Qualifications</Label>
          <Textarea
            rows={3}
            value={props.trainerQualifications}
            onChange={(e) => props.setTrainerQualifications(e.target.value)}
            placeholder="What makes someone qualified to deliver this program?"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab 9: Evaluation ───────────────────────────────────────────────

function Tab9Evaluation(props: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Heart size={16} /> Evaluation & Effectiveness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-start gap-2 p-2 rounded-md border border-slate-200 bg-white cursor-pointer">
          <input
            type="checkbox"
            checked={props.evaluatesEffectiveness}
            onChange={(e) => props.setEvaluatesEffectiveness(e.target.checked)}
            className="mt-0.5"
          />
          <div className="text-xs">
            <div className="font-medium">Evaluates effectiveness post-training</div>
            <div className="text-slate-600">
              Schedules an effectiveness review N months after certificate issue.
            </div>
          </div>
        </label>
        {props.evaluatesEffectiveness && (
          <div className="space-y-1.5">
            <Label className="text-xs">Effectiveness Review After (months)</Label>
            <Input
              type="number"
              min="1"
              max="24"
              value={props.effectivenessReviewMonths}
              onChange={(e) => props.setEffectivenessReviewMonths(parseInt(e.target.value) || 3)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab 10: SafeOps Gates ───────────────────────────────────────────

function Tab10Gates(props: any) {
  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-amber-900">
          <Lock size={16} /> SafeOps Gates
        </CardTitle>
        <CardDescription className="text-xs">
          Toggle which downstream operations are blocked when a worker doesn't hold this training.
          These flags are the heart of the platform's competency model.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <GateToggle
          label="Block PTW crew assignment"
          help="Workers without a current certificate cannot be added as crew on permits where this program is mandatory."
          checked={props.blocksPtw}
          onChange={props.setBlocksPtw}
        />
        <GateToggle
          label="Block role assignment"
          help="Users cannot be assigned roles where this program is a prerequisite without a current certificate."
          checked={props.blocksRole}
          onChange={props.setBlocksRole}
        />
        <GateToggle
          label="Block contractor onboarding"
          help="Contractor workmen cannot be issued a gate pass without a current certificate."
          checked={props.blocksContractor}
          onChange={props.setBlocksContractor}
        />

        {(props.blocksPtw || props.blocksRole || props.blocksContractor) && (
          <div className="text-xs rounded-md border border-amber-200 bg-amber-50 p-2 mt-2">
            <strong>Heads-up:</strong> enabling SafeOps gates on this program means failure to
            complete it will block real operations. Make sure scheduling capacity exists before
            enabling.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GateToggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label
      className={[
        "flex items-start gap-2 p-3 rounded-md border cursor-pointer",
        checked ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <div className="text-xs">
        <div className="font-medium">{label}</div>
        <div className="text-slate-600 mt-0.5">{help}</div>
      </div>
    </label>
  );
}

// ─── Helpers: chip multi-select + free chips + chip list ─────────────

function ChipMultiSelect({
  label,
  help,
  options,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {help && <p className="text-[11px] text-slate-500">{help}</p>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() =>
                onChange(active ? value.filter((v) => v !== o) : [...value, o])
              }
              className={[
                "px-2 py-1 text-[11px] rounded-full border",
                active
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
              ].join(" ")}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FreeChips({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  function add() {
    const v = input.trim();
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setInput("");
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {help && <p className="text-[11px] text-slate-500">{help}</p>}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Type and press Enter"
        />
        <Button size="sm" variant="outline" onClick={add}>
          Add
        </Button>
      </div>
      <ChipsList items={value} onRemove={(item) => onChange(value.filter((i) => i !== item))} />
    </div>
  );
}

function ChipsList({ items, onRemove }: { items: string[]; onRemove: (i: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Badge
          key={i}
          className="bg-primary-50 text-primary-700 border-primary-200 cursor-pointer"
          onClick={() => onRemove(i)}
        >
          {i} ×
        </Badge>
      ))}
    </div>
  );
}
