import { Link, useParams } from "react-router-dom";
import { Badge, Card } from "../../../components/ui";
import { fmtDate } from "../../../domain/render";
import type { TemplateLibrary } from "../../../domain/templates";
import { useProjectStore } from "../../../store/projectStore";

/** Page 3 is fixed for every work package (B10); only the deadlines come from the project. */
export function DeliverablesStep({ lib }: { lib: TemplateLibrary }) {
  const { projectId = "", wpId = "" } = useParams();
  const em = useProjectStore((s) => s.doc?.artefacts.overview.engineeringMilestones) ?? {};
  return (
    <Card title="3. Deliverables" actions={<Badge tone="grey">Fixed table · B10</Badge>}>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Rows are identical in every work package. Deadlines are the engineering milestone dates – edit them in{" "}
        <Link to={`/projects/${projectId}/work-packages/${wpId}/timelines`}>Project timelines</Link>.
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th style={{ width: "12%" }}>Milestone</th><th style={{ width: "20%" }}>Phase</th><th>Task / Deliverables</th><th style={{ width: "15%" }}>Deadline</th></tr></thead>
          <tbody>
            {lib.deliverables.map((d) => (
              <tr key={d.milestoneKey}>
                <td><strong>{d.milestone}</strong></td>
                <td>{d.phase}</td>
                <td>{d.items.map((i) => <div key={i}>• {i}</div>)}</td>
                <td>{em[d.milestoneKey] ? fmtDate(em[d.milestoneKey]) : <span style={{ color: "#b06b00", fontWeight: 600 }}>[DD/MM/YYYY]</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
