-- CreateEnum
CREATE TYPE "ObservationType" AS ENUM ('SAFE_ACT', 'UNSAFE_ACT', 'SAFE_CONDITION', 'UNSAFE_CONDITION');

-- CreateEnum
CREATE TYPE "ObservationCategory" AS ENUM ('PPE', 'HOUSEKEEPING', 'WORK_AT_HEIGHT', 'HOT_WORK', 'MOBILE_EQUIPMENT', 'ELECTRICAL', 'MATERIAL_HANDLING', 'CONFINED_SPACE', 'CHEMICAL_HANDLING', 'EMERGENCY_PREP', 'OTHERS');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ObservationStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "NearMissStatus" AS ENUM ('REPORTED', 'UNDER_REVIEW', 'ACTION_ASSIGNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PermitType" AS ENUM ('HOT_WORK', 'CONFINED_SPACE', 'WORK_AT_HEIGHT', 'EXCAVATION', 'ELECTRICAL_LOTO', 'GENERAL_COLD');

-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ISSUER_APPROVED', 'SAFETY_APPROVED', 'PLANT_HEAD_APPROVED', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FLRAStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('FIRST_AID', 'MTC', 'RWC', 'LTI', 'FATALITY', 'PROPERTY_DAMAGE', 'ENVIRONMENTAL', 'FIRE', 'HIPO_NEAR_MISS');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'INVESTIGATION', 'CAPA_ASSIGNED', 'VERIFIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InspectionFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('SCHEDULED', 'DUE', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultLanding" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scopeType" TEXT,
    "scopeValue" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'OWN_PLANT',
    "conditions" JSONB,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'WORKER',
    "plantId" TEXT,
    "designation" TEXT,
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "observerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "plantId" TEXT NOT NULL,
    "areaId" TEXT,
    "type" "ObservationType" NOT NULL,
    "category" "ObservationCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "severity" "Severity" NOT NULL,
    "immediateAction" TEXT,
    "responsiblePersonId" TEXT,
    "targetDate" TIMESTAMP(3),
    "status" "ObservationStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closingRemark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationAttachment" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caption" TEXT,
    "exifData" JSONB,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ObservationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearMiss" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "plantId" TEXT NOT NULL,
    "areaId" TEXT,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "activity" TEXT,
    "immediateAction" TEXT,
    "potentialSeverity" "Severity" NOT NULL,
    "potentialConsequence" TEXT NOT NULL,
    "rootCauseCategory" TEXT,
    "rootCauseDetail" TEXT,
    "correctiveActions" TEXT,
    "actionOwnerId" TEXT,
    "targetDate" TIMESTAMP(3),
    "status" "NearMissStatus" NOT NULL DEFAULT 'REPORTED',
    "promotedToIncident" BOOLEAN NOT NULL DEFAULT false,
    "promotedIncidentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NearMiss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permit" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "PermitType" NOT NULL,
    "plantId" TEXT NOT NULL,
    "areaId" TEXT,
    "location" TEXT NOT NULL,
    "scopeOfWork" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "originatorId" TEXT NOT NULL,
    "issuerId" TEXT,
    "receiverId" TEXT,
    "contractorName" TEXT,
    "isolationsRequired" TEXT,
    "ppeChecklist" TEXT,
    "gasTestRequired" BOOLEAN NOT NULL DEFAULT false,
    "gasTestResult" TEXT,
    "o2Level" TEXT,
    "lelLevel" TEXT,
    "h2sLevel" TEXT,
    "fireWatchRequired" BOOLEAN NOT NULL DEFAULT false,
    "rescuePlan" TEXT,
    "issuerApprovedAt" TIMESTAMP(3),
    "safetyApprovedAt" TIMESTAMP(3),
    "plantHeadApprovedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "status" "PermitStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitCrewMember" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'WORKER',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermitCrewMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FLRA" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "permitId" TEXT,
    "plantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "hazards" TEXT NOT NULL,
    "toolboxTalkById" TEXT,
    "toolboxTalkConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" "FLRAStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "supersededReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FLRA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FLRATeamMember" (
    "id" TEXT NOT NULL,
    "flraId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FLRATeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FLRACrewSignature" (
    "id" TEXT NOT NULL,
    "flraId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signed" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    "trainingValidAtSignature" BOOLEAN NOT NULL DEFAULT true,
    "trainingExpiresAt" TIMESTAMP(3),

    CONSTRAINT "FLRACrewSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "IncidentType" NOT NULL,
    "plantId" TEXT NOT NULL,
    "areaId" TEXT,
    "location" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "injuredPersonName" TEXT,
    "injuredPersonAge" INTEGER,
    "injuredPersonDesignation" TEXT,
    "bodyPart" TEXT,
    "natureOfInjury" TEXT,
    "description" TEXT NOT NULL,
    "immediateCause" TEXT,
    "rootCauseMethod" TEXT,
    "rootCauseDetail" TEXT,
    "correctiveActions" TEXT,
    "preventiveActions" TEXT,
    "rootCauseData" JSONB,
    "rootCauseSummary" TEXT,
    "lostDays" INTEGER NOT NULL DEFAULT 0,
    "propertyDamageCost" DECIMAL(12,2),
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentInvestigationMember" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "IncidentInvestigationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentAttachment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "capaRef" TEXT,
    "witnessRef" TEXT,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caption" TEXT,
    "exifData" JSONB,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "IncidentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProgram" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "validityMonths" INTEGER NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "durationHours" INTEGER NOT NULL DEFAULT 4,
    "passingScore" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "trainerId" TEXT,
    "trainerName" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "durationHours" INTEGER NOT NULL,
    "score" INTEGER,
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "certificateUrl" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "frequency" "InspectionFrequency" NOT NULL,
    "checklistTemplate" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "inspectorId" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "result" TEXT,
    "checklistResult" TEXT,
    "observations" TEXT,
    "photoUrl" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manhours" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "employeeHours" INTEGER NOT NULL,
    "contractorHours" INTEGER NOT NULL,
    "fatalityCount" INTEGER NOT NULL DEFAULT 0,
    "ltiCount" INTEGER NOT NULL DEFAULT 0,
    "rwcCount" INTEGER NOT NULL DEFAULT 0,
    "mtcCount" INTEGER NOT NULL DEFAULT 0,
    "facCount" INTEGER NOT NULL DEFAULT 0,
    "lostDays" INTEGER NOT NULL DEFAULT 0,
    "ltifr" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "trir" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "severityRate" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manhours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "recordType" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stepType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "approverRole" TEXT,
    "approverField" TEXT,
    "approverUserId" TEXT,
    "approverGroupRoles" TEXT,
    "slaHours" INTEGER,
    "slaUnit" TEXT,
    "escalationRole" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "conditionExpr" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinitionVersion" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeNote" TEXT,

    CONSTRAINT "WorkflowDefinitionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "recordNumber" TEXT,
    "currentStepId" TEXT,
    "currentStepName" TEXT,
    "status" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowHistory" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepId" TEXT,
    "stepName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comments" TEXT,
    "attachments" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,

    CONSTRAINT "WorkflowHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTask" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "recordNumber" TEXT,
    "recordTitle" TEXT,
    "assignedToId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',

    CONSTRAINT "WorkflowTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_scopeType_scopeValue_key" ON "UserRole"("userId", "roleId", "scopeType", "scopeValue");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Plant_code_key" ON "Plant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Observation_number_key" ON "Observation"("number");

-- CreateIndex
CREATE INDEX "ObservationAttachment_observationId_category_idx" ON "ObservationAttachment"("observationId", "category");

-- CreateIndex
CREATE INDEX "ObservationAttachment_uploadedById_idx" ON "ObservationAttachment"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "NearMiss_number_key" ON "NearMiss"("number");

-- CreateIndex
CREATE UNIQUE INDEX "NearMiss_promotedIncidentId_key" ON "NearMiss"("promotedIncidentId");

-- CreateIndex
CREATE UNIQUE INDEX "Permit_number_key" ON "Permit"("number");

-- CreateIndex
CREATE INDEX "PermitCrewMember_userId_idx" ON "PermitCrewMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PermitCrewMember_permitId_userId_key" ON "PermitCrewMember"("permitId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FLRA_number_key" ON "FLRA"("number");

-- CreateIndex
CREATE INDEX "FLRA_permitId_status_idx" ON "FLRA"("permitId", "status");

-- CreateIndex
CREATE INDEX "FLRATeamMember_userId_idx" ON "FLRATeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FLRATeamMember_flraId_userId_key" ON "FLRATeamMember"("flraId", "userId");

-- CreateIndex
CREATE INDEX "FLRACrewSignature_userId_idx" ON "FLRACrewSignature"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FLRACrewSignature_flraId_userId_key" ON "FLRACrewSignature"("flraId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_number_key" ON "Incident"("number");

-- CreateIndex
CREATE INDEX "IncidentInvestigationMember_userId_idx" ON "IncidentInvestigationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentInvestigationMember_incidentId_userId_key" ON "IncidentInvestigationMember"("incidentId", "userId");

-- CreateIndex
CREATE INDEX "IncidentAttachment_incidentId_category_idx" ON "IncidentAttachment"("incidentId", "category");

-- CreateIndex
CREATE INDEX "IncidentAttachment_uploadedById_idx" ON "IncidentAttachment"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingProgram_code_key" ON "TrainingProgram"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_code_key" ON "Equipment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_number_key" ON "Inspection"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Manhours_plantId_year_month_key" ON "Manhours"("plantId", "year", "month");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_module_recordType_isActive_idx" ON "WorkflowDefinition"("module", "recordType", "isActive");

-- CreateIndex
CREATE INDEX "WorkflowStep_definitionId_sequence_idx" ON "WorkflowStep"("definitionId", "sequence");

-- CreateIndex
CREATE INDEX "WorkflowDefinitionVersion_definitionId_idx" ON "WorkflowDefinitionVersion"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinitionVersion_definitionId_version_key" ON "WorkflowDefinitionVersion"("definitionId", "version");

-- CreateIndex
CREATE INDEX "WorkflowInstance_status_idx" ON "WorkflowInstance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstance_module_recordId_key" ON "WorkflowInstance"("module", "recordId");

-- CreateIndex
CREATE INDEX "WorkflowHistory_instanceId_performedAt_idx" ON "WorkflowHistory"("instanceId", "performedAt");

-- CreateIndex
CREATE INDEX "WorkflowTask_assignedToId_status_idx" ON "WorkflowTask"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "WorkflowTask_module_recordId_idx" ON "WorkflowTask"("module", "recordId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationAttachment" ADD CONSTRAINT "ObservationAttachment_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationAttachment" ADD CONSTRAINT "ObservationAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_actionOwnerId_fkey" FOREIGN KEY ("actionOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_promotedIncidentId_fkey" FOREIGN KEY ("promotedIncidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_originatorId_fkey" FOREIGN KEY ("originatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitCrewMember" ADD CONSTRAINT "PermitCrewMember_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitCrewMember" ADD CONSTRAINT "PermitCrewMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRA" ADD CONSTRAINT "FLRA_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRA" ADD CONSTRAINT "FLRA_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRA" ADD CONSTRAINT "FLRA_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRA" ADD CONSTRAINT "FLRA_toolboxTalkById_fkey" FOREIGN KEY ("toolboxTalkById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRA" ADD CONSTRAINT "FLRA_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "FLRA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRATeamMember" ADD CONSTRAINT "FLRATeamMember_flraId_fkey" FOREIGN KEY ("flraId") REFERENCES "FLRA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRATeamMember" ADD CONSTRAINT "FLRATeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRACrewSignature" ADD CONSTRAINT "FLRACrewSignature_flraId_fkey" FOREIGN KEY ("flraId") REFERENCES "FLRA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FLRACrewSignature" ADD CONSTRAINT "FLRACrewSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentInvestigationMember" ADD CONSTRAINT "IncidentInvestigationMember_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentInvestigationMember" ADD CONSTRAINT "IncidentInvestigationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manhours" ADD CONSTRAINT "Manhours_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinitionVersion" ADD CONSTRAINT "WorkflowDefinitionVersion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinitionVersion" ADD CONSTRAINT "WorkflowDefinitionVersion_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowHistory" ADD CONSTRAINT "WorkflowHistory_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowHistory" ADD CONSTRAINT "WorkflowHistory_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
