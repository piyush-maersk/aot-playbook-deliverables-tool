"""Rule-based extraction of template fields from uploaded documents (no AI).

Produces *suggestions* only – the user always confirms before a value is written to the project.
Mapping rules follow master prompt B6 (Page 1 project details) and B11 (Appendix A BOM).
Costs, prices and currency values are never extracted (rule R6).
"""
from __future__ import annotations

import re
import warnings
from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path

ROLE_PRECEDENCE = {"BOM": 1, "Estimation": 2, "Concept": 3, "BRD": 4, "Other": 5, "Layout": 6}

# Normalised label -> target field. Keys are compared after _norm().
FIELD_SYNONYMS: dict[str, list[str]] = {
    "projectDetails.customerName": ["customer name", "customer", "client", "client name", "brand"],
    "projectDetails.region": ["region"],
    "projectDetails.siteAddress": ["site address", "warehouse address", "address", "facility address"],
    "projectDetails.fbmId": ["fbm id", "fbm", "fbmid", "fbm no", "fbm number"],
    "projectDetails.location": ["location"],
    "projectDetails.siteId": ["site id", "cl site id", "site code", "site no"],
    "projectDetails.warehouseArea": ["warehouse area", "location size", "site size", "warehouse size",
                                     "area sqm", "total area"],
    "projectDetails.contractLength": ["contract length", "contract duration", "contract term"],
    "projectDetails.product": ["product", "product category"],
    "projectDetails.operationType": ["operation type", "type of operation"],
    "projectDetails.workingHours": ["working hours", "operation hours", "operating hours", "operational hours"],
    "projectDetails.shifts": ["nº shifts", "no shifts", "no of shifts", "number of shifts", "shifts"],
    "projectDetails.automation": ["automation"],
    "projectDetails.automationType": ["automation type", "type of automation"],
    "projectDetails.dailyThroughput": ["daily throughput", "throughput per day", "daily volume",
                                       "units per day", "orders per day"],
    "projectDetails.wms": ["wms", "wms/yms/dms", "wms yms dms", "warehouse management system"],
    "projectDetails.wcs": ["wcs", "warehouse control system"],
    "projectDetails.otherApp": ["other app", "other application", "other applications"],
    "businessMilestones.loiAward": ["loi", "loi award", "award date", "loi/ award", "contract award"],
    "businessMilestones.siteAccess": ["site access", "site access date"],
    "businessMilestones.gld": ["gld", "go live", "go-live", "go live date", "go-live date", "go live tbc"],
    "businessMilestones.bau": ["bau", "bau date"],
}
_LABEL_TO_FIELD = {}
for _field, _labels in FIELD_SYNONYMS.items():
    for _l in _labels:
        _LABEL_TO_FIELD[re.sub(r"[^a-z0-9º/ ]", "", _l.lower()).strip()] = _field

DATE_FIELDS = {f for f in FIELD_SYNONYMS if f.startswith("businessMilestones.")}
COST_WORDS = re.compile(r"(cost|price|capex|opex|eur|usd|dkk|amount|total value|budget|€|\$)", re.I)
QTY_HEADERS = {"qty", "quantity", "quantities", "qty.", "units"}
NAME_HEADERS = {"description", "hardware name", "hardware", "item", "item description", "equipment",
                "device", "product"}
MODEL_HEADERS = {"model", "part number", "model / part number", "part no", "sku", "comments", "model/part"}
CATEGORY_HEADERS = {"category", "section", "area", "type"}
EXCLUDED_BOM = re.compile(r"(installation|monthly|hosting|service|support|travel|spare kit|labou?r)", re.I)


@dataclass
class Suggestion:
    field: str
    value: str
    label: str
    source: str
    ref: str
    role: str

    @property
    def precedence(self) -> int:
        return ROLE_PRECEDENCE.get(self.role, 9)


def _norm(label: str) -> str:
    label = label.lower().replace("\u00a0", " ").replace("n°", "nº").strip().rstrip(":").strip()
    label = re.sub(r"[^a-z0-9º/ ]", "", label)
    return re.sub(r"\s+", " ", label).strip()


def _cell_text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def _to_iso_date(value: str) -> str:
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%B %d, %Y", "%b %d, %Y", "%d %B %Y",
                "%d %b %Y", "%B %dst, %Y", "%B %dnd, %Y", "%B %drd, %Y", "%B %dth, %Y"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    m = re.search(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", value)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1))).isoformat()
        except ValueError:
            return ""
    return ""


def _format_area(value: str) -> str:
    """B6: format bare numbers as '32,060 sqm'; values that already carry units are kept verbatim."""
    if not re.fullmatch(r"[\d.,\s]+", value):
        return value
    try:
        n = float(value.replace(",", "").strip())
    except ValueError:
        return value
    return f"{int(round(n)):,} sqm"


PLACEHOLDER = re.compile(r"^([-–—/.\s]*|x+[/x\s-]*|tbc|tbd|n/?a|\[tbc\]|\[dd/mm/yyyy\])$", re.I)


def _map_pair(label: str, value: str, source: str, ref: str, role: str,
              strict_value: bool = True) -> list[Suggestion]:
    nl, value = _norm(label), value.strip()
    if not nl or not value or len(value) > 500 or COST_WORDS.search(label) or PLACEHOLDER.match(value):
        return []
    # In free-form sheets the next cell may itself be a label – never treat it as a value.
    if strict_value and (_norm(value) in _LABEL_TO_FIELD or _norm(value) in ("request type", "city", "country")):
        return []
    out: list[Suggestion] = []

    def add(field: str, v: str) -> None:
        if v:
            out.append(Suggestion(field, v, label.strip(), source, ref, role))

    if nl == "request type" and "|" in value:          # B6: Customer = text after "|" in Request Type
        add("projectDetails.customerName", value.split("|", 1)[1].strip())
        return out
    if nl == "operation type":                          # B6: "Warehouse (MCL)" -> type + product
        m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", value)
        if m:
            add("projectDetails.operationType", m.group(1).strip())
            add("projectDetails.product", m.group(2).strip())
            return out
    if nl in ("city", "country"):
        add(f"_location.{nl}", value)
        return out
    field = _LABEL_TO_FIELD.get(nl)
    if not field:
        return out
    if field in DATE_FIELDS:
        iso = _to_iso_date(value)
        add(field, iso)
    elif field == "projectDetails.warehouseArea":
        add(field, _format_area(value))
    elif field == "projectDetails.automation":
        v = value.strip().upper()
        add(field, "YES" if v in ("YES", "Y", "TRUE") else "NO" if v in ("NO", "N", "FALSE") else "")
    else:
        add(field, value)
    return out


def _combine_location(items: list[Suggestion]) -> list[Suggestion]:
    city = next((s for s in items if s.field == "_location.city"), None)
    country = next((s for s in items if s.field == "_location.country"), None)
    rest = [s for s in items if not s.field.startswith("_location.")]
    if city and country:
        rest.append(Suggestion("projectDetails.location", f"{city.value}, {country.value}", "City, Country",
                               city.source, city.ref, city.role))
    return rest


# ---------------------------------------------------------------- readers
def _xlsx(path: Path, role: str) -> tuple[list[Suggestion], list[dict], str]:
    import openpyxl
    warnings.filterwarnings("ignore", module="openpyxl")
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    suggestions: list[Suggestion] = []
    bom: list[dict] = []
    text_parts: list[str] = []
    for ws in wb.worksheets:
        rows = [[_cell_text(c) for c in r] for r in ws.iter_rows(values_only=True)]
        for ri, row in enumerate(rows):
            for ci, label in enumerate(row):
                if not label or len(label) > 60:
                    continue
                value = next((row[j] for j in range(ci + 1, min(ci + 4, len(row))) if row[j]), "")
                suggestions += _map_pair(label, value, path.name, f"{ws.title}!R{ri + 1}C{ci + 1}", role)
            text_parts.append(" ".join(c for c in row if c))
        bom += _bom_from_rows(rows, path.name, ws.title)
    return suggestions, bom, "\n".join(text_parts)


def _bom_from_rows(rows: list[list[str]], source: str, sheet: str) -> list[dict]:
    header_idx = None
    for i, row in enumerate(rows[:60]):
        lowered = {_norm(c) for c in row if c}
        if lowered & QTY_HEADERS and lowered & NAME_HEADERS:
            header_idx = i
            break
    if header_idx is None:
        return []
    header = [_norm(c) for c in rows[header_idx]]

    def col(names: set[str]) -> int | None:
        return next((i for i, h in enumerate(header) if h in names), None)

    qi, ni, mi, cati = col(QTY_HEADERS), col(NAME_HEADERS), col(MODEL_HEADERS), col(CATEGORY_HEADERS)
    out, category = [], ""
    for row in rows[header_idx + 1:]:
        if not any(row):
            continue
        name = row[ni] if ni is not None and ni < len(row) else ""
        qty = row[qi] if qi is not None and qi < len(row) else ""
        filled = [c for c in row if c]
        if name and not qty and len(filled) <= 2:      # section heading row
            category = name
            continue
        try:
            q = float(str(qty).replace(",", ""))
        except ValueError:
            continue
        if q <= 0 or not name or EXCLUDED_BOM.search(name):
            continue
        model = row[mi] if mi is not None and mi < len(row) else ""
        out.append({
            "category": (row[cati] if cati is not None and cati < len(row) and row[cati] else category),
            "hardwareName": name,
            "model": re.sub(r"^-\s*", "", model) or "–",
            "quantity": f"{int(q):,}" if q.is_integer() else str(q),
            "source": f"{source} ({sheet})",
        })
    return out


def _docx(path: Path, role: str) -> tuple[list[Suggestion], list[dict], str]:
    import docx
    d = docx.Document(str(path))
    suggestions: list[Suggestion] = []
    bom: list[dict] = []
    text_parts: list[str] = []
    for i, p in enumerate(d.paragraphs):
        t = p.text.strip()
        if not t:
            continue
        text_parts.append(t)
        if ":" in t:
            label, value = t.split(":", 1)
            suggestions += _map_pair(label, value, path.name, f"paragraph {i + 1}", role)
    for ti, table in enumerate(d.tables):
        rows = []
        for row in table.rows:
            cells, prev = [], None
            for c in row.cells:
                if c._tc is not prev:
                    cells.append(c.text.strip())
                prev = c._tc
            rows.append(cells)
            # Template grids are label|value pairs (2, 4 or 6 columns): pair even positions only.
            for ci in range(0, len(cells) - 1, 2):
                suggestions += _map_pair(cells[ci], cells[ci + 1], path.name, f"table {ti + 1}", role,
                                         strict_value=False)
        text_parts += [" | ".join(r) for r in rows]
        bom += _bom_from_rows(rows, path.name, f"table {ti + 1}")
    return suggestions, bom, "\n".join(text_parts)


def _pdf(path: Path, role: str) -> tuple[list[Suggestion], list[dict], str]:
    from pypdf import PdfReader
    suggestions: list[Suggestion] = []
    text_parts: list[str] = []
    for pi, page in enumerate(PdfReader(str(path)).pages):
        text = page.extract_text() or ""
        text_parts.append(text)
        for line in text.splitlines():
            if ":" in line:
                label, value = line.split(":", 1)
                suggestions += _map_pair(label, value, path.name, f"page {pi + 1}", role)
    return suggestions, [], "\n".join(text_parts)


def extract(path: Path, role: str) -> dict:
    """Return {suggestions, bom, isLayoutCandidate, textPreview, error}."""
    ext = path.suffix.lower()
    reader = {".xlsx": _xlsx, ".xlsm": _xlsx, ".docx": _docx, ".pdf": _pdf}.get(ext)
    is_image = ext in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg")
    result = {"suggestions": [], "bom": [], "textPreview": "", "error": "",
              "isLayoutCandidate": is_image and (role == "Layout" or "layout" in path.name.lower())}
    if reader is None:
        return result
    try:
        suggestions, bom, text = reader(path, role)
    except Exception as exc:  # corrupt or password-protected files
        result["error"] = f"Could not read file: {exc.__class__.__name__}"
        return result
    suggestions = _combine_location(suggestions)
    seen, unique = set(), []
    for s in suggestions:
        key = (s.field, s.value.lower())
        if key not in seen:
            seen.add(key)
            unique.append(s)
    result["suggestions"] = [asdict(s) for s in unique]
    result["bom"] = bom
    result["textPreview"] = text[:4000]
    return result
