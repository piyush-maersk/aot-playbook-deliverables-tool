// Assembles the 4-page Work Package exactly as described in the master prompt (B3–B11).
// Used for the in-app preview; a .docx exporter can reuse the same view model.
import { COMBINED_SCOPE_KEY, sortCodes } from "./factory";
import type { TemplateLibrary, WorkPackageTemplate } from "./templates";
import type { Overview, ProjectDetails, SourceDocument, WorkPackage } from "./types";

export const TBC = "[TBC]";
export const NO_DATE = "[DD/MM/YYYY]";
export const TO_BE_PROVIDED = "[TO BE PROVIDED]";
export const NOT_APPLICABLE = "Not applicable to this work package.";

export function fmtDate(iso: string | undefined): string {
  if (!iso) return NO_DATE;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export const orTbc = (v: string | undefined) => (v && v.trim() ? v.trim() : TBC);

/** Exact label/value order of the Page 1 details table (B6). */
export const DETAIL_ROWS: [keyof ProjectDetails, string][][] = [
  [["customerName", "Customer Name"], ["region", "Region"], ["siteAddress", "Site Address"]],
  [["fbmId", "FbM ID"], ["location", "Location"], ["siteId", "Site ID"]],
  [["warehouseArea", "Warehouse area"], ["contractLength", "Contract length"], ["product", "Product"]],
  [["operationType", "Operation Type"], ["workingHours", "Working hours"], ["shifts", "Nº Shifts"]],
  [["automation", "Automation"], ["automationType", "Automation Type"], ["dailyThroughput", "Daily Throughput"]],
  [["wms", "WMS"], ["wcs", "WCS"], ["otherApp", "Other App"]],
];

export const ENGINEERING_GROUPS = [
  { label: "PLAN", items: [["MS1.1", "MS1.1 – Prov. Requirements"], ["MS1.2", "MS1.2 – Prov. Suppliers"], ["MS1.3", "MS1.3 – Prov. Design"]] },
  { label: "EXECUTE", items: [["MS2", "MS2 – FAT & Delivery"], ["MS3", "MS3 – Commissioning & UT"], ["MS4", "MS4 – Integration & UAT"]] },
  { label: "CLOSE/ HYPERCARE", items: [["MS5", "MS5 – Hypercare"], ["MS6", "MS6 – Business as Usual Support"]] },
] as const;

export function packageName(wp: WorkPackage, lib: TemplateLibrary): string {
  if (wp.mode === "COMBINED") return wp.combinedTitle || TBC;
  return lib.templates.find((t) => t.code === wp.templateCodes[0])?.name ?? TBC;
}

export const documentTitle = (wp: WorkPackage, lib: TemplateLibrary) =>
  `Automation & Operational Technology: ${packageName(wp, lib)} – Work Package`;

export function fileName(wp: WorkPackage, lib: TemplateLibrary, d: ProjectDetails): string {
  const part = (s: string) => orTbc(s).replace("[TBC]", "TBC").replace(/[&()/]/g, "").trim().replace(/\s+/g, "_");
  return `${part(d.customerName)}_${part(d.fbmId)}_${part(packageName(wp, lib))}_Work_Package_v${wp.documentControl.version || "1.0"}.docx`;
}

/** B9 step 5 – rewrite template appendix letters to the canonical appendix letters. */
export function remapAppendixRefs(text: string, t: WorkPackageTemplate): string {
  const map = Object.fromEntries(t.appendices.map((a) => [a.letter, a.canonical]));
  const sw = (l: string) => map[l] ?? l;
  return text
    .replace(/\bAppendices\s+([A-F])\s+and\s+([A-F])\b/g, (_, a, b) => `Appendices ${sw(a)} and ${sw(b)}`)
    .replace(/\b(Appendix|Appx)\s+([A-F])\b(?!-)/g, (_, w, l) => `${w} ${sw(l)}`)
    .replace(/\bAppendices\s+([A-F])\s*[–-]\s*([A-F])\b/g, (_, a, b) => `Appendices ${sw(a)}–${sw(b)}`);
}

const SCOPE_ORDER = [
  ["objective", "Objective"], ["coverage", "Coverage"], ["standards", "Standards"],
  ["clarifications", "Clarifications"], ["exclusions", "Exclusions"],
] as const;

export interface ScopeRow { label: string; lines: string[] }
export interface ReqRow { id: string; text: string; header?: boolean }
export interface AppendixView { letter: string; number: string; title: string; scope: string; body: string[]; placeholder?: string }

function noteSentence(note: string): string {
  const n = note.trim();
  if (!n) return "";
  return /^for this project,/i.test(n) ? n : `For this project, ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
}

export function buildScope(wp: WorkPackage, lib: TemplateLibrary): ScopeRow[] {
  const templates = sortCodes(wp.templateCodes).map((c) => lib.templates.find((t) => t.code === c)!).filter(Boolean);
  const combined = wp.mode === "COMBINED";
  const notesFor = (code: string) => wp.scope[combined ? COMBINED_SCOPE_KEY : code];
  const rows: ScopeRow[] = [];
  for (const [key, label] of SCOPE_ORDER) {
    let lines: string[] = [];
    if (key === "exclusions") {
      lines = templates.filter((t) => t.scope.exclusions).map((t) => (combined ? `• ${t.name}: ${t.scope.exclusions}` : t.scope.exclusions!));
      const extra = (combined ? [notesFor("")] : templates.map((t) => notesFor(t.code)))
        .flatMap((s) => s?.exclusions ?? []).filter((e) => e.item.trim());
      lines.push(...extra.map((e) => `• ${e.item.trim()}${e.source ? ` (Source: ${e.source})` : ""}`));
      if (lines.length) rows.push({ label, lines });
      continue;
    }
    if (combined && key === "standards") {
      lines = [lib.combinedStandards + (wp.templateCodes.includes("T8") ? lib.combinedStandardsT8Suffix : "")];
    } else if (combined) {
      lines = templates.filter((t) => t.scope[key]).map((t) => `• ${t.name}: ${t.scope[key]}`);
    } else {
      lines = templates.map((t) => t.scope[key] ?? "").filter(Boolean);
    }
    if (key === "objective" || key === "coverage") {
      const note = noteSentence((combined ? notesFor("") : notesFor(templates[0]?.code ?? ""))?.[key === "objective" ? "objectiveNote" : "coverageNote"] ?? "");
      if (note) {
        if (combined) lines.push(`• ${note}`);
        else lines[lines.length - 1] = `${lines[lines.length - 1] ?? ""} ${note}`.trim();
      }
    }
    rows.push({ label, lines });
  }
  return rows;
}

export function buildRequirements(wp: WorkPackage, lib: TemplateLibrary, kind: "FR" | "TR"): ReqRow[] {
  const combined = wp.mode === "COMBINED";
  const rows: ReqRow[] = [];
  for (const code of sortCodes(wp.templateCodes)) {
    const t = lib.templates.find((x) => x.code === code);
    if (!t) continue;
    const reqs = wp.requirements.filter((r) => r.templateCode === code && r.kind === kind && r.action !== "EXCLUDE");
    const ordered = [...reqs.filter((r) => r.action !== "ADD"), ...reqs.filter((r) => r.action === "ADD")];
    if (combined) rows.push({ id: "", text: t.name, header: true });
    ordered.forEach((r, i) => {
      const n = String(i + 1).padStart(2, "0");
      const base = r.action === "ADD" ? r.text.trim() : remapAppendixRefs(r.text, t);
      const tail = r.action === "TAILOR" ? noteSentence(r.tailoring) : "";
      rows.push({ id: combined ? `${kind}-${t.short}-${n}` : `${kind}-${n}`, text: tail ? `${base} ${tail}` : base });
    });
  }
  return rows;
}

export function buildAppendix(wp: WorkPackage, lib: TemplateLibrary, overview: Overview, docs: SourceDocument[]): AppendixView[] {
  const templates = sortCodes(wp.templateCodes).map((c) => lib.templates.find((t) => t.code === c)!).filter(Boolean);
  const add = wp.appendixAdditions;
  const sourceDocs = docs.filter((d) => wp.sourceDocumentIds.includes(d.id));
  return lib.canonicalAppendix.map(({ letter, number, title }) => {
    const scope = templates.flatMap((t) => t.appendices.filter((a) => a.canonical === letter).map((a) => a.summary)).join("; ");
    // T7 TR-08 references Appendix H without a template appendix summary (B9 step 5).
    const referenced = Boolean(scope) || (letter === "H" && wp.templateCodes.includes("T7"));
    const content = (wp.appendixContent[letter] ?? "").trim();
    const body: string[] = [];
    if (letter === "A") {
      wp.bom.forEach((b, i) => body.push(`${i + 1} | ${b.category || "–"} | ${b.hardwareName} | ${b.model || "–"} | ${b.quantity}`));
    }
    if (letter === "B" && overview.floorLayoutDocumentId) body.push("Figure 1: Floor layout");
    if (letter === "D" && add.portUrlWhitelist.trim()) body.push(add.portUrlWhitelist.trim());
    if (letter === "E" && add.barcodeRfidStandards.trim()) body.push(add.barcodeRfidStandards.trim());
    if (content) body.push(content);
    if (letter === "J") {
      body.push(...sourceDocs.map((d) => `• ${d.filename}`));
      if (add.diagramAndDocumentLinks.trim()) body.push(add.diagramAndDocumentLinks.trim());
      if (add.otherAppendixNotes.trim()) body.push(add.otherAppendixNotes.trim());
    }
    const placeholder = body.length ? undefined : referenced ? TO_BE_PROVIDED : NOT_APPLICABLE;
    return { letter, number, title, scope, body, placeholder };
  });
}

export interface DecisionRow { finalId: string; originalId: string; action: string; source: string; template: string }

/** Generation-log section 3: Final ID | Original ID | Action | Source (same numbering as buildRequirements). */
export function requirementDecisions(wp: WorkPackage, lib: TemplateLibrary): DecisionRow[] {
  const combined = wp.mode === "COMBINED";
  const out: DecisionRow[] = [];
  for (const kind of ["FR", "TR"] as const) {
    for (const code of sortCodes(wp.templateCodes)) {
      const t = lib.templates.find((x) => x.code === code);
      if (!t) continue;
      const reqs = wp.requirements.filter((r) => r.templateCode === code && r.kind === kind);
      const kept = [...reqs.filter((r) => r.action !== "ADD" && r.action !== "EXCLUDE"), ...reqs.filter((r) => r.action === "ADD")];
      kept.forEach((r, i) => {
        const n = String(i + 1).padStart(2, "0");
        out.push({ finalId: combined ? `${kind}-${t.short}-${n}` : `${kind}-${n}`, originalId: r.originalId || "–", action: r.action, source: r.source, template: code });
      });
      reqs.filter((r) => r.action === "EXCLUDE").forEach((r) => out.push({ finalId: "–", originalId: r.originalId, action: r.action, source: r.source, template: code }));
    }
  }
  return out;
}

export interface PlaceholderItem { section: string; item: string; value: string }

/** Generation-log section 5: every remaining placeholder by section. */
export function remainingPlaceholders(wp: WorkPackage, lib: TemplateLibrary, overview: Overview, docs: SourceDocument[]): PlaceholderItem[] {
  const out: PlaceholderItem[] = [];
  const dc = wp.documentControl;
  if (!dc.issueDate) out.push({ section: "Document Control", item: "WP Issue Date", value: TBC });
  if (!dc.aotEngineerOwner) out.push({ section: "Document Control", item: "AOT Engineer Owner", value: TBC });
  for (const row of DETAIL_ROWS) for (const [k, label] of row) if (!overview.projectDetails[k]?.trim()) out.push({ section: "Project Details", item: label, value: TBC });
  const bm = overview.businessMilestones;
  ([["loiAward", "LOI/ Award"], ["siteAccess", "Site access"], ["gld", "GLD"], ["bau", "BAU"]] as const).forEach(([k, l]) => {
    if (!bm[k]) out.push({ section: "Business Milestones", item: l, value: NO_DATE });
  });
  for (const g of ENGINEERING_GROUPS) for (const [k, l] of g.items) if (!overview.engineeringMilestones[k]) out.push({ section: "Engineering Milestones", item: l, value: NO_DATE });
  for (const a of buildAppendix(wp, lib, overview, docs)) if (a.placeholder === TO_BE_PROVIDED) out.push({ section: "Appendix", item: `${a.number} Appendix ${a.letter}: ${a.title}`, value: TO_BE_PROVIDED });
  return out;
}
