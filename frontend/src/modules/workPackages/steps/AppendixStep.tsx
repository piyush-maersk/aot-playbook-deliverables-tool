import { useState } from "react";
import { useDocuments } from "../../../api/queries";
import { Badge, Button, Card, Field, Modal, TextArea, TextInput } from "../../../components/ui";
import { uid } from "../../../domain/factory";
import { buildAppendix, NOT_APPLICABLE } from "../../../domain/render";
import type { TemplateLibrary } from "../../../domain/templates";
import type { AppendixAdditions, ExtractedBomRow } from "../../../domain/types";
import { useWorkPackage } from "../useWorkPackage";

const A7: { key: keyof AppendixAdditions; label: string; target: string; hint: string }[] = [
  { key: "portUrlWhitelist", label: "PORT_URL_WHITELIST", target: "Appendix D", hint: "Ports, URLs and whitelisting – pasted exactly as it should appear" },
  { key: "barcodeRfidStandards", label: "BARCODE_RFID_STANDARDS", target: "Appendix E", hint: "Barcode symbology, labels, SSCC/GS1, RFID tag/chip/frequency" },
  { key: "diagramAndDocumentLinks", label: "DIAGRAM_AND_DOCUMENT_LINKS", target: "Appendix J", hint: "SharePoint / Confluence links to diagrams and documents" },
  { key: "otherAppendixNotes", label: "OTHER_APPENDIX_NOTES", target: "end of Appendix J", hint: "Any other appendix notes" },
];

export function AppendixStep({ wpId, projectId, lib }: { wpId: string; projectId: string; lib: TemplateLibrary }) {
  const { wp, doc, updateWp, readOnly } = useWorkPackage(wpId);
  const docs = useDocuments(projectId);
  const [importing, setImporting] = useState(false);
  if (!wp || !doc) return null;
  const sections = buildAppendix(wp, lib, doc.artefacts.overview, docs.data ?? []);

  return (
    <>
      <Card title="4.1 Appendix A: Hardware Bill of Materials & Quantities" actions={
        !readOnly && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setImporting(true)}>Import from documents</Button>
            <Button size="sm" onClick={() => updateWp((w) => { w.bom.push({ id: uid(), category: "", hardwareName: "", model: "", quantity: "", templateCode: w.templateCodes[0] ?? "", source: "" }); })}>+ Add row</Button>
          </>
        )
      }>
        <div className="row mb">
          <strong style={{ color: "var(--navy)" }}>A6 · BOM quantity source:</strong>
          {(["ESTIMATION_DETAILS", "SCOPE_OF_WORK"] as const).map((s) => (
            <label key={s} className="check">
              <input type="radio" disabled={readOnly} checked={wp.bomQuantitySource === s} onChange={() => updateWp((w) => { w.bomQuantitySource = s; })} />
              {s === "ESTIMATION_DETAILS" ? "Estimation_Details sheet (default)" : "Scope_Of_Work sheet"}
            </label>
          ))}
        </div>
        <p className="muted" style={{ fontSize: "0.82rem" }}>
          Hardware (CAPEX) and licences with quantity &gt; 0 only. Exclude installation, monthly fees, hosting, services, support, travel and spare kits. Never enter prices.
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th style={{ width: "6%" }}>#</th><th style={{ width: "22%" }}>Category</th><th style={{ width: "34%" }}>Hardware Name</th><th style={{ width: "26%" }}>Model / Part Number</th><th style={{ width: "12%" }}>Quantity</th><th /></tr></thead>
            <tbody>
              {wp.bom.length === 0 && <tr><td colSpan={6} className="muted">No BOM rows yet – add them manually or import from an uploaded estimation / BOM file.</td></tr>}
              {wp.bom.map((b, i) => (
                <tr key={b.id}>
                  <td>{i + 1}</td>
                  {(["category", "hardwareName", "model", "quantity"] as const).map((k) => (
                    <td key={k}><TextInput className="input-sm" value={b[k]} disabled={readOnly} placeholder={k === "model" ? "–" : ""}
                      onChange={(v) => updateWp((w) => { w.bom[i]![k] = v; })} /></td>
                  ))}
                  <td>{!readOnly && <Button variant="ghost" size="sm" onClick={() => updateWp((w) => { w.bom.splice(i, 1); })}>✕</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="row between mt">
          <h4 style={{ margin: 0 }}>Station / Area Distribution <span className="muted" style={{ fontWeight: 400 }}>(only if a source states per-station quantities)</span></h4>
          {!readOnly && <Button size="sm" variant="secondary" onClick={() => updateWp((w) => { w.stationDistribution.push({ area: "", quantity: "" }); })}>+ Add station</Button>}
        </div>
        {wp.stationDistribution.length > 0 && (
          <div className="table-wrap mt">
            <table className="data">
              <thead><tr><th>Area / Station Type</th><th style={{ width: 160 }}>Quantity</th><th style={{ width: 50 }} /></tr></thead>
              <tbody>
                {wp.stationDistribution.map((s, i) => (
                  <tr key={i}>
                    <td><TextInput className="input-sm" value={s.area} disabled={readOnly} placeholder="e.g. Pack Stations" onChange={(v) => updateWp((w) => { w.stationDistribution[i]!.area = v; })} /></td>
                    <td><TextInput className="input-sm" value={s.quantity} disabled={readOnly} onChange={(v) => updateWp((w) => { w.stationDistribution[i]!.quantity = v; })} /></td>
                    <td>{!readOnly && <Button variant="ghost" size="sm" onClick={() => updateWp((w) => { w.stationDistribution.splice(i, 1); })}>✕</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="A7 · Appendix additions" actions={<Badge tone="grey">Pasted verbatim</Badge>}>
        <div className="grid cols-2">
          {A7.map((f) => (
            <Field key={f.key} label={`${f.label} → ${f.target}`} hint={f.hint}>
              <TextArea rows={3} value={wp.appendixAdditions[f.key]} disabled={readOnly} onChange={(v) => updateWp((w) => { w.appendixAdditions[f.key] = v; })} />
            </Field>
          ))}
        </div>
      </Card>

      {sections.filter((s) => s.letter !== "A").map((s) => (
        <Card key={s.letter} title={`${s.number} Appendix ${s.letter}: ${s.title}`} actions={
          s.placeholder === NOT_APPLICABLE ? <Badge tone="grey">Not applicable</Badge> : s.placeholder ? <Badge tone="amber">{s.placeholder}</Badge> : <Badge tone="green">Has content</Badge>
        }>
          {s.scope ? <div className="template-text mb"><strong>Scope:</strong> {s.scope}</div> : <div className="muted mb" style={{ fontSize: "0.85rem" }}>No selected template references this appendix.</div>}
          {s.letter === "J" && <div className="muted mb" style={{ fontSize: "0.85rem" }}>Lists every source document ticked in “Sources & context”, then DIAGRAM_AND_DOCUMENT_LINKS and OTHER_APPENDIX_NOTES.</div>}
          <Field label="Content" hint="Facts from the sources as bullets, ending with “(Source: <document>)”.">
            <TextArea rows={3} value={wp.appendixContent[s.letter] ?? ""} disabled={readOnly}
              placeholder={s.scope ? "• … (Source: BRD.docx)" : NOT_APPLICABLE}
              onChange={(v) => updateWp((w) => { w.appendixContent[s.letter] = v; })} />
          </Field>
        </Card>
      ))}

      {importing && (
        <ImportBomModal rows={(docs.data ?? []).flatMap((d) => d.extraction?.bom ?? [])} onClose={() => setImporting(false)}
          onImport={(rows) => {
            updateWp((w) => {
              for (const r of rows) w.bom.push({ id: uid(), category: r.category, hardwareName: r.hardwareName, model: r.model, quantity: r.quantity, templateCode: w.templateCodes[0] ?? "", source: r.source });
            });
            setImporting(false);
          }} />
      )}
    </>
  );
}

function ImportBomModal({ rows, onClose, onImport }: { rows: ExtractedBomRow[]; onClose: () => void; onImport: (rows: ExtractedBomRow[]) => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set(rows.map((_, i) => i)));
  const toggle = (i: number) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(i)) n.delete(i); else n.add(i);
    return n;
  });
  return (
    <Modal title="Import hardware rows from documents" wide onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!selected.size} onClick={() => onImport(rows.filter((_, i) => selected.has(i)))}>Import {selected.size} rows</Button>
      </>
    }>
      {!rows.length ? <p className="muted">No hardware rows were found in the uploaded documents. Upload an estimation workbook or BOM file with a Description/Hardware and Quantity column.</p> : (
        <>
          <p className="muted" style={{ fontSize: "0.85rem" }}>Select only the rows that belong to this work package's domain. Installation, services, spare kits and zero quantities were already removed.</p>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th /><th>Category</th><th>Hardware Name</th><th>Model / Part Number</th><th>Quantity</th><th>Source</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} /></td>
                    <td>{r.category || "–"}</td><td>{r.hardwareName}</td><td>{r.model}</td><td>{r.quantity}</td><td className="muted">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
