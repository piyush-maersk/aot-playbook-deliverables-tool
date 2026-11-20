import { useParams } from "react-router-dom";
import { useProjectStore } from "../../store/projectStore";
import { DocumentsPanel } from "../../features/documents/DocumentsPanel";
import { FloorLayoutCard, ProjectContextCard, ProjectDetailsForm, TimelinesForm } from "./OverviewForms";

/** Project Information tab: everything collected once and shared by all deliverables. */
export function ProjectInformation() {
  const { projectId = "" } = useParams();
  const readOnly = useProjectStore((s) => s.saveState === "readonly");
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <DocumentsPanel projectId={projectId} readOnly={readOnly} />
      <ProjectDetailsForm projectId={projectId} />
      <TimelinesForm projectId={projectId} />
      <div className="grid cols-2">
        <FloorLayoutCard projectId={projectId} />
        <ProjectContextCard />
      </div>
    </div>
  );
}
