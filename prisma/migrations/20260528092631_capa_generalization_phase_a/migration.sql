-- CreateTable
CREATE TABLE "CapaSourceCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prefix" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapaSourceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaSourceType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "parentModuleLive" BOOLEAN NOT NULL DEFAULT false,
    "parentModuleName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapaSourceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaSubCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "applicableSourceTypeIds" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapaSubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaSlaProfile" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sourceTypeCode" TEXT,
    "severity" TEXT,
    "initialResponseHours" INTEGER NOT NULL,
    "rcaDueDays" INTEGER NOT NULL,
    "actionsPlannedDueDays" INTEGER NOT NULL,
    "closureTargetDays" INTEGER NOT NULL,
    "recurrenceCheckDays" INTEGER NOT NULL DEFAULT 90,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapaSlaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaVerificationMethod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapaVerificationMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capa" (
    "id" TEXT NOT NULL,
    "capaNumber" TEXT NOT NULL,
    "aliasNumber" TEXT,
    "legacySource" TEXT,
    "legacyId" TEXT,
    "title" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "sourceCategoryId" TEXT NOT NULL,
    "sourceTypeId" TEXT NOT NULL,
    "sourceTypeCode" TEXT NOT NULL,
    "sourceReferenceId" TEXT,
    "sourceReferenceUrl" TEXT,
    "sourceReferenceSummary" TEXT,
    "sourceMetadata" JSONB,
    "problemDescription" TEXT NOT NULL,
    "problemImpact" TEXT,
    "detectionMethod" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "detectedByUserId" TEXT,
    "affectedAreas" JSONB,
    "affectedDepartments" JSONB,
    "affectedProducts" JSONB,
    "affectedProcesses" JSONB,
    "affectedCustomers" JSONB,
    "primaryCategory" TEXT NOT NULL,
    "subCategoryId" TEXT,
    "actionType" TEXT NOT NULL DEFAULT 'CORRECTIVE_AND_PREVENTIVE',
    "severity" TEXT NOT NULL DEFAULT 'MODERATE',
    "priority" TEXT NOT NULL DEFAULT 'MODERATE',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "relatedCapaIds" JSONB,
    "rcaMethodology" TEXT,
    "rcaMethodologyRationale" TEXT,
    "rcaCompleted" BOOLEAN NOT NULL DEFAULT false,
    "rcaRecordId" TEXT,
    "rcaSummary" TEXT,
    "contributingFactors" JSONB,
    "rcaCompletedAt" TIMESTAMP(3),
    "rcaCompletedByUserId" TEXT,
    "verificationMethodId" TEXT,
    "verificationSuccessCriteria" TEXT,
    "measurementPeriodDays" INTEGER NOT NULL DEFAULT 30,
    "verificationDueDate" TIMESTAMP(3),
    "verificationCompletedAt" TIMESTAMP(3),
    "verificationCompletedByUserId" TEXT,
    "verificationResult" TEXT,
    "verificationEvidence" TEXT,
    "recurrenceCheckDueDate" TIMESTAMP(3),
    "recurrenceCheckCompletedAt" TIMESTAMP(3),
    "recurrenceDetected" BOOLEAN,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "stateChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stateChangedByUserId" TEXT,
    "rcaDueDate" TIMESTAMP(3),
    "correctiveActionDueDate" TIMESTAMP(3),
    "preventiveActionDueDate" TIMESTAMP(3),
    "closureTargetDate" TIMESTAMP(3),
    "slaBreaches" JSONB,
    "raisedByUserId" TEXT NOT NULL,
    "raisedByRole" TEXT,
    "primaryOwnerUserId" TEXT NOT NULL,
    "primaryOwnerRole" TEXT,
    "departmentOwnerId" TEXT,
    "estimatedProblemCost" DOUBLE PRECISION,
    "estimatedProblemCurrency" TEXT DEFAULT 'INR',
    "estimatedActionsCost" DOUBLE PRECISION,
    "estimatedActionsCurrency" TEXT DEFAULT 'INR',
    "actualCost" DOUBLE PRECISION,
    "actualCostCurrency" TEXT DEFAULT 'INR',
    "costCategories" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "closedByUserId" TEXT,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Capa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaAction" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rationale" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "ownerRole" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "evidenceOfCompletion" TEXT,
    "attachmentIds" JSONB,
    "costEstimate" DOUBLE PRECISION,
    "costEstimateCurrency" TEXT DEFAULT 'INR',
    "approverUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "workflowTaskId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapaAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaRootCause" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapaRootCause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaContributor" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "contributionType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapaContributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaLinkage" (
    "id" TEXT NOT NULL,
    "fromCapaId" TEXT NOT NULL,
    "toCapaId" TEXT NOT NULL,
    "linkageType" TEXT NOT NULL,
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "CapaLinkage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaPatternGroup" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "rationale" TEXT NOT NULL,
    "capaIds" JSONB NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapaPatternGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaAttachment" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT NOT NULL,

    CONSTRAINT "CapaAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaComment" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "commentType" TEXT NOT NULL DEFAULT 'ACTIVITY',
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapaComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CapaSourceCategory_code_key" ON "CapaSourceCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CapaSourceCategory_prefix_key" ON "CapaSourceCategory"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "CapaSourceType_code_key" ON "CapaSourceType"("code");

-- CreateIndex
CREATE INDEX "CapaSourceType_categoryId_isActive_idx" ON "CapaSourceType"("categoryId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CapaSubCategory_code_key" ON "CapaSubCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CapaSlaProfile_code_key" ON "CapaSlaProfile"("code");

-- CreateIndex
CREATE INDEX "CapaSlaProfile_sourceTypeCode_severity_idx" ON "CapaSlaProfile"("sourceTypeCode", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "CapaVerificationMethod_code_key" ON "CapaVerificationMethod"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Capa_capaNumber_key" ON "Capa"("capaNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Capa_aliasNumber_key" ON "Capa"("aliasNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Capa_legacyId_key" ON "Capa"("legacyId");

-- CreateIndex
CREATE INDEX "Capa_plantId_state_idx" ON "Capa"("plantId", "state");

-- CreateIndex
CREATE INDEX "Capa_plantId_sourceTypeCode_state_idx" ON "Capa"("plantId", "sourceTypeCode", "state");

-- CreateIndex
CREATE INDEX "Capa_plantId_primaryOwnerUserId_state_idx" ON "Capa"("plantId", "primaryOwnerUserId", "state");

-- CreateIndex
CREATE INDEX "Capa_plantId_closureTargetDate_state_idx" ON "Capa"("plantId", "closureTargetDate", "state");

-- CreateIndex
CREATE INDEX "Capa_plantId_severity_state_idx" ON "Capa"("plantId", "severity", "state");

-- CreateIndex
CREATE INDEX "Capa_sourceReferenceId_sourceTypeCode_idx" ON "Capa"("sourceReferenceId", "sourceTypeCode");

-- CreateIndex
CREATE INDEX "Capa_aliasNumber_idx" ON "Capa"("aliasNumber");

-- CreateIndex
CREATE INDEX "CapaAction_capaId_actionType_status_idx" ON "CapaAction"("capaId", "actionType", "status");

-- CreateIndex
CREATE INDEX "CapaAction_ownerUserId_status_idx" ON "CapaAction"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "CapaContributor_userId_idx" ON "CapaContributor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CapaContributor_capaId_userId_contributionType_key" ON "CapaContributor"("capaId", "userId", "contributionType");

-- CreateIndex
CREATE INDEX "CapaLinkage_toCapaId_linkageType_idx" ON "CapaLinkage"("toCapaId", "linkageType");

-- CreateIndex
CREATE UNIQUE INDEX "CapaLinkage_fromCapaId_toCapaId_linkageType_key" ON "CapaLinkage"("fromCapaId", "toCapaId", "linkageType");

-- CreateIndex
CREATE INDEX "CapaPatternGroup_plantId_status_idx" ON "CapaPatternGroup"("plantId", "status");

-- CreateIndex
CREATE INDEX "CapaAttachment_capaId_idx" ON "CapaAttachment"("capaId");

-- CreateIndex
CREATE INDEX "CapaComment_capaId_idx" ON "CapaComment"("capaId");

-- AddForeignKey
ALTER TABLE "CapaSourceType" ADD CONSTRAINT "CapaSourceType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CapaSourceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_sourceCategoryId_fkey" FOREIGN KEY ("sourceCategoryId") REFERENCES "CapaSourceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_sourceTypeId_fkey" FOREIGN KEY ("sourceTypeId") REFERENCES "CapaSourceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "CapaSubCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_verificationMethodId_fkey" FOREIGN KEY ("verificationMethodId") REFERENCES "CapaVerificationMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_primaryOwnerUserId_fkey" FOREIGN KEY ("primaryOwnerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_rcaCompletedByUserId_fkey" FOREIGN KEY ("rcaCompletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_verificationCompletedByUserId_fkey" FOREIGN KEY ("verificationCompletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaAction" ADD CONSTRAINT "CapaAction_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaAction" ADD CONSTRAINT "CapaAction_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaAction" ADD CONSTRAINT "CapaAction_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaRootCause" ADD CONSTRAINT "CapaRootCause_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaContributor" ADD CONSTRAINT "CapaContributor_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaContributor" ADD CONSTRAINT "CapaContributor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaLinkage" ADD CONSTRAINT "CapaLinkage_fromCapaId_fkey" FOREIGN KEY ("fromCapaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaLinkage" ADD CONSTRAINT "CapaLinkage_toCapaId_fkey" FOREIGN KEY ("toCapaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaAttachment" ADD CONSTRAINT "CapaAttachment_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaAttachment" ADD CONSTRAINT "CapaAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaComment" ADD CONSTRAINT "CapaComment_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaComment" ADD CONSTRAINT "CapaComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
