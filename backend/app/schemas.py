"""Typed project document. Field names mirror the Work Package template / master prompt PART A.

The document is stored as one JSON snapshot ({project, artefacts}). Models are lenient (extra fields are
kept) so a newer client never loses data on an older server, but known fields are validated.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PROJECT_STATUSES = ("Planning", "Execution", "Go Live", "Hypercare", "Completed (BAU)", "On Hold")
WP_STATUSES = ("Draft", "In Review", "Approved", "Issued")
REQ_ACTIONS = ("KEEP", "TAILOR", "EXCLUDE", "ADD")
DOC_ROLES = ("BOM", "Estimation", "Concept", "BRD", "Layout", "Other")  # B2 precedence order (after PART A)
ENGINEERING_MILESTONES = ("MS1.1", "MS1.2", "MS1.3", "MS2", "MS3", "MS4", "MS5", "MS6")


class Lenient(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)


class ProjectHeader(Lenient):
    id: str
    name: str = Field(min_length=1, max_length=200)
    status: Literal[PROJECT_STATUSES] = "Planning"  # type: ignore[valid-type]
    description: str = ""


class ProjectDetails(Lenient):
    """Page 1 – Project Overview & Warehouse Details (master prompt A4 / B6), exact row order."""
    customerName: str = ""
    region: str = ""
    siteAddress: str = ""
    fbmId: str = ""
    location: str = ""
    siteId: str = ""
    warehouseArea: str = ""
    contractLength: str = ""
    product: str = ""
    operationType: str = ""
    workingHours: str = ""
    shifts: str = ""
    automation: str = ""          # "YES" / "NO"
    automationType: str = ""
    dailyThroughput: str = ""
    wms: str = ""
    wcs: str = ""
    otherApp: str = ""
    additionalComments: str = ""


class BusinessMilestones(Lenient):
    """Page 1 – Business Milestones (A5). Dates are ISO yyyy-mm-dd; rendered DD/MM/YYYY."""
    loiAward: str = ""
    siteAccess: str = ""
    gld: str = ""
    bau: str = ""


class Overview(Lenient):
    """Shared by every deliverable of the project (Page 1 is identical across work packages)."""
    projectDetails: ProjectDetails = Field(default_factory=ProjectDetails)
    floorLayoutDocumentId: str = ""
    businessMilestones: BusinessMilestones = Field(default_factory=BusinessMilestones)
    engineeringMilestones: dict[str, str] = Field(
        default_factory=lambda: {k: "" for k in ENGINEERING_MILESTONES})
    projectContext: str = ""      # A8 – free text treated as a source document


class DocumentControl(Lenient):
    """A3."""
    version: str = "1.0"
    issueDate: str = ""
    aotEngineerOwner: str = ""


class ScopeNotes(Lenient):
    """B8 – only Objective and Coverage get a 'For this project, ...' sentence."""
    objectiveNote: str = ""
    coverageNote: str = ""
    exclusions: list[dict] = Field(default_factory=list)   # [{item, source}]
    reviewed: bool = False


class Requirement(Lenient):
    key: str
    templateCode: str = ""        # T1..T8 ("" for ADD without template)
    kind: Literal["FR", "TR"]
    originalId: str = ""          # template id, e.g. FR-03 ("" for ADD)
    text: str = ""                # template text verbatim (or the added requirement)
    action: Literal[REQ_ACTIONS] = "KEEP"  # type: ignore[valid-type]
    tailoring: str = ""           # "For this project, <fact(s)>." (max 35 words)
    source: str = ""


class BomRow(Lenient):
    id: str
    category: str = ""
    hardwareName: str = ""
    model: str = ""
    quantity: str = ""
    templateCode: str = ""
    source: str = ""


class AppendixAdditions(Lenient):
    """A7."""
    portUrlWhitelist: str = ""
    barcodeRfidStandards: str = ""
    diagramAndDocumentLinks: str = ""
    otherAppendixNotes: str = ""


class WorkPackage(Lenient):
    id: str                                         # WP-01
    mode: Literal["SEPARATE", "COMBINED"] = "SEPARATE"
    templateCodes: list[str] = Field(default_factory=list)
    combinedTitle: str = "IT-OT Automation"
    status: Literal[WP_STATUSES] = "Draft"  # type: ignore[valid-type]
    templateLibraryVersion: str = ""
    documentControl: DocumentControl = Field(default_factory=DocumentControl)
    scope: dict[str, ScopeNotes] = Field(default_factory=dict)      # per template code
    requirements: list[Requirement] = Field(default_factory=list)
    requirementsReviewed: bool = False
    bomQuantitySource: Literal["ESTIMATION_DETAILS", "SCOPE_OF_WORK"] = "ESTIMATION_DETAILS"
    bom: list[BomRow] = Field(default_factory=list)
    stationDistribution: list[dict] = Field(default_factory=list)  # [{area, quantity}]
    appendixAdditions: AppendixAdditions = Field(default_factory=AppendixAdditions)
    appendixContent: dict[str, str] = Field(default_factory=dict)  # canonical letter A..J -> text
    sourceDocumentIds: list[str] = Field(default_factory=list)


class MilestoneActivity(Lenient):
    """One row of the AOT Milestone Plan workbook."""
    id: str                                         # MP-001
    phase: str = ""
    milestone: str = ""
    isGroup: bool = False
    activity: str = ""
    deliverables: str = ""
    responsibleTeam: str = ""
    supportL1: str = ""
    supportL2: str = ""
    predecessor: str = ""
    challenge: str = ""
    comments: str = ""
    planStart: str = ""
    startDate: str = ""
    planDuration: str = ""
    endDate: str = ""
    responsible: str = ""
    status: float = Field(default=0, ge=0, le=100)  # % complete (workbook stores 0..1)
    deliverableLink: str = ""
    workPackageId: str = ""


class MilestonePlan(Lenient):
    activities: list[MilestoneActivity] = Field(default_factory=list)


class Artefacts(Lenient):
    overview: Overview = Field(default_factory=Overview)
    workPackages: list[WorkPackage] = Field(default_factory=list)
    milestonePlan: MilestonePlan = Field(default_factory=MilestonePlan)
    checklists: list[dict] = Field(default_factory=list)  # reserved – checklist module not defined yet


class ProjectDocument(Lenient):
    project: ProjectHeader
    artefacts: Artefacts = Field(default_factory=Artefacts)


class SaveRequest(ProjectDocument):
    baseRevision: int | None = None


class CreateProjectRequest(Lenient):
    name: str = Field(min_length=1, max_length=200)
    status: Literal[PROJECT_STATUSES] = "Planning"  # type: ignore[valid-type]
    description: str = ""
    projectDetails: ProjectDetails = Field(default_factory=ProjectDetails)
    seedMilestonePlan: bool = True


class PresenceRequest(BaseModel):
    mode: Literal["viewing", "editing"] = "viewing"
