// Mirrors backend/app/schemas.py. Field names follow the Work Package template / master prompt PART A.

export const PROJECT_STATUSES = ["Planning", "Execution", "Go Live", "Hypercare", "Completed (BAU)", "On Hold"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const WP_STATUSES = ["Draft", "In Review", "Approved", "Issued"] as const;
export type WpStatus = (typeof WP_STATUSES)[number];

export const REQ_ACTIONS = ["KEEP", "TAILOR", "EXCLUDE", "ADD"] as const;
export type ReqAction = (typeof REQ_ACTIONS)[number];

export const DOC_ROLES = ["BOM", "Estimation", "Concept", "BRD", "Layout", "Other"] as const; // B2 precedence order
export type DocRole = (typeof DOC_ROLES)[number];

export const ENGINEERING_MILESTONES = ["MS1.1", "MS1.2", "MS1.3", "MS2", "MS3", "MS4", "MS5", "MS6"] as const;
export type EngineeringMilestone = (typeof ENGINEERING_MILESTONES)[number];

export interface ProjectHeader {
  id: string;
  name: string;
  status: ProjectStatus;
  description: string;
}

/** Page 1 – Project Overview & Warehouse Details (A4 / B6). */
export interface ProjectDetails {
  customerName: string;
  region: string;
  siteAddress: string;
  fbmId: string;
  location: string;
  siteId: string;
  warehouseArea: string;
  contractLength: string;
  product: string;
  operationType: string;
  workingHours: string;
  shifts: string;
  automation: string;
  automationType: string;
  dailyThroughput: string;
  wms: string;
  wcs: string;
  otherApp: string;
  additionalComments: string;
}

export interface BusinessMilestones {
  loiAward: string;
  siteAccess: string;
  gld: string;
  bau: string;
}

export interface Overview {
  projectDetails: ProjectDetails;
  floorLayoutDocumentId: string;
  businessMilestones: BusinessMilestones;
  engineeringMilestones: Record<string, string>;
  projectContext: string;
}

export interface DocumentControl {
  version: string;
  issueDate: string;
  aotEngineerOwner: string;
}

export interface Exclusion {
  item: string;
  source: string;
}

export interface ScopeNotes {
  objectiveNote: string;
  coverageNote: string;
  exclusions: Exclusion[];
  reviewed: boolean;
}

export interface Requirement {
  key: string;
  templateCode: string;
  kind: "FR" | "TR";
  originalId: string;
  text: string;
  action: ReqAction;
  tailoring: string;
  source: string;
}

export interface BomRow {
  id: string;
  category: string;
  hardwareName: string;
  model: string;
  quantity: string;
  templateCode: string;
  source: string;
}

export interface StationRow {
  area: string;
  quantity: string;
}

export interface AppendixAdditions {
  portUrlWhitelist: string;
  barcodeRfidStandards: string;
  diagramAndDocumentLinks: string;
  otherAppendixNotes: string;
}

export interface WorkPackage {
  id: string;
  mode: "SEPARATE" | "COMBINED";
  templateCodes: string[];
  combinedTitle: string;
  status: WpStatus;
  templateLibraryVersion: string;
  documentControl: DocumentControl;
  scope: Record<string, ScopeNotes>;
  requirements: Requirement[];
  requirementsReviewed: boolean;
  bomQuantitySource: "ESTIMATION_DETAILS" | "SCOPE_OF_WORK";
  bom: BomRow[];
  stationDistribution: StationRow[];
  appendixAdditions: AppendixAdditions;
  appendixContent: Record<string, string>;
  sourceDocumentIds: string[];
}

export interface MilestoneActivity {
  id: string;
  phase: string;
  milestone: string;
  isGroup: boolean;
  activity: string;
  deliverables: string;
  responsibleTeam: string;
  supportL1: string;
  supportL2: string;
  predecessor: string;
  challenge: string;
  comments: string;
  planStart: string;
  startDate: string;
  planDuration: string;
  endDate: string;
  responsible: string;
  status: number;
  deliverableLink: string;
  workPackageId: string;
}

export interface Artefacts {
  overview: Overview;
  workPackages: WorkPackage[];
  milestonePlan: { activities: MilestoneActivity[] };
  checklists: unknown[];
}

export interface ProjectDocument {
  project: ProjectHeader;
  artefacts: Artefacts;
}

export interface ProjectMeta {
  revision: number;
  updatedAt: string;
  updatedBy: string;
  createdAt: string;
  createdBy: string;
  createdByEmail: string;
}

export type LoadedProject = ProjectDocument & ProjectMeta;

export interface ProjectSummary {
  workPackages: { count: number; progress: number; byStatus: Record<string, number> };
  milestonePlan: { progress: number; tasks: number; done: number; overdue: number };
  checklists: { count: number; progress: number };
  overall: number;
  nextMilestone: { key: string; date: string } | null;
}

export interface ProjectListItem extends ProjectMeta {
  id: string;
  name: string;
  status: ProjectStatus;
  fbmId: string;
  customerName: string;
  region: string;
  location: string;
  summary: ProjectSummary;
}

export interface Suggestion {
  field: string;
  value: string;
  label: string;
  source: string;
  ref: string;
  role: DocRole;
}

export interface ExtractedBomRow {
  category: string;
  hardwareName: string;
  model: string;
  quantity: string;
  source: string;
}

export interface SourceDocument {
  id: string;
  filename: string;
  role: DocRole;
  contentType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  extraction: {
    suggestions: Suggestion[];
    bom: ExtractedBomRow[];
    isLayoutCandidate: boolean;
    textPreview: string;
    error: string;
  };
}
