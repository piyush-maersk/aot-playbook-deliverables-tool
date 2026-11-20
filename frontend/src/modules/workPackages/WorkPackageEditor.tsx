import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { useTemplateLibrary } from "../../api/queries";
import { Badge, Button, Loading, ProgressRing, Select } from "../../components/ui";
import { workPackageCompleteness, workPackageSections, type WpSection } from "../../domain/progress";
import { documentTitle, fileName } from "../../domain/render";
import { WP_STATUSES } from "../../domain/types";
import { FloorLayoutCard, ProjectContextCard, ProjectDetailsForm, TimelinesForm } from "../overview/OverviewForms";
import { AppendixStep } from "./steps/AppendixStep";
import { DeliverablesStep } from "./steps/DeliverablesStep";
import { DocumentControlStep } from "./steps/DocumentControlStep";
import { PreviewStep } from "./steps/PreviewStep";
import { RequirementsStep } from "./steps/RequirementsStep";
import { ScopeStep } from "./steps/ScopeStep";
import { SetupStep } from "./steps/SetupStep";
import { SourcesStep } from "./steps/SourcesStep";
import { useWorkPackage } from "./useWorkPackage";

const STEPS: { key: string; label: string; ref: string; section?: WpSection }[] = [
  { key: "setup", label: "Setup", ref: "A1–A2", section: "setup" },
  { key: "sources", label: "Sources & context", ref: "A8" },
  { key: "document-control", label: "Document control", ref: "A3", section: "documentControl" },
  { key: "overview", label: "Project overview", ref: "A4 · Page 1", section: "projectOverview" },
  { key: "timelines", label: "Project timelines", ref: "A5 · Page 1", section: "timelines" },
  { key: "scope", label: "1. Scope of work", ref: "Page 1", section: "scope" },
  { key: "requirements", label: "2. Requirements", ref: "Page 2", section: "requirements" },
  { key: "deliverables", label: "3. Deliverables", ref: "Page 3" },
  { key: "appendix", label: "4. Appendix", ref: "A6–A7 · Page 4", section: "appendix" },
  { key: "preview", label: "Preview & gaps", ref: "Review" },
];

export function WorkPackageEditor() {
  const { projectId = "", wpId = "", step = "setup" } = useParams();
  const navigate = useNavigate();
  const lib = useTemplateLibrary();
  const { wp, doc, updateWp, readOnly } = useWorkPackage(wpId);
  if (!doc || lib.isLoading) return <Loading />;
  if (!lib.data) return <div className="banner error">Template library could not be loaded.</div>;
  if (!wp) return <div className="banner error">Work package {wpId} not found. <Link to="..">Back to work packages</Link></div>;

  const sections = workPackageSections(wp, doc.artefacts.overview);
  const pct = workPackageCompleteness(wp, doc.artefacts.overview);
  const idx = Math.max(0, STEPS.findIndex((s) => s.key === step));
  const current = STEPS[idx]!;
  const base = `/projects/${projectId}/work-packages/${wpId}`;

  return (
    <div className="editor">
      <aside className="stepper">
        <Link to={`/projects/${projectId}/work-packages`} className="muted" style={{ fontSize: "0.85rem", padding: "0 0.7rem 0.5rem" }}>← All work packages</Link>
        <div className="card flat" style={{ padding: "0.8rem", marginBottom: "0.5rem" }}>
          <div className="row" style={{ gap: "0.75rem", flexWrap: "nowrap" }}>
            <ProgressRing value={pct} size={56} />
            <div style={{ minWidth: 0 }}>
              <strong style={{ color: "var(--navy)" }}>{wp.id}</strong>
              <div className="muted" style={{ fontSize: "0.78rem" }}>{wp.mode} · {wp.templateCodes.join(", ") || "no template"}</div>
            </div>
          </div>
          <Select className="input-sm mt" value={wp.status} disabled={readOnly} onChange={(v) => updateWp((w) => { w.status = v; })} options={WP_STATUSES} aria-label="Work package status" />
        </div>
        {STEPS.map((s, i) => {
          const v = s.section ? sections[s.section] : undefined;
          return (
            <NavLink key={s.key} to={`${base}/${s.key}`} className={() => (i === idx ? "active" : "")}>
              <span className={`num ${v === 1 ? "done" : v && v > 0 ? "partial" : ""}`}>{v === 1 ? "✓" : i + 1}</span>
              <span>{s.label}</span>
              <span className="meta">{v !== undefined && v < 1 ? `${Math.round(v * 100)}%` : s.ref}</span>
            </NavLink>
          );
        })}
      </aside>

      <section className="stack" style={{ gap: "1rem", minWidth: 0 }}>
        <div className="card flat" style={{ padding: "0.8rem 1rem" }}>
          <div className="row between">
            <div style={{ minWidth: 0 }}>
              <div className="muted" style={{ fontSize: "0.75rem" }}>Document title</div>
              <strong style={{ color: "var(--navy)" }}>{documentTitle(wp, lib.data)}</strong>
              <div className="muted" style={{ fontSize: "0.75rem" }}>File: {fileName(wp, lib.data, doc.artefacts.overview.projectDetails)}</div>
            </div>
            <Badge tone="grey">{current.ref}</Badge>
          </div>
        </div>

        {current.key === "setup" && <SetupStep wpId={wpId} lib={lib.data} />}
        {current.key === "sources" && <SourcesStep wpId={wpId} projectId={projectId} />}
        {current.key === "document-control" && <DocumentControlStep wpId={wpId} />}
        {current.key === "overview" && (
          <>
            <div className="banner">These project details are shared by all work packages of this project and the Project Information tab.</div>
            <ProjectDetailsForm projectId={projectId} />
            <FloorLayoutCard projectId={projectId} />
          </>
        )}
        {current.key === "timelines" && <TimelinesForm projectId={projectId} />}
        {current.key === "scope" && <ScopeStep wpId={wpId} lib={lib.data} />}
        {current.key === "requirements" && <RequirementsStep wpId={wpId} lib={lib.data} />}
        {current.key === "deliverables" && <DeliverablesStep lib={lib.data} />}
        {current.key === "appendix" && <AppendixStep wpId={wpId} projectId={projectId} lib={lib.data} />}
        {current.key === "preview" && <PreviewStep wpId={wpId} projectId={projectId} lib={lib.data} />}
        {current.key === "sources" && <ProjectContextCard />}

        <div className="row between">
          <Button variant="secondary" disabled={idx === 0} onClick={() => navigate(`${base}/${STEPS[idx - 1]!.key}`)}>← Previous</Button>
          {idx < STEPS.length - 1 && <Button onClick={() => navigate(`${base}/${STEPS[idx + 1]!.key}`)}>Next: {STEPS[idx + 1]!.label} →</Button>}
        </div>
      </section>
    </div>
  );
}
