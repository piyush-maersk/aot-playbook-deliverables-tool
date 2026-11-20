import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api, fetchBlobUrl } from "../../api/client";
import { useDocuments } from "../../api/queries";
import { Badge, Button, Card, EmptyState, Select, fmtDateTime } from "../../components/ui";
import { DOC_ROLES, type DocRole, type SourceDocument } from "../../domain/types";
import { FIELD_LABELS } from "../../modules/overview/fields";

const ROLE_HINT: Record<DocRole, string> = {
  Estimation: "Estimation workbook (.xlsx) – customer, site, area, hardware quantities",
  BOM: "BOM file (.xlsx) – hardware models and quantities",
  Concept: "Concept Design – architecture and layout details",
  BRD: "BRD – address, operating hours, operation flows",
  Layout: "Floor layout / heatmap image",
  Other: "Any other project document",
};

function guessRole(name: string): DocRole {
  const n = name.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(n) || n.includes("layout")) return "Layout";
  if (n.includes("estimat")) return "Estimation";
  if (n.includes("bom") || n.includes("bill of material")) return "BOM";
  if (n.includes("concept")) return "Concept";
  if (n.includes("brd") || n.includes("requirement")) return "BRD";
  return "Other";
}

export function DocumentsPanel({ projectId, readOnly }: { projectId: string; readOnly?: boolean }) {
  const qc = useQueryClient();
  const docs = useDocuments(projectId);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["documents", projectId] });

  const upload = async (files: FileList | File[]) => {
    setError("");
    for (const f of Array.from(files)) {
      setBusy((b) => b + 1);
      try {
        const form = new FormData();
        form.append("file", f);
        form.append("role", guessRole(f.name));
        await api(`/projects/${projectId}/documents`, { method: "POST", form });
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      } finally {
        setBusy((b) => b - 1);
      }
    }
    await refresh();
  };

  const changeRole = async (d: SourceDocument, role: DocRole) => {
    await api(`/projects/${projectId}/documents/${d.id}/extract`, { method: "POST", body: { role } });
    await refresh();
  };

  const remove = async (d: SourceDocument) => {
    if (!confirm(`Remove ${d.filename}?`)) return;
    await api(`/projects/${projectId}/documents/${d.id}`, { method: "DELETE" });
    await refresh();
  };

  const download = async (d: SourceDocument) => {
    const url = await fetchBlobUrl(`/projects/${projectId}/documents/${d.id}/file`);
    const a = document.createElement("a");
    a.href = url;
    a.download = d.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <Card title="Source documents" actions={<Badge tone="grey">BRD · Estimation · BOM · Concept · Layout</Badge>}>
      {!readOnly && (
        <div className={`dropzone ${over ? "over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void upload(e.dataTransfer.files); }}>
          <strong style={{ color: "var(--navy)" }}>Drop files here</strong> or{" "}
          <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>Choose files</Button>
          <input ref={input} type="file" multiple hidden accept=".xlsx,.xlsm,.docx,.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.csv,.txt,.pptx,.vsdx"
            onChange={(e) => e.target.files && void upload(e.target.files)} />
          <div style={{ fontSize: "0.8rem", marginTop: 6 }}>
            Word, Excel and PDF files are scanned for template fields (customer, FbM ID, site, dates…) and hardware BOM rows. Costs and prices are never extracted.
          </div>
          {busy > 0 && <div className="row" style={{ justifyContent: "center", marginTop: 8 }}><span className="spinner" /> Uploading & extracting…</div>}
        </div>
      )}
      {error && <div className="banner error mt">{error}</div>}
      <div className="mt">
        {!docs.data?.length ? (
          <EmptyState title="No documents yet">Upload the BRD, estimation workbook, BOM, concept design or layout to pre-fill the templates.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>File</th><th>Role (source precedence)</th><th>Extracted</th><th>Uploaded</th><th /></tr></thead>
              <tbody>
                {docs.data.map((d) => (
                  <FragmentRow key={d.id} d={d} open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)}
                    onRole={(r) => void changeRole(d, r)} onRemove={() => void remove(d)} onDownload={() => void download(d)} readOnly={readOnly} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function FragmentRow({ d, open, onToggle, onRole, onRemove, onDownload, readOnly }: {
  d: SourceDocument; open: boolean; onToggle: () => void; onRole: (r: DocRole) => void; onRemove: () => void; onDownload: () => void; readOnly?: boolean;
}) {
  const ex = d.extraction ?? { suggestions: [], bom: [], error: "", isLayoutCandidate: false, textPreview: "" };
  return (
    <>
      <tr>
        <td><button className="btn ghost sm" onClick={onDownload} title="Download">{d.filename}</button></td>
        <td style={{ minWidth: 200 }}>
          <Select value={d.role} onChange={onRole} options={DOC_ROLES} disabled={readOnly} className="input-sm" title={ROLE_HINT[d.role]} />
        </td>
        <td>
          {ex.error ? <Badge tone="red">{ex.error}</Badge> : (
            <div className="row">
              <Badge>{ex.suggestions.length} fields</Badge>
              <Badge tone="grey">{ex.bom.length} BOM rows</Badge>
              {ex.isLayoutCandidate && <Badge tone="green">layout</Badge>}
              {(ex.suggestions.length > 0 || ex.bom.length > 0) && <button className="btn ghost sm" onClick={onToggle}>{open ? "Hide" : "Details"}</button>}
            </div>
          )}
        </td>
        <td className="muted" style={{ fontSize: "0.8rem" }}>{fmtDateTime(d.uploadedAt)}<br />{d.uploadedBy}</td>
        <td>{!readOnly && <Button variant="danger" size="sm" onClick={onRemove}>Remove</Button>}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} style={{ background: "var(--blue-50)" }}>
            {ex.suggestions.length > 0 && (
              <>
                <strong>Fields found</strong>
                <ul style={{ margin: "0.3rem 0 0.6rem", paddingLeft: "1.2rem" }}>
                  {ex.suggestions.map((s, i) => <li key={i}><strong>{FIELD_LABELS[s.field] ?? s.field}:</strong> {s.value} <span className="muted">({s.label}, {s.ref})</span></li>)}
                </ul>
              </>
            )}
            {ex.bom.length > 0 && (
              <>
                <strong>Hardware rows found</strong> <span className="muted">(import them in a work package → Appendix)</span>
                <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.2rem" }}>
                  {ex.bom.slice(0, 12).map((b, i) => <li key={i}>{b.quantity} × {b.hardwareName}{b.model && b.model !== "–" ? ` (${b.model})` : ""}{b.category ? ` – ${b.category}` : ""}</li>)}
                  {ex.bom.length > 12 && <li className="muted">…and {ex.bom.length - 12} more</li>}
                </ul>
              </>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
