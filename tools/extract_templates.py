"""Build backend/app/template_library/work_package_templates.json from the Knowledgebase .docx templates.

Re-run whenever a Page-2 template changes:
    python tools/extract_templates.py [path-to-"Workpackage templates"-folder]

Template identification, package names, text corrections, appendix mapping and the fixed
Deliverables table follow AOT_Workpackage_Master_Prompt.md (sections B1, B10, B11).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import docx

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT.parent / "Knowledgebase" / "Workpackage templates"
OUT = ROOT / "backend" / "app" / "template_library" / "work_package_templates.json"

# B1 – identify templates by Objective text, never by file name.
IDENTIFIERS = [
    ("T1", "WAN", "WAN & Perimeter", "WAN and perimeter connectivity"),
    ("T2", "MDF", "MDF (Main Distribution Frame)", "Main Distribution Frame (MDF)"),
    ("T3", "CAB", "Network Cabling (Passive)", "structured network cabling"),
    ("T4", "LAN", "LAN Active Network", "LAN Active network"),
    ("T5", "ITH", "IT Hardware", "IT hardware required to support warehouse"),
    ("T6", "OTH", "OT Hardware", "Provide and govern OT assets"),
    ("T7", "OTM", "OT Automation Machines", "OT Machine and enablement requirements"),
    ("T8", "OTN", "OT Machine Network", "OT Machine Network"),
]

# B1 – known template text corrections (applied exactly, nothing else).
CORRECTIONS = {
    "T1": [("delivery decisions an is defined", "delivery decisions and are defined")],
    "T3": [("IEC 62443security", "IEC 62443 security")],
    "T4": [("enduser", "end-user")],
    "T7": [(
        "Automation machines shall Operational process flow and throughput requirement",
        "Automation machines shall support the operational process flow and throughput requirements",
    )],
}

# B11 – template appendix letter -> canonical appendix letter.
APPENDIX_MAP = {
    "T1": {"A": "C", "B": "F"},
    "T2": {"A": "B", "B": "G", "C": "G", "D": "F", "E": "A"},
    "T3": {"A": "C", "B": "B", "C": "F", "D": "B", "E": "B"},
    "T4": {"A": "C", "B": "A", "C": "B", "D": "D"},
    "T5": {"A": "A", "B": "I", "C": "B"},
    "T6": {"A": "A", "B": "B", "C": "F", "D": "F"},
    "T7": {"A": "B", "B": "G", "C": "C", "D": "G", "E": "F", "F": "I"},
    "T8": {"A": "A", "B": "C", "C": "D", "D": "C", "E": "I", "F": "F"},
}

# B11 – estimation section numbers per template (Appendix A domain filter).
BOM_SECTIONS = {
    "T1": ["9", "10", "11", "12.1", "12.7"], "T2": ["12.2", "15"], "T3": ["12.5", "14"],
    "T4": ["12", "13"], "T5": ["17", "18", "19", "20", "21"], "T6": ["1", "2", "3", "4", "5", "22", "23"],
    "T7": ["6", "16", "24"], "T8": ["6", "16"],
}

CANONICAL_APPENDIX = [
    ("A", "4.1", "Hardware Bill of Materials & Quantities"),
    ("B", "4.2", "Layouts & Drawings"),
    ("C", "4.3", "Network Architecture, Security & Cabling Design"),
    ("D", "4.4", "Ports, Protocols & URL Whitelisting"),
    ("E", "4.5", "Barcode, Label & RFID Standards"),
    ("F", "4.6", "Configuration, Device Management, Testing & Validation"),
    ("G", "4.7", "Power, Environmental, Safety & Compliance"),
    ("H", "4.8", "Server & Compute Specification"),
    ("I", "4.9", "Asset, Lifecycle & Handover Documentation"),
    ("J", "4.10", "Reference Documents"),
]

# B10 – fixed Deliverables table (identical for every document).
DELIVERABLES = [
    ("MS1.3", "MS 1.3", "Provision of Design", [
        "Workpackage Implementation plan",
        "Detail Solution Design Document and Test Plan",
        "Network Topology Diagram, Connectivity Diagram",
        "Rack Elevation Diagram and Floor Plan Layout",
        "IP Schema Document",
        "VLAN & Segmentation Design Document",
        "Cable Routing Plan",
        "Confirmed BOM (Model & QTY)",
        "PO's raised & ETA confirmed",
    ]),
    ("MS2", "MS 2", "FAT / Site Delivery", [
        "FAT / Quality check Report",
        "SIMT Execution & reporting",
        "Proof of Goods receive (BOM) & warranty coverage verified.",
        "Physical installation (on-site photos required to confirm progress and completion)",
    ]),
    ("MS3", "MS 3", "Commissioning & Unit Testing", [
        "Unit Testing execution & reporting.",
        "Compliance documentation confirmed against applicable standards (ANSI/TIA-568, ISO/IEC 11801, fire safety and OT-specific standards)",
    ]),
    ("MS4", "MS 4", "Integration & User Acceptance", [
        "Site integration testing for HW & SW execution & reporting. Punch list raised for outstanding items.",
        "UAT for HW & SW execution and reporting",
        "UAT Readiness Checklist; Asset inventory compiled & registered (CMDB, SOTI, ..)",
        "All documentation delivered in soft copy formats",
        "Formal handover to site management (credentials & escalation contacts)",
        "BAU RACI Support Model defined",
    ]),
    ("MS5", "MS 5", "Hypercare", [
        "As-built drawings & documentation Validated and Handover",
        "Hypercare support active; incidents logged & resolved",
        "NOC monitoring confirmed active and initial SLA report issued (where applicable)",
    ]),
    ("MS6", "MS 6", "Business as Usual Support", [
        "Final project acceptance signed off; project formally closed",
        "BAU handover completed (handover pack, escalation matrix, SLA documentation)",
        "All punch list items resolved or transitioned to BAU tracking",
    ]),
]

SCOPE_KEYS = {"objective", "coverage", "standards", "clarifications", "exclusions"}


def clean(text: str) -> str:
    text = text.replace("\u2011", "-").replace("\u00a0", " ").replace("\u2019", "'")
    return re.sub(r"[ \t]+", " ", text).strip()


def unique_cells(row) -> list[str]:
    out, prev = [], None
    for c in row.cells:
        if c._tc is prev:
            continue
        prev = c._tc
        out.append(c.text)
    return out


def parse_template(path: Path) -> dict | None:
    d = docx.Document(str(path))
    scope: dict[str, str] = {}
    fr, tr, appx = [], [], []
    for t in d.tables:
        rows = [unique_cells(r) for r in t.rows]
        if not rows or len(rows[0]) < 2:
            continue
        head = clean(rows[0][0]).lower()
        for cells in rows[1:]:
            key = clean(cells[0])
            val = "\n".join(clean(p) for p in cells[1].split("\n") if clean(p))
            if head in ("classification", "area"):
                if key.lower() in SCOPE_KEYS:
                    scope[key.lower()] = val
            elif head == "id" and key.upper().startswith("FR"):
                fr.append({"id": key.upper(), "text": val})
            elif head == "id" and key.upper().startswith("TR"):
                tr.append({"id": key.upper(), "text": val})
            elif head == "appendix":
                appx.append({"letter": key.upper(), "summary": val})
    objective = scope.get("objective", "")
    match = next((i for i in IDENTIFIERS if i[3] in objective), None)
    if not match:
        return None
    code, short, name, _ = match
    for old, new in CORRECTIONS.get(code, []):
        for k in scope:
            scope[k] = scope[k].replace(old, new)
        for r in fr + tr:
            r["text"] = r["text"].replace(old, new)
    for a in appx:
        a["canonical"] = APPENDIX_MAP[code].get(a["letter"])
    if code == "T7":
        tr_08 = next((r for r in tr if r["id"] == "TR-08"), None)
        if tr_08 and "Appendix" not in tr_08["text"]:
            tr_08["text"] = tr_08["text"].rstrip(".") + ". (See Appendix H.)"
    return {
        "code": code, "short": short, "name": name, "sourceFile": path.name,
        "scope": scope, "functionalRequirements": fr, "technicalRequirements": tr,
        "appendices": appx, "bomSections": BOM_SECTIONS[code],
    }


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    templates = {}
    for f in sorted(src.glob("*.docx")):
        parsed = parse_template(f)
        if parsed and parsed["code"] not in templates:
            templates[parsed["code"]] = parsed
            print(f"{parsed['code']}: {f.name} -> {len(parsed['functionalRequirements'])} FR, "
                  f"{len(parsed['technicalRequirements'])} TR, {len(parsed['appendices'])} appx")
    missing = [i[0] for i in IDENTIFIERS if i[0] not in templates]
    if missing:
        raise SystemExit(f"Templates not found: {missing}")
    library = {
        "version": "master-prompt-v1.0",
        "templates": [templates[i[0]] for i in IDENTIFIERS],
        "canonicalAppendix": [{"letter": l, "number": n, "title": t} for l, n, t in CANONICAL_APPENDIX],
        "deliverables": [{"milestoneKey": k, "milestone": m, "phase": p, "items": items}
                         for k, m, p, items in DELIVERABLES],
        "combinedStandards": (
            "All work shall align with ISA-95 enterprise-to-operational separation and IEC 62443 security "
            "concepts, including zones, conduits, least privilege, and defense-in-depth."
        ),
        "combinedStandardsT8Suffix": (
            " The OT Machine Network shall additionally follow the Purdue Reference Architecture (L0–L2) "
            "and NIST SP 800-82."
        ),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(library, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
