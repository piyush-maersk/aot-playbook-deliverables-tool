import { Fragment, useState } from "react";
import { Badge, Button, Card, Checkbox, Select, TextArea, TextInput } from "../../../components/ui";
import { sortCodes, uid, wordCount } from "../../../domain/factory";
import { buildRequirements, remapAppendixRefs } from "../../../domain/render";
import type { TemplateLibrary } from "../../../domain/templates";
import type { Requirement } from "../../../domain/types";
import { useWorkPackage } from "../useWorkPackage";

const ACTION_HELP: Record<string, string> = {
  KEEP: "Applies; no project fact adds information → template text verbatim.",
  TAILOR: "Applies and a source has a related fact → verbatim + one “For this project, …” sentence (max 35 words).",
  EXCLUDE: "Only if every estimation row for the subject is 0 and nothing else mentions it, or a source marks it out of scope. When in doubt → KEEP.",
};

export function RequirementsStep({ wpId, lib }: { wpId: string; lib: TemplateLibrary }) {
  const { wp, updateWp, readOnly } = useWorkPackage(wpId);
  const [preview, setPreview] = useState(false);
  if (!wp) return null;
  const codes = sortCodes(wp.templateCodes);
  const counts = { KEEP: 0, TAILOR: 0, EXCLUDE: 0, ADD: 0 } as Record<string, number>;
  wp.requirements.forEach((r) => counts[r.action]++);
  const issues = wp.requirements.filter((r) =>
    (r.action === "TAILOR" && (!r.tailoring.trim() || wordCount(r.tailoring) > 35)) ||
    (r.action === "ADD" && (!r.text.trim() || wordCount(r.text) > 35)) ||
    ((r.action === "EXCLUDE" || r.action === "TAILOR" || r.action === "ADD") && !r.source.trim()));

  const patch = (key: string, changes: Partial<Requirement>) => updateWp((w) => {
    const r = w.requirements.find((x) => x.key === key);
    if (r) Object.assign(r, changes);
  });
  const add = (code: string, kind: "FR" | "TR") => updateWp((w) => {
    const req: Requirement = { key: `ADD-${uid()}`, templateCode: code, kind, originalId: "", text: "The solution shall ", action: "ADD", tailoring: "", source: "" };
    const lastIdx = w.requirements.map((r) => r.templateCode === code && r.kind === kind).lastIndexOf(true);
    w.requirements.splice(lastIdx + 1, 0, req);
  });
  const remove = (key: string) => updateWp((w) => { w.requirements = w.requirements.filter((r) => r.key !== key); });

  return (
    <>
      <Card title="2. Requirements – decisions" actions={
        <>
          {Object.entries(counts).map(([k, v]) => <Badge key={k} tone={k === "EXCLUDE" ? "red" : k === "TAILOR" ? "amber" : k === "ADD" ? "green" : undefined}>{k} {v}</Badge>)}
          <Button size="sm" variant="secondary" onClick={() => setPreview((p) => !p)}>{preview ? "Edit decisions" : "Preview numbering"}</Button>
        </>
      }>
        <div className="grid cols-3" style={{ fontSize: "0.82rem" }}>
          {Object.entries(ACTION_HELP).map(([k, v]) => <div key={k}><strong>{k}</strong> – <span className="muted">{v}</span></div>)}
        </div>
        <div className="muted" style={{ fontSize: "0.82rem", marginTop: 6 }}>
          <strong>ADD</strong> – only when a source states an explicit need not covered by any template requirement: “The solution shall &lt;need&gt;.” (max 35 words, source required). Appendix references are rewritten to the canonical Appendix A–J automatically.
        </div>
      </Card>

      {preview ? (
        (["FR", "TR"] as const).map((kind) => (
          <Card key={kind} title={kind === "FR" ? "2.1 Functional Requirements" : "2.2 Technical Requirements"}>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th style={{ width: 110 }}>ID</th><th>Requirement</th></tr></thead>
                <tbody>
                  {buildRequirements(wp, lib, kind).map((r, i) => r.header
                    ? <tr key={i} className="group"><td colSpan={2}>{r.text}</td></tr>
                    : <tr key={i}><td><strong>{r.id}</strong></td><td>{r.text}</td></tr>)}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      ) : (
        codes.map((code) => {
          const t = lib.templates.find((x) => x.code === code);
          if (!t) return null;
          return (
            <Card key={code} title={`${code} · ${t.name}`}>
              {(["FR", "TR"] as const).map((kind) => (
                <Fragment key={kind}>
                  <div className="row between" style={{ margin: "0.5rem 0" }}>
                    <h4 style={{ margin: 0 }}>{kind === "FR" ? "Functional requirements" : "Technical requirements"}</h4>
                    {!readOnly && <Button size="sm" variant="secondary" onClick={() => add(code, kind)}>+ Add {kind}</Button>}
                  </div>
                  <div className="table-wrap mb">
                    <table className="data">
                      <thead><tr><th style={{ width: 80 }}>Template ID</th><th>Requirement</th><th style={{ width: 130 }}>Action</th><th style={{ width: 230 }}>Source</th></tr></thead>
                      <tbody>
                        {wp.requirements.filter((r) => r.templateCode === code && r.kind === kind).map((r) => {
                          const words = wordCount(r.action === "ADD" ? r.text : r.tailoring);
                          return (
                            <tr key={r.key} className={r.action === "EXCLUDE" ? "excluded" : undefined}>
                              <td><strong>{r.originalId || "new"}</strong></td>
                              <td>
                                {r.action === "ADD" ? (
                                  <TextArea rows={2} value={r.text} disabled={readOnly} onChange={(v) => patch(r.key, { text: v })} />
                                ) : (
                                  <div>{remapAppendixRefs(r.text, t)}</div>
                                )}
                                {r.action === "TAILOR" && (
                                  <TextArea rows={2} className="mt" value={r.tailoring} disabled={readOnly} placeholder="For this project, …"
                                    onChange={(v) => patch(r.key, { tailoring: v })} style={{ marginTop: 6 }} />
                                )}
                                {(r.action === "TAILOR" || r.action === "ADD") && (
                                  <small style={{ color: words > 35 ? "var(--red)" : "var(--muted)" }}>{words}/35 words · no quantities, model numbers or costs</small>
                                )}
                              </td>
                              <td>
                                {r.action === "ADD" ? (
                                  <div className="stack" style={{ gap: 4 }}>
                                    <Badge tone="green">ADD</Badge>
                                    {!readOnly && <Button variant="ghost" size="sm" onClick={() => remove(r.key)}>Remove</Button>}
                                  </div>
                                ) : (
                                  <Select className="input-sm" value={r.action} disabled={readOnly} onChange={(v) => patch(r.key, { action: v })} options={["KEEP", "TAILOR", "EXCLUDE"] as const} />
                                )}
                              </td>
                              <td>
                                {r.action !== "KEEP" && (
                                  <TextInput className="input-sm" value={r.source} disabled={readOnly} placeholder="Source document / reason" onChange={(v) => patch(r.key, { source: v })}
                                    style={!r.source.trim() ? { borderColor: "var(--amber)" } : undefined} />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Fragment>
              ))}
            </Card>
          );
        })
      )}

      <Card>
        {issues.length > 0 && <div className="banner warn mb">{issues.length} requirement decision(s) need attention: TAILOR needs a sentence of max 35 words; TAILOR, EXCLUDE and ADD need a source.</div>}
        <Checkbox checked={wp.requirementsReviewed} disabled={readOnly || issues.length > 0} label="All functional and technical requirements reviewed"
          onChange={(on) => updateWp((w) => { w.requirementsReviewed = on; })} />
      </Card>
    </>
  );
}
