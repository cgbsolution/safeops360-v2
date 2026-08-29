// Shared types for EAI entry detail page and editor component

export type MatrixLevel = { id: string; score: number; label: string; description: string };

export type AspectItem = {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  typicallySignificant: boolean;
};

export type CategoryItem = { id: string; code: string; name: string; sortOrder: number };
export type ReceptorItem = { id: string; code: string; name: string };

export type EaiEntryOut = {
  id: string;
  studyId: string;
  sequenceNumber: number;
  activityDescription: string;
  areaId: string | null;
  subLocation: string | null;
  occurrence: string;
  frequency: string;
  typicalDurationMin: number | null;
  equipmentUsed: string[] | null;
  materialsUsed: string[] | null;
  processInputs: string[] | null;

  initialLikelihoodScore: number;
  initialLikelihoodRationale: string | null;
  initialMagnitudeScore: number;
  initialMagnitudeRationale: string | null;
  initialImpactScore: number;
  initialImpactLevel: string;
  initialImpactColor: string | null;
  initialSignificant: boolean;

  residualLikelihoodScore: number | null;
  residualLikelihoodRationale: string | null;
  residualMagnitudeScore: number | null;
  residualMagnitudeRationale: string | null;
  residualImpactScore: number | null;
  residualImpactLevel: string | null;
  residualImpactColor: string | null;
  residualAcceptable: boolean | null;
  residualAcceptanceRationale: string | null;
  residualSignificant: boolean;

  legalComplianceStatus: string | null;
  linkedHiraEntryIds: string[] | null;
  lastReviewedAt: string | null;
  nextReviewDue: string | null;
  status: string;
  versionNumber: number;

  aspects: Array<{
    id: string;
    aspectId: string;
    contextualDescription: string | null;
    quantification: {
      parameter?: string;
      typicalValue?: string;
      unit?: string;
      monitoringPoint?: string;
    } | null;
    occurrence: string | null;
    sortOrder: number;
  }>;

  impacts: Array<{
    id: string;
    description: string;
    affectedReceptor: string;
    impactType: string;
    reversibility: string;
    geographicExtent: string;
    temporalExtent: string;
  }>;

  existingControls: Array<{
    id: string;
    hierarchy: string;
    description: string;
    effectiveness: string | null;
    verificationMethod: string | null;
    verificationFreq: string | null;
    responsibleRole: string | null;
    monitoringPoint: string | null;
    monitoringParameter: string | null;
    monitoringFrequency: string | null;
  }>;

  recommendedControls: Array<{
    id: string;
    hierarchy: string;
    description: string;
    rationale: string | null;
    targetLikelihoodReduction: number | null;
    targetMagnitudeReduction: number | null;
    estimatedCostBand: string | null;
    proposedImplementationDate: string | null;
    responsibleUserId: string | null;
    status: string;
  }>;

  complianceObligations: Array<{
    id: string;
    regulationCode: string;
    section: string | null;
    parameter: string;
    permittedLimit: string;
    monitoringFrequency: string;
    reportingAuthority: string | null;
    nextMonitoringDue: string | null;
    lastMonitoringResult: string | null;
    status: string;
  }>;

  regulationRefs: Array<{
    id: string;
    regulationCode: string;
    section: string | null;
    requirementSummary: string | null;
  }>;

  createdAt: string;
  updatedAt: string;
};
