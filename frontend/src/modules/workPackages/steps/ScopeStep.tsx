import { useDocuments } from "../../../api/queries";
import { Badge, Button, Card, Checkbox, Field, TextArea, TextInput } from "../../../components/ui";
import { COMBINED_SCOPE_KEY, emptyScope, sortCodes } from "../../../domain/factory";
import { buildScope } from "../../../domain/render";
import type { TemplateLibrary } from "../../../domain/templates";
import { useProjectStore } from "../../../store/projectStore";
import { useWorkPackage } from "../useWorkPackage";

const LABELS = { objective: "Objective", coverage: "Coverage", standards: "Standards", clarifications: "Clarifications", exclusions: "Exclusions" } as const;

export function ScopeStep({ wpId, lib }: { wpId: string; lib: TemplateLibrary }) {
  const { wp, updateWp, readOnly } = useWorkPackage(wpId);
  const projectId = useProjectStore((s) => s.projectId) ?? "";
  const docs = useDocuments(projectId);
  if (!wp) return null;
  const combined = wp.mode === "COMBINED";
  const noteKey = combined ? COMBINED_SCOPE_KEY : wp.templateCodes[0] ?? "";
  const notes = wp.scope[noteKey] ?? emptyScope();
  const templates = sortCodes(wp.templateCodes).map((c) => lib.templates.find((t) => t.code === c)!).filter(Boolean);
  const reviewed = templates.length > 0 && templates.every((t) => wp.scope[t.code]?.reviewed);
  const docNames = (docs.data ?? []).map((d) => d.filename);

  const setNotes = (fn: (n: typeof notes) => void) => updateWp((w) => {
    w.scope[noteKey] ??= emptyScope();
    fn(w.scope[noteKey]!);
  });

  return (
    <>
      <Card title="Template scope (verbatim)" actions={<Badge tone="grey">B8 · template text is never edited</Badge>}>
        {templates.map((t) => (
          <div key={t.code} className="mb">
            {combined && <h4>{t.code} · {t.name}</h4>}
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th style={{ width: 150 }}>Classification</th><th>Description</th></tr></thead>
                <tbody>
                  {(Object.keys(LABELS) as (keyof typeof LABELS)[]).filter((k) => t.scope[k]).map((k) => (
                    <tr key={k}><td><strong>{LABELS[k]}</strong></td>
                      <td style={{ whiteSpace: "pre-wrap" }}>{combined && k === "standards" ? <span className="muted">Replaced by the fixed COMBINED standards text (see preview).</span> : t.scope[k]}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </Card>

      <Card title="Project-specific scope facts" actions={<Badge tone="grey">“For this project, …”</Badge>}>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Optional. One sentence each for Objective and Coverage, only with facts from the sources. No quantities, no models, no costs (those belong in the Appendix).
        </p>
        <div className="grid cols-2">
          <Field label="Objective – project fact" hint="Rendered as: “For this project, <fact(s)>.”">
            <TextArea rows={3} value={notes.objectiveNote} disabled={readOnly} placeholder="For this project, the warehouse supports inbound, outbound and returns flows with RFID-enabled workflows."
              onChange={(v) => setNotes((n) => { n.objectiveNote = v; })} />
          </Field>
          <Field label="Coverage – project fact" hint="Rendered as: “For this project, <fact(s)>.”">
            <TextArea rows={3} value={notes.coverageNote} disabled={readOnly} onChange={(v) => setNotes((n) => { n.coverageNote = v; })} />
          </Field>
        </div>
      </Card>

      <Card title="Exclusions (out of scope)" actions={
        !readOnly && <Button size="sm" variant="secondary" onClick={() => setNotes((n) => { n.exclusions.push({ item: "", source: "" }); })}>+ Add exclusion</Button>
      }>
        <p className="muted" style={{ fontSize: "0.85rem" }}>Template exclusions are kept verbatim. Add items a source document states as out of scope; they render as “• &lt;item&gt; (Source: &lt;document&gt;)”.</p>
        {notes.exclusions.length === 0 && <div className="muted">No additional exclusions.</div>}
        <datalist id="scope-docs">{docNames.map((n) => <option key={n} value={n} />)}</datalist>
        <div className="stack">
          {notes.exclusions.map((e, i) => (
            <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
              <TextInput value={e.item} disabled={readOnly} placeholder="Out-of-scope item" onChange={(v) => setNotes((n) => { n.exclusions[i]!.item = v; })} />
              <TextInput value={e.source} disabled={readOnly} placeholder="Source document" list="scope-docs" style={{ maxWidth: 280 }} onChange={(v) => setNotes((n) => { n.exclusions[i]!.source = v; })} />
              {!readOnly && <Button variant="ghost" size="sm" onClick={() => setNotes((n) => { n.exclusions.splice(i, 1); })}>Remove</Button>}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Rendered “1. Scope of Work”">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th style={{ width: 150 }}>Classification</th><th>Description</th></tr></thead>
            <tbody>
              {buildScope(wp, lib).map((r) => <tr key={r.label}><td><strong>{r.label}</strong></td><td style={{ whiteSpace: "pre-wrap" }}>{r.lines.join("\n")}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="mt">
          <Checkbox checked={reviewed} disabled={readOnly} label="Scope of work reviewed"
            onChange={(on) => updateWp((w) => { for (const c of w.templateCodes) { w.scope[c] ??= emptyScope(); w.scope[c]!.reviewed = on; } })} />
        </div>
      </Card>
    </>
  );
}
