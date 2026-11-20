import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client";
import { Button, Drawer, Loading, fmtDateTime } from "../../components/ui";
import type { ProjectDocument } from "../../domain/types";
import { useProjectStore } from "../../store/projectStore";

interface Version {
  revision: number;
  savedAt: string;
  savedBy: string;
}

/** Version history: list, read-only preview, restore as a NEW revision (history is never rewritten). */
export function VersionsDrawer({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { revision, replaceDocument } = useProjectStore();
  const versions = useQuery({ queryKey: ["versions", projectId, revision], queryFn: () => api<Version[]>(`/projects/${projectId}/versions`) });
  const [preview, setPreview] = useState<{ rev: number; doc: ProjectDocument } | null>(null);

  const open = async (rev: number) => setPreview({ rev, doc: await api<ProjectDocument>(`/projects/${projectId}/versions/${rev}`) });

  return (
    <Drawer title="Version history" onClose={onClose}>
      <p className="muted" style={{ fontSize: "0.85rem" }}>Saves by the same person within 10 minutes are merged into one version.</p>
      {versions.isLoading ? <Loading /> : (
        <div className="stack">
          {versions.data?.map((v) => (
            <div key={v.revision} className="card flat" style={{ padding: "0.7rem 0.9rem" }}>
              <div className="row between">
                <div>
                  <strong>Revision {v.revision}</strong> {v.revision === revision && <span className="badge green">current</span>}
                  <div className="muted" style={{ fontSize: "0.8rem" }}>{fmtDateTime(v.savedAt)} · {v.savedBy}</div>
                </div>
                {v.revision !== revision && <Button variant="secondary" size="sm" onClick={() => void open(v.revision)}>View</Button>}
              </div>
              {preview?.rev === v.revision && (
                <div className="mt">
                  <div className="muted" style={{ fontSize: "0.82rem" }}>
                    {preview.doc.project.name} · {preview.doc.artefacts.workPackages.length} work packages ·{" "}
                    {preview.doc.artefacts.milestonePlan.activities.length} milestone activities
                  </div>
                  <Button size="sm" className="mt" onClick={() => {
                    if (confirm(`Restore revision ${v.revision}? It will be saved as a new revision.`)) {
                      replaceDocument(preview.doc);
                      onClose();
                    }
                  }}>Restore this version</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
