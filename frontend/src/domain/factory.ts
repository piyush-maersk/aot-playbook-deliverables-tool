import type { TemplateLibrary } from "./templates";
import type { MilestoneActivity, Requirement, ScopeNotes, WorkPackage } from "./types";

export const COMBINED_SCOPE_KEY = "_combined";
const T_ORDER = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];

export const sortCodes = (codes: string[]) => [...new Set(codes)].sort((a, b) => T_ORDER.indexOf(a) - T_ORDER.indexOf(b));

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export function nextId(prefix: string, existing: string[], pad = 2): string {
  const max = existing.reduce((m, id) => {
    const n = Number(id.replace(`${prefix}-`, ""));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
}

export const emptyScope = (): ScopeNotes => ({ objectiveNote: "", coverageNote: "", exclusions: [], reviewed: false });

export function templateRequirements(lib: TemplateLibrary, code: string): Requirement[] {
  const t = lib.templates.find((x) => x.code === code);
  if (!t) return [];
  const make = (kind: "FR" | "TR") => (r: { id: string; text: string }): Requirement => ({
    key: `${code}-${r.id}`, templateCode: code, kind, originalId: r.id, text: r.text,
    action: "KEEP", tailoring: "", source: "",
  });
  return [...t.functionalRequirements.map(make("FR")), ...t.technicalRequirements.map(make("TR"))];
}

export function newWorkPackage(
  lib: TemplateLibrary,
  opts: { id: string; mode: "SEPARATE" | "COMBINED"; codes: string[]; combinedTitle?: string; owner?: string },
): WorkPackage {
  const codes = sortCodes(opts.codes);
  const scope: Record<string, ScopeNotes> = Object.fromEntries(codes.map((c) => [c, emptyScope()]));
  if (opts.mode === "COMBINED") scope[COMBINED_SCOPE_KEY] = emptyScope();
  return {
    id: opts.id,
    mode: opts.mode,
    templateCodes: codes,
    combinedTitle: opts.combinedTitle ?? "IT-OT Automation",
    status: "Draft",
    templateLibraryVersion: lib.version,
    documentControl: { version: "1.0", issueDate: "", aotEngineerOwner: opts.owner ?? "" },
    scope,
    requirements: codes.flatMap((c) => templateRequirements(lib, c)),
    requirementsReviewed: false,
    bomQuantitySource: "ESTIMATION_DETAILS",
    bom: [],
    stationDistribution: [],
    appendixAdditions: { portUrlWhitelist: "", barcodeRfidStandards: "", diagramAndDocumentLinks: "", otherAppendixNotes: "" },
    appendixContent: {},
    sourceDocumentIds: [],
  };
}

/** Change the selected templates while keeping decisions already made for templates that stay. */
export function syncTemplates(wp: WorkPackage, lib: TemplateLibrary, nextCodes: string[]): void {
  const codes = sortCodes(nextCodes);
  const kept = wp.requirements.filter((r) => codes.includes(r.templateCode));
  const added = codes.filter((c) => !wp.templateCodes.includes(c)).flatMap((c) => templateRequirements(lib, c));
  const ordered = codes.flatMap((c) => [...kept, ...added].filter((r) => r.templateCode === c));
  wp.requirements = ordered;
  for (const c of codes) wp.scope[c] ??= emptyScope();
  for (const c of Object.keys(wp.scope)) if (c !== COMBINED_SCOPE_KEY && !codes.includes(c)) delete wp.scope[c];
  if (wp.mode === "COMBINED") wp.scope[COMBINED_SCOPE_KEY] ??= emptyScope();
  wp.templateCodes = codes;
}

export function newActivity(existing: MilestoneActivity[], phase: string, milestone: string): MilestoneActivity {
  return {
    id: nextId("MP", existing.map((a) => a.id), 3), phase, milestone, isGroup: false, activity: "", deliverables: "",
    responsibleTeam: "", supportL1: "", supportL2: "", predecessor: "", challenge: "", comments: "", planStart: "",
    startDate: "", planDuration: "", endDate: "", responsible: "", status: 0, deliverableLink: "", workPackageId: "",
  };
}

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
