import { useMemo } from "react";
import { useDocuments } from "../../api/queries";
import { Badge, Button, Card, Field, Select, TextArea, TextInput } from "../../components/ui";
import { DOC_ROLES, type Suggestion } from "../../domain/types";
import { useProjectStore } from "../../store/projectStore";
import { BUSINESS_FIELDS, DETAIL_FIELDS, ENGINEERING_FIELDS } from "./fields";
import { useLayoutUrl } from "./useLayoutUrl";

/** Suggestions per target field, best source first (master prompt B2 precedence). */
export function useSuggestions(projectId: string) {
  const docs = useDocuments(projectId);
  return useMemo(() => {
    const byField: Record<string, Suggestion[]> = {};
    for (const d of docs.data ?? []) for (const s of d.extraction?.suggestions ?? []) (byField[s.field] ??= []).push(s);
    for (const list of Object.values(byField)) list.sort((a, b) => DOC_ROLES.indexOf(a.role) - DOC_ROLES.indexOf(b.role));
    return byField;
  }, [docs.data]);
}

function SuggestionHint({ list, current, onUse }: { list?: Suggestion[]; current: string; onUse: (v: string) => void }) {
  const options = (list ?? []).filter((s) => s.value !== current);
  if (!options.length) return null;
  const best = options[0]!;
  return (
    <span className="hint" title={options.map((o) => `${o.value} — ${o.source} (${o.role}, ${o.ref})`).join("\n")}>
      Found <strong>{best.value}</strong> in {best.source}{options.length > 1 ? ` (+${options.length - 1} more)` : ""}{" "}
      <button className="btn ghost sm" style={{ height: 22 }} onClick={() => onUse(best.value)}>Use</button>
    </span>
  );
}

export function ProjectDetailsForm({ projectId }: { projectId: string }) {
  const { doc, update } = useProjectStore();
  const suggestions = useSuggestions(projectId);
  if (!doc) return null;
  const d = doc.artefacts.overview.projectDetails;
  const set = (key: keyof typeof d, v: string) => update((x) => { x.artefacts.overview.projectDetails[key] = v; });

  const fillEmpty = () => update((x) => {
    const details = x.artefacts.overview.projectDetails;
    for (const f of DETAIL_FIELDS) {
      const best = suggestions[`projectDetails.${f.key}`]?.[0];
      if (best && !details[f.key]?.trim()) details[f.key] = best.value;
    }
    const bm = x.artefacts.overview.businessMilestones;
    for (const f of BUSINESS_FIELDS) {
      const best = suggestions[`businessMilestones.${f.key}`]?.[0];
      if (best && !bm[f.key]) bm[f.key] = best.value;
    }
  });
  const hasSuggestions = Object.keys(suggestions).length > 0;

  return (
    <Card title="Project Overview & Warehouse Details" actions={
      <>
        <Badge tone="grey">Page 1 · A4</Badge>
        {hasSuggestions && <Button size="sm" variant="secondary" onClick={fillEmpty}>Fill empty fields from documents</Button>}
      </>
    }>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Shared by every work package of this project. Values typed here always win over documents. Leave unknown values empty – they render as [TBC].
      </p>
      <div className="grid cols-3">
        {DETAIL_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={
            <>
              {f.hint}{f.example ? ` – e.g. ${f.example}` : ""}
              <SuggestionHint list={suggestions[`projectDetails.${f.key}`]} current={d[f.key]} onUse={(v) => set(f.key, v)} />
            </>
          }>
            {f.key === "automation" ? (
              <Select value={d.automation as "" | "YES" | "NO"} onChange={(v) => set("automation", v)} options={[{ value: "", label: "–" }, "YES", "NO"]} />
            ) : (
              <TextInput value={d[f.key]} onChange={(v) => set(f.key, v)} placeholder="[TBC]" />
            )}
          </Field>
        ))}
      </div>
      <Field label="Additional Comments" hint="Any short note for Page 1 (optional)" className="mt">
        <TextArea value={d.additionalComments} onChange={(v) => set("additionalComments", v)} rows={2} />
      </Field>
    </Card>
  );
}

export function TimelinesForm({ projectId }: { projectId: string }) {
  const { doc, update } = useProjectStore();
  const suggestions = useSuggestions(projectId);
  if (!doc) return null;
  const { businessMilestones: bm, engineeringMilestones: em } = doc.artefacts.overview;
  const groups = ["PLAN", "EXECUTE", "CLOSE/ HYPERCARE"] as const;
  return (
    <Card title="Project Timelines" actions={<Badge tone="grey">Page 1 · A5</Badge>}>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Rendered as DD/MM/YYYY. Engineering milestone dates are also the Deadlines in the Deliverables table (Page 3) and the targets in the Milestone Plan.
      </p>
      <h4>Business Milestones</h4>
      <div className="grid cols-4">
        {BUSINESS_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={
            <>{f.hint}<SuggestionHint list={suggestions[`businessMilestones.${f.key}`]} current={bm[f.key]} onUse={(v) => update((x) => { x.artefacts.overview.businessMilestones[f.key] = v; })} /></>
          }>
            <input type="date" value={bm[f.key]} onChange={(e) => update((x) => { x.artefacts.overview.businessMilestones[f.key] = e.target.value; })} />
          </Field>
        ))}
      </div>
      <h4 className="mt">Engineering Milestones</h4>
      <div className="grid cols-3">
        {groups.map((g) => (
          <div key={g} className="card flat" style={{ padding: "0.8rem" }}>
            <h4 style={{ color: "var(--blue-700)" }}>{g}</h4>
            <div className="stack">
              {ENGINEERING_FIELDS.filter((f) => f.group === g).map((f) => (
                <Field key={f.key} label={f.label}>
                  <input type="date" value={em[f.key] ?? ""} onChange={(e) => update((x) => { x.artefacts.overview.engineeringMilestones[f.key] = e.target.value; })} />
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function FloorLayoutCard({ projectId }: { projectId: string }) {
  const { doc, update } = useProjectStore();
  const docs = useDocuments(projectId);
  const images = (docs.data ?? []).filter((d) => /\.(png|jpe?g|gif|webp|svg)$/i.test(d.filename));
  const selected = doc?.artefacts.overview.floorLayoutDocumentId ?? "";
  const url = useLayoutUrl(projectId, selected);
  if (!doc) return null;
  return (
    <Card title="Floor layout" actions={<Badge tone="grey">Page 1 · B5</Badge>}>
      <p className="muted" style={{ fontSize: "0.85rem" }}>Upload a layout image (role "Layout" or a file name containing "layout"), then select it here.</p>
      <Select value={selected} onChange={(v) => update((x) => { x.artefacts.overview.floorLayoutDocumentId = v; })}
        options={[{ value: "", label: images.length ? "– none ([Insert floor layout]) –" : "No image uploaded yet" }, ...images.map((i) => ({ value: i.id, label: `${i.filename}${i.extraction?.isLayoutCandidate ? " (layout)" : ""}` }))]} />
      {url && <img src={url} alt="Floor layout" style={{ width: "100%", marginTop: "0.75rem", borderRadius: 8, border: "1px solid var(--border)" }} />}
    </Card>
  );
}

export function ProjectContextCard() {
  const { doc, update } = useProjectStore();
  if (!doc) return null;
  return (
    <Card title="Additional project context" actions={<Badge tone="grey">A8</Badge>}>
      <Field label="PROJECT_CONTEXT" hint="Free text treated as a source document: facts not in any file, intended audience, special instructions.">
        <TextArea rows={4} value={doc.artefacts.overview.projectContext} onChange={(v) => update((x) => { x.artefacts.overview.projectContext = v; })}
          placeholder="e.g. This work package is intended for the network team and network vendors." />
      </Field>
    </Card>
  );
}
