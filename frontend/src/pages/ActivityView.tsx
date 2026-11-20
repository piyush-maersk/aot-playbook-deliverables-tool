import { useParams } from "react-router-dom";
import { useAudit } from "../api/queries";
import { Card, EmptyState, Loading, fmtDateTime } from "../components/ui";

export function ActivityView() {
  const { projectId = "" } = useParams();
  const audit = useAudit(projectId);
  if (audit.isLoading) return <Loading />;
  return (
    <Card title="Activity log">
      {!audit.data?.length ? <EmptyState title="No activity yet" /> : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Item</th><th>Details</th></tr></thead>
            <tbody>
              {audit.data.map((a, i) => (
                <tr key={i}><td>{fmtDateTime(a.ts)}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.entity} {a.entityId.length > 12 ? "" : a.entityId}</td><td>{a.details}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
