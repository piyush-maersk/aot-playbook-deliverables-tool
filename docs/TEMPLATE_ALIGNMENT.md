# Template alignment

How every element of the AOT templates maps to data collected by the tool. Source of truth for the rules:
`Knowledgebase/Workpackage templates/AOT_Workpackage_Master_Prompt.md` (sections referenced as A1–A8, B1–B13).

## Work Package (4 pages)

| Template element | Rule | Stored in (`artefacts…`) | Collected in |
|---|---|---|---|
| Generation mode SEPARATE / COMBINED, COMBINED_TITLE | A1 | `workPackages[].mode`, `.combinedTitle` | WP → Setup |
| Selected Page-2 templates T1–T8 | A2, B1 | `workPackages[].templateCodes` (always T-order) | WP → Setup |
| Title "Automation & Operational Technology: <NAME> – Work Package" | B3 | derived (`render.ts › documentTitle`) | – |
| File name `<Customer>_<FbMID>_<NAME>_Work_Package_v<VERSION>.docx` | B3 | derived (`render.ts › fileName`) | – |
| Document Control: Version No., WP Issue Date, AOT Engineer Owner | A3, B4 | `workPackages[].documentControl` | WP → Document control |
| Floor layout image | B5 | `overview.floorLayoutDocumentId` (uploaded image) | Project Information / WP → Project overview |
| Project details table (7 rows × 3 label/value pairs) | A4, B6 | `overview.projectDetails` (shared by all WPs) | Project Information / WP → Project overview |
| Business Milestones: LOI/ Award, Site access, GLD, BAU | A5, B7 | `overview.businessMilestones` | Project Information / WP → Project timelines |
| Engineering Milestones MS1.1 – MS6 | A5, B7 | `overview.engineeringMilestones` | Project Information / WP → Project timelines |
| 1. Scope of Work – Objective, Coverage, Standards, Clarifications, Exclusions | B8 | template text (library, verbatim) + `scope[code].objectiveNote / coverageNote / exclusions` (`scope._combined` in COMBINED mode) | WP → 1. Scope of work |
| 2.1 / 2.2 Functional & Technical Requirements | B9 | `workPackages[].requirements[]` – template text snapshot + `action` KEEP/TAILOR/EXCLUDE/ADD, `tailoring`, `source` | WP → 2. Requirements |
| Requirement numbering FR-01… / FR-WAN-01… | B9 step 4 | derived (`render.ts › buildRequirements`) | – |
| Appendix reference rewrite (template letter → canonical A–J) | B9 step 5, B11 | derived (`render.ts › remapAppendixRefs`) | – |
| 3. Deliverables (MS 1.3 – MS 6, fixed rows) | B10 | library `deliverables`; Deadline = `overview.engineeringMilestones` | WP → 3. Deliverables (read-only) |
| 4.1 Appendix A BOM (# · Category · Hardware Name · Model / Part Number · Quantity) | A6, B11 | `workPackages[].bom[]`, `.bomQuantitySource`, `.stationDistribution[]` | WP → 4. Appendix (manual or import from documents) |
| PORT_URL_WHITELIST → D, BARCODE_RFID_STANDARDS → E, DIAGRAM_AND_DOCUMENT_LINKS / OTHER_APPENDIX_NOTES → J | A7 | `workPackages[].appendixAdditions` | WP → 4. Appendix |
| Appendices B – J content | B11 | `workPackages[].appendixContent[letter]` | WP → 4. Appendix |
| Appendix J reference document list | B11 | `workPackages[].sourceDocumentIds` | WP → Sources & context |
| PROJECT_CONTEXT | A8 | `overview.projectContext` | Project Information / WP → Sources & context |
| Placeholders `[TBC]`, `[DD/MM/YYYY]`, `[TO BE PROVIDED]`, "Not applicable to this work package." | R2, B11 | derived for empty fields | WP → Preview & gaps |

The template library (`backend/app/template_library/work_package_templates.json`) is generated from the `.docx`
templates by `tools/extract_templates.py`. Templates are identified by their Objective text (B1), the known text
corrections are applied, and the appendix mapping (B11) is stored with each template appendix.

## Milestone Plan

Seeded from `Previous examples/AOT Milestone Plan & Deliverables_V2.xlsx` by `tools/extract_milestone_plan.py`
(phases Sales Stage → Complete, milestones MS0 – MS6, 133 activities). Only reusable columns are copied; project
specific columns start empty.

| Workbook column | Field (`milestonePlan.activities[]`) |
|---|---|
| MILESTONES | `milestone` (+ `phase`) |
| ACTIVITY | `activity` (`isGroup` marks section header rows) |
| DELIVERABLES & WORKPACKAGES | `deliverables` |
| RESPONSIBLE TEAM / SUPPORT TEAM (L1) / (L2) | `responsibleTeam` / `supportL1` / `supportL2` |
| PREDECESOR CONDITION | `predecessor` |
| CHALLENGE / Additional Comments & Links | `challenge` / `comments` |
| PLAN START / START DATE / PLAN DURATION / END DATE | `planStart` / `startDate` / `planDuration` / `endDate` |
| RESPONSIBLE | `responsible` |
| STATUS (0 – 1) | `status` (0 – 100 %) |
| DELIVERABLE LINK | `deliverableLink` (+ optional `workPackageId`) |

## Checklists

Not defined yet. `artefacts.checklists` is reserved and the module is registered as "coming soon".

## Known open point

The SOP (`SOP_AOT_Work_Package_Generation_v1.0.docx`) refers to Master Prompt **v1.1** with a 4-section appendix
(A–D). The attached master prompt is **v1.0** with the canonical 10-section appendix (A–J), which this tool follows.
Regenerate the library if the appendix structure changes.
