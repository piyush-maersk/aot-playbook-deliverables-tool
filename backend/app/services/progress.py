"""Progress rollups for the dashboard. Keep in sync with frontend/src/domain/progress.ts."""
from __future__ import annotations

from datetime import date

PROJECT_DETAIL_FIELDS = (
    "customerName", "region", "siteAddress", "fbmId", "location", "siteId", "warehouseArea",
    "contractLength", "product", "operationType", "workingHours", "shifts", "automation",
    "automationType", "dailyThroughput", "wms", "wcs", "otherApp",
)
BUSINESS_MILESTONES = ("loiAward", "siteAccess", "gld", "bau")
ENGINEERING_MILESTONES = ("MS1.1", "MS1.2", "MS1.3", "MS2", "MS3", "MS4", "MS5", "MS6")


def _filled(v) -> bool:
    return bool(v.strip()) if isinstance(v, str) else v is not None


def _ratio(values) -> float:
    values = list(values)
    return sum(1 for v in values if v) / len(values) if values else 0.0


def work_package_sections(wp: dict, overview: dict) -> dict[str, float]:
    """Completeness per intake step (0..1). Mirrors the editor steps."""
    details = overview.get("projectDetails", {})
    bm = overview.get("businessMilestones", {})
    em = overview.get("engineeringMilestones", {})
    dc = wp.get("documentControl", {})
    codes = wp.get("templateCodes", [])
    scope = wp.get("scope", {})
    appendix_has_content = bool(wp.get("bom")) or any(
        _filled(v) for v in (wp.get("appendixContent") or {}).values())
    return {
        "setup": 1.0 if codes and (wp.get("mode") != "COMBINED" or _filled(wp.get("combinedTitle"))) else 0.0,
        "documentControl": _ratio(_filled(dc.get(k)) for k in ("version", "issueDate", "aotEngineerOwner")),
        "projectOverview": _ratio(_filled(details.get(k)) for k in PROJECT_DETAIL_FIELDS),
        "timelines": _ratio([*(_filled(bm.get(k)) for k in BUSINESS_MILESTONES),
                             *(_filled(em.get(k)) for k in ENGINEERING_MILESTONES)]),
        "scope": _ratio(bool((scope.get(c) or {}).get("reviewed")) for c in codes) if codes else 0.0,
        "requirements": 1.0 if wp.get("requirementsReviewed") else 0.0,
        "appendix": 1.0 if appendix_has_content else 0.0,
    }


def work_package_completeness(wp: dict, overview: dict) -> float:
    sections = work_package_sections(wp, overview)
    return round(100 * sum(sections.values()) / len(sections), 1)


def milestone_plan_progress(activities: list[dict], today: date | None = None) -> dict:
    today = today or date.today()
    tasks = [a for a in activities if not a.get("isGroup")]
    overdue = 0
    for a in tasks:
        end = a.get("endDate") or ""
        try:
            if end and date.fromisoformat(end) < today and float(a.get("status") or 0) < 100:
                overdue += 1
        except ValueError:
            pass
    progress = round(sum(float(a.get("status") or 0) for a in tasks) / len(tasks), 1) if tasks else 0.0
    done = sum(1 for a in tasks if float(a.get("status") or 0) >= 100)
    return {"progress": progress, "tasks": len(tasks), "done": done, "overdue": overdue}


def project_summary(artefacts: dict) -> dict:
    overview = artefacts.get("overview", {})
    wps = artefacts.get("workPackages", [])
    wp_scores = [work_package_completeness(wp, overview) for wp in wps]
    ms = milestone_plan_progress(artefacts.get("milestonePlan", {}).get("activities", []))
    checklists = artefacts.get("checklists", [])
    parts = [ms["progress"]] + ([round(sum(wp_scores) / len(wp_scores), 1)] if wp_scores else [])
    return {
        "workPackages": {
            "count": len(wps),
            "progress": round(sum(wp_scores) / len(wp_scores), 1) if wp_scores else 0.0,
            "byStatus": {s: sum(1 for w in wps if w.get("status") == s)
                         for s in ("Draft", "In Review", "Approved", "Issued")},
        },
        "milestonePlan": ms,
        "checklists": {"count": len(checklists), "progress": 0.0},
        "overall": round(sum(parts) / len(parts), 1) if parts else 0.0,
        "nextMilestone": _next_milestone(overview),
    }


def _next_milestone(overview: dict) -> dict | None:
    today = date.today().isoformat()
    em = overview.get("engineeringMilestones", {})
    upcoming = sorted((v, k) for k, v in em.items() if v and v >= today)
    return {"key": upcoming[0][1], "date": upcoming[0][0]} if upcoming else None
