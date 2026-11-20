import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useMatch, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { canEdit, useCurrentUser } from "../auth/useCurrentUser";
import { Badge, Button, Card, Loading, ProgressBar, ProgressRing, Select, initials } from "../components/ui";
import { milestonePlanProgress, workPackageCompleteness } from "../domain/progress";
import { PROJECT_STATUSES } from "../domain/types";
import { usePresence } from "../features/presence/usePresence";
import { VersionsDrawer } from "../features/versions/VersionsDrawer";
import { MODULES } from "../modules/_registry";
import { useProjectStore } from "../store/projectStore";
import { SaveIndicator } from "./SaveIndicator";

export function ProjectPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useCurrentUser();
  const { doc, load, update, error, saveState, setReadonly } = useProjectStore();
  const inEditor = useMatch("/projects/:projectId/work-packages/:wpId/*");
  const [showVersions, setShowVersions] = useState(false);
  const others = usePresence(projectId, saveState === "dirty" || saveState === "saving" ? "editing" : "viewing");

  useEffect(() => {
    void load(projectId);
    return () => {
      // Flush pending edits; the next load() resets the store, so no async reset here.
      void useProjectStore.getState().saveNow().finally(() => {
        void qc.invalidateQueries({ queryKey: ["projects"] });
        void qc.invalidateQueries({ queryKey: ["reports"] });
      });
    };
  }, [projectId, load, qc]);

  useEffect(() => {
    if (me.data && !canEdit(me.data)) setReadonly(true);
  }, [me.data, setReadonly]);

  const stats = useMemo(() => {
    if (!doc) return null;
    const ms = milestonePlanProgress(doc.artefacts.milestonePlan.activities);
    const wps = doc.artefacts.workPackages.map((w) => workPackageCompleteness(w, doc.artefacts.overview));
    const wpAvg = wps.length ? wps.reduce((a, b) => a + b, 0) / wps.length : 0;
    return { ms, wpAvg, wpCount: wps.length, overall: wps.length ? (ms.progress + wpAvg) / 2 : ms.progress };
  }, [doc]);

  if (error) return <div className="banner error">{error} – <Link to="/">back to projects</Link></div>;
  if (!doc || !stats) return <Loading text="Opening project…" />;
  const d = doc.artefacts.overview.projectDetails;

  const remove = async () => {
    if (!confirm(`Delete project "${doc.project.name}"? It can be restored by an Admin.`)) return;
    await api(`/projects/${projectId}`, { method: "DELETE" });
    await qc.invalidateQueries({ queryKey: ["projects"] });
    navigate("/");
  };

  return (
    <>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <Link to="/" className="muted" style={{ fontSize: "0.85rem" }}>← All projects</Link>
          <div className="row" style={{ marginTop: 4 }}>
            <input
              aria-label="Project name"
              value={doc.project.name}
              onChange={(e) => update((x) => { x.project.name = e.target.value; })}
              style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--navy)", border: "1px solid transparent", background: "transparent", padding: "0 4px", width: "auto", minWidth: 320 }}
            />
            <Select value={doc.project.status} onChange={(v) => update((x) => { x.project.status = v; })} options={PROJECT_STATUSES} style={{ width: 170 }} />
          </div>
          <div className="muted" style={{ paddingLeft: 4 }}>
            {[d.customerName, d.fbmId && `FbM ID ${d.fbmId}`, d.siteId && `Site ${d.siteId}`, d.location, d.region].filter(Boolean).join(" · ") || "Add project details under Project Information"}
          </div>
        </div>
        <div className="row">
          {others.length > 0 && (
            <div className="row" title={others.map((o) => `${o.name} (${o.mode})`).join(", ")}>
              <div className="avatars">{others.slice(0, 4).map((o) => <span key={o.email} className={`avatar ${o.mode}`}>{initials(o.name)}</span>)}</div>
              <small>{others.some((o) => o.mode === "editing") ? `${others.find((o) => o.mode === "editing")!.name} is editing` : `${others.length} viewing`}</small>
            </div>
          )}
          <SaveIndicator />
          <Button variant="secondary" size="sm" onClick={() => setShowVersions(true)}>Version history</Button>
          {canEdit(me.data) && <Button variant="danger" size="sm" onClick={() => void remove()}>Delete</Button>}
        </div>
      </div>

      {!inEditor && (
        <div className="grid cols-4 mt">
          <Card className="flat">
            <div className="row" style={{ gap: "1rem" }}>
              <ProgressRing value={stats.overall} size={76} label="overall" />
              <div>
                <h3 style={{ margin: 0 }}>Deliverables progress</h3>
                <small>Average of milestone plan and work package completeness</small>
              </div>
            </div>
          </Card>
          {MODULES.map((m) => (
            <Card key={m.key} className="flat" onClick={() => navigate(m.path)}>
              <div className="row between"><h3 style={{ margin: 0 }}>{m.label}</h3>{!m.available && <Badge tone="grey">Coming soon</Badge>}</div>
              {m.key === "milestonePlan" && (
                <>
                  <ProgressBar value={stats.ms.progress} label={`${stats.ms.done}/${stats.ms.tasks} activities done`} />
                  {stats.ms.overdue > 0 && <div style={{ marginTop: 6 }}><Badge tone="red">{stats.ms.overdue} overdue</Badge></div>}
                </>
              )}
              {m.key === "workPackages" && <ProgressBar value={stats.wpAvg} label={`${stats.wpCount} work package${stats.wpCount === 1 ? "" : "s"} · avg. completeness`} />}
              {m.key === "checklists" && <ProgressBar value={0} label="No checklist defined yet" />}
            </Card>
          ))}
        </div>
      )}

      <nav className="tabs">
        <NavLink to="info">Project Information</NavLink>
        {MODULES.map((m) => <NavLink key={m.key} to={m.path}>{m.label}</NavLink>)}
        <NavLink to="activity">Activity</NavLink>
      </nav>
      <ConflictBanner />
      <Outlet />
      {showVersions && <VersionsDrawer projectId={projectId} onClose={() => setShowVersions(false)} />}
    </>
  );
}

function ConflictBanner() {
  const { saveState, conflict, reloadFromServer, overwriteServer, recovered } = useProjectStore();
  if (saveState === "conflict" && conflict) {
    return (
      <div className="banner warn mb">
        <span><strong>{conflict.updatedBy}</strong> saved a newer version (rev. {conflict.revision}). Your latest edits are not saved.</span>
        <div className="row">
          <Button variant="secondary" size="sm" onClick={() => void reloadFromServer()}>Discard mine and reload</Button>
          <Button size="sm" onClick={() => void overwriteServer()}>Keep mine (overwrite)</Button>
        </div>
      </div>
    );
  }
  if (saveState === "deleted") return <div className="banner error mb">This project was deleted by another user. Changes can no longer be saved.</div>;
  if (saveState === "readonly") return <div className="banner mb">You have the Viewer role – this project is read-only.</div>;
  if (recovered) return <div className="banner mb">Unsaved changes from your previous session were recovered and are being saved.</div>;
  return null;
}
