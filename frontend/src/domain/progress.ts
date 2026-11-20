// Keep in sync with backend/app/services/progress.py.
import type { MilestoneActivity, Overview, WorkPackage } from "./types";
import { ENGINEERING_MILESTONES } from "./types";

export const PROJECT_DETAIL_FIELDS = [
  "customerName", "region", "siteAddress", "fbmId", "location", "siteId", "warehouseArea",
  "contractLength", "product", "operationType", "workingHours", "shifts", "automation",
  "automationType", "dailyThroughput", "wms", "wcs", "otherApp",
] as const;
const BUSINESS = ["loiAward", "siteAccess", "gld", "bau"] as const;

const filled = (v: unknown) => (typeof v === "string" ? v.trim() !== "" : v !== undefined && v !== null);
const ratio = (values: boolean[]) => (values.length ? values.filter(Boolean).length / values.length : 0);

export type WpSection = "setup" | "documentControl" | "projectOverview" | "timelines" | "scope" | "requirements" | "appendix";

export function workPackageSections(wp: WorkPackage, overview: Overview): Record<WpSection, number> {
  const codes = wp.templateCodes;
  const appendixHasContent = wp.bom.length > 0 || Object.values(wp.appendixContent ?? {}).some(filled);
  return {
    setup: codes.length && (wp.mode !== "COMBINED" || filled(wp.combinedTitle)) ? 1 : 0,
    documentControl: ratio((["version", "issueDate", "aotEngineerOwner"] as const).map((k) => filled(wp.documentControl[k]))),
    projectOverview: ratio(PROJECT_DETAIL_FIELDS.map((k) => filled(overview.projectDetails[k]))),
    timelines: ratio([
      ...BUSINESS.map((k) => filled(overview.businessMilestones[k])),
      ...ENGINEERING_MILESTONES.map((k) => filled(overview.engineeringMilestones[k])),
    ]),
    scope: codes.length ? ratio(codes.map((c) => Boolean(wp.scope[c]?.reviewed))) : 0,
    requirements: wp.requirementsReviewed ? 1 : 0,
    appendix: appendixHasContent ? 1 : 0,
  };
}

export function workPackageCompleteness(wp: WorkPackage, overview: Overview): number {
  const s = Object.values(workPackageSections(wp, overview));
  return Math.round((1000 * s.reduce((a, b) => a + b, 0)) / s.length) / 10;
}

export function isOverdue(a: MilestoneActivity, today = new Date().toISOString().slice(0, 10)): boolean {
  return !a.isGroup && !!a.endDate && a.endDate < today && (a.status ?? 0) < 100;
}

export function milestonePlanProgress(activities: MilestoneActivity[]) {
  const tasks = activities.filter((a) => !a.isGroup);
  const total = tasks.reduce((sum, a) => sum + (Number(a.status) || 0), 0);
  return {
    progress: tasks.length ? Math.round((10 * total) / tasks.length) / 10 : 0,
    tasks: tasks.length,
    done: tasks.filter((a) => (a.status ?? 0) >= 100).length,
    overdue: tasks.filter((a) => isOverdue(a)).length,
  };
}

export type Rag = "green" | "amber" | "red" | "grey";

/** Milestone RAG: red = target passed and not complete; amber = due within 14 days and < 75 %. */
export function milestoneRag(targetDate: string, progress: number, today = new Date()): Rag {
  if (!targetDate) return "grey";
  if (progress >= 100) return "green";
  const days = (new Date(targetDate).getTime() - today.getTime()) / 86_400_000;
  if (days < 0) return "red";
  if (days <= 14 && progress < 75) return "amber";
  return "green";
}
