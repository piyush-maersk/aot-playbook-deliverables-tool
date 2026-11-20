"""Build backend/app/template_library/milestone_plan_template.json from the AOT Milestone Plan workbook.

    python tools/extract_milestone_plan.py [path-to-xlsx]

Only reusable columns are kept (C Milestone, D Activity, E Deliverables & Workpackages, F Responsible team,
G Support L1, H Support L2, I Predecessor). Project-specific values (dates, people, status, links,
challenges, comments) are intentionally dropped so each new project starts clean.
"""
from __future__ import annotations

import json
import re
import sys
import warnings
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = (ROOT.parent / "Knowledgebase" / "Workpackage templates" / "Previous examples"
               / "AOT Milestone Plan & Deliverables_V2.xlsx")
OUT = ROOT / "backend" / "app" / "template_library" / "milestone_plan_template.json"

PHASES = ["Sales Stage", "Initiate", "Planning", "Execute", "Hypercare", "Complete"]
MILESTONE_KEYS = [  # (prefix in column C, key, canonical name)
    ("MS0", "MS0", "MS0 – Kick-Off"),
    ("MS1.1", "MS1.1", "MS1.1 – Provision of Requirements"),
    ("MS1.2", "MS1.2", "MS1.2 – Provision of Suppliers"),
    ("MS1.3", "MS1.3", "MS1.3 – Provision of Designs"),
    ("MS2", "MS2", "MS2 – FAT (Factory Acceptance)"),
    ("MS3", "MS3", "MS3 – SAT (Unit Testing & Commissioning)"),
    ("MS4", "MS4", "MS4 – UAT (Integration & User Acceptance)"),
    ("MS5", "MS5", "MS5 – Hypercare"),
    ("MS6", "MS6", "MS6 – BAU (Business as Usual)"),
]
# Activities that act as section headers for the rows beneath them.
GROUP_ACTIVITIES = {
    "Create Technical Workpackages", "Create Automation Workpackages and to RFP",
    "Integration Work Package", "Create engineering requirement", "Automation Solution vendors",
    "Automation Machine vendors", "Hardware Procurement", "Automation Detail Design",
    "Infrastructure / hardware", "Integration Work Package (Design)", "Time Sequence Diagram",
    "Interface Mapping", "Network Design, BOM & Procurement",
}


def text(v) -> str:
    if v is None:
        return ""
    s = str(v).replace("\u2013", "–").replace("\u00a0", " ")
    s = "\n".join(line.strip() for line in s.splitlines())
    return re.sub(r"\n{2,}", "\n", s).strip()


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    warnings.filterwarnings("ignore")
    ws = openpyxl.load_workbook(src, data_only=True).worksheets[0]
    phase, milestone, rows = PHASES[0], "", []
    for r in range(3, ws.max_row + 1):
        c, d = text(ws[f"C{r}"].value), text(ws[f"D{r}"].value)
        if c in PHASES:
            phase = c
            continue
        if c:
            compact = c.replace(" ", "")
            milestone = next((k for p, k, _ in sorted(MILESTONE_KEYS, key=lambda x: -len(x[0]))
                              if compact.upper().startswith(p.upper())), milestone)
        if not d:
            continue
        deliverables = text(ws[f"E{r}"].value)
        is_group = (d in GROUP_ACTIVITIES or deliverables == "Workpackage"
                    or bool(re.match(r"^\d+\.\s", d)))
        rows.append({
            "phase": phase,
            "milestone": milestone,
            "activity": d,
            "deliverables": deliverables.replace("/", "").strip() if deliverables.strip() == "/" else deliverables,
            "responsibleTeam": text(ws[f"F{r}"].value),
            "supportL1": text(ws[f"G{r}"].value),
            "supportL2": text(ws[f"H{r}"].value),
            "predecessor": text(ws[f"I{r}"].value),
            "isGroup": is_group,
        })
    data = {
        "source": src.name,
        "phases": PHASES,
        "milestones": [{"key": k, "name": n} for _, k, n in MILESTONE_KEYS],
        "columns": ["Milestone", "Activity", "Deliverables & Workpackages", "Responsible Team",
                    "Support Team (L1)", "Support Team (L2)", "Predecessor Condition", "Challenge",
                    "Additional Comments & Links", "Plan Start", "Start Date", "Plan Duration",
                    "End Date", "Responsible", "Status", "Deliverable Link"],
        "activities": rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{len(rows)} activities -> {OUT}")


if __name__ == "__main__":
    main()
