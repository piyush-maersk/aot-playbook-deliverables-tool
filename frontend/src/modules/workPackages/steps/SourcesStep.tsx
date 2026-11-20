import { Link } from "react-router-dom";
import { useDocuments } from "../../../api/queries";
import { Badge, Card, Checkbox, EmptyState } from "../../../components/ui";
import { DOC_ROLES } from "../../../domain/types";
import { useWorkPackage } from "../useWorkPackage";

export function SourcesStep({ wpId, projectId }: { wpId: string; projectId: string }) {
  const { wp, updateWp, readOnly } = useWorkPackage(wpId);
  const docs = useDocuments(projectId);
  if (!wp) return null;
  const sorted = [...(docs.data ?? [])].sort((a, b) => DOC_ROLES.indexOf(a.role) - DOC_ROLES.indexOf(b.role));

  return (
    <Card title="Source documents for this work package" actions={<Badge tone="grey">Listed in Appendix J</Badge>}>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Tick the project documents this work package is based on. When sources conflict the higher one wins: values you type → BOM → Estimation → Concept Design → BRD → project context → other.
        Upload or re-classify documents in <Link to={`/projects/${projectId}/info`}>Project Information</Link>.
      </p>
      {!sorted.length ? <EmptyState title="No documents uploaded for this project yet" /> : (
        <div className="stack">
          {sorted.map((d) => (
            <div key={d.id} className="row between card flat" style={{ padding: "0.55rem 0.8rem" }}>
              <Checkbox disabled={readOnly} checked={wp.sourceDocumentIds.includes(d.id)} label={<span><strong>{d.filename}</strong></span>}
                onChange={(on) => updateWp((w) => {
                  w.sourceDocumentIds = on ? [...new Set([...w.sourceDocumentIds, d.id])] : w.sourceDocumentIds.filter((x) => x !== d.id);
                })} />
              <div className="row">
                <Badge>{d.role}</Badge>
                <Badge tone="grey">{d.extraction?.suggestions.length ?? 0} fields · {d.extraction?.bom.length ?? 0} BOM rows</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
