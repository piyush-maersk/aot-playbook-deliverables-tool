import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortfolioSummary, useProjects } from "../api/queries";
import { useAuth } from "../auth/AuthProvider";
import { canEdit, useCurrentUser } from "../auth/useCurrentUser";
import { Badge, Button, Card, EmptyState, Loading, ProgressBar, ProgressRing, Select, fmtDateTime } from "../components/ui";
import { fmtDate } from "../domain/render";
import { PROJECT_STATUSES, type ProjectListItem } from "../domain/types";
import { NewProjectModal } from "../features/dashboard/NewProjectModal";

const STATUS_TONE: Record<string, "green" | "amber" | "grey" | "navy" | undefined> = {
  Planning: undefined, Execution: "navy", "Go Live": "green", Hypercare: "amber", "Completed (BAU)": "green", "On Hold": "grey",
};

export function HomePage() {
  const { user } = useAuth();
  const me = useCurrentUser();
  const projects = useProjects();
  const summary = usePortfolioSummary();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("All");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projects.data ?? []).filter((p) =>
      (status === "All" || p.status === status) &&
      (!q || [p.name, p.customerName, p.fbmId, p.location, p.region].some((v) => v?.toLowerCase().includes(q))));
  }, [projects.data, search, status]);

  const firstName = (me.data?.name ?? user?.name ?? "").split(" ")[0];
  const s = summary.data;

  return (
    <>
      <section className="hero">
        <div>
          <h1>Welcome{firstName ? `, ${firstName}` : ""}</h1>
          <p>Track AOT deliverables across your projects: Milestone Plan, Work Packages and Checklists.</p>
        </div>
        {canEdit(me.data) && <Button variant="on-hero" size="lg" onClick={() => setCreating(true)}>+ New project</Button>}
      </section>

      <div className="grid cols-5 mb">
        <Kpi icon="P" label="Active projects" value={s?.projects ?? "–"} />
        <Kpi icon="MP" label="Avg. milestone plan progress" value={s ? `${Math.round(s.milestonePlan.avgProgress)}%` : "–"} />
        <Kpi icon="WP" label={`Work packages (avg. ${s ? Math.round(s.workPackages.avgCompleteness) : 0}% complete)`} value={s?.workPackages.count ?? "–"} />
        <Kpi icon="!" label="Overdue milestone activities" value={s?.milestonePlan.overdue ?? "–"} tone={s && s.milestonePlan.overdue > 0 ? "red" : undefined} />
        <Kpi icon="CL" label="Checklists (coming soon)" value={s?.checklists.count ?? "–"} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 3fr) minmax(260px, 1fr)" }}>
        <div>
          <div className="row between mb">
            <h2 style={{ margin: 0 }}>Projects</h2>
            <div className="row">
              <input placeholder="Search name, customer, FbM ID, location…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 300 }} />
              <Select value={status} onChange={setStatus} options={["All", ...PROJECT_STATUSES]} style={{ width: 170 }} />
            </div>
          </div>
          {projects.isLoading ? <Loading /> : projects.error ? (
            <div className="banner error">Could not load projects: {(projects.error as Error).message}</div>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState title={projects.data?.length ? "No projects match your filters" : "No projects yet"}
                action={!projects.data?.length && canEdit(me.data) ? <Button onClick={() => setCreating(true)}>Create the first project</Button> : undefined}>
                {projects.data?.length ? "Try a different search or status." : "Create a project to start building its Milestone Plan and Work Packages."}
              </EmptyState>
            </Card>
          ) : (
            <div className="grid auto">
              {filtered.map((p) => <ProjectCard key={p.id} p={p} onOpen={() => navigate(`/projects/${p.id}`)} />)}
            </div>
          )}
        </div>
        <div className="stack">
          <Card title="Projects by status">
            <StatusBars data={s?.byStatus ?? {}} order={PROJECT_STATUSES} />
          </Card>
          <Card title="Work packages by status">
            <StatusBars data={s?.workPackages.byStatus ?? {}} order={["Draft", "In Review", "Approved", "Issued"]} />
          </Card>
        </div>
      </div>
      {creating && <NewProjectModal onClose={() => setCreating(false)} onCreated={(id) => navigate(`/projects/${id}`)} />}
    </>
  );
}

function Kpi({ icon, label, value, tone }: { icon: string; label: string; value: number | string; tone?: "red" }) {
  return (
    <Card className="flat">
      <div className="row" style={{ alignItems: "flex-start", gap: "0.8rem" }}>
        <div className="kpi"><span className="icon">{icon}</span></div>
        <div className="kpi">
          <span className="value" style={tone === "red" ? { color: "var(--red)" } : undefined}>{value}</span>
          <span className="label">{label}</span>
        </div>
      </div>
    </Card>
  );
}

function StatusBars({ data, order }: { data: Record<string, number>; order: readonly string[] }) {
  const max = Math.max(1, ...Object.values(data));
  return (
    <div className="bar-chart">
      {order.map((k) => (
        <div className="bar-row" key={k}>
          <span>{k}</span>
          <div className="progress"><span style={{ width: `${((data[k] ?? 0) / max) * 100}%` }} /></div>
          <strong style={{ textAlign: "right" }}>{data[k] ?? 0}</strong>
        </div>
      ))}
    </div>
  );
}

function ProjectCard({ p, onOpen }: { p: ProjectListItem; onOpen: () => void }) {
  const s = p.summary;
  return (
    <Card onClick={onOpen}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ marginBottom: 2 }}>{p.name}</h3>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            {[p.customerName, p.fbmId && `FbM ${p.fbmId}`, p.location, p.region].filter(Boolean).join(" · ") || "Project details not filled yet"}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
            {s?.nextMilestone && <Badge tone="grey">Next: {s.nextMilestone.key} · {fmtDate(s.nextMilestone.date)}</Badge>}
            {s?.milestonePlan.overdue > 0 && <Badge tone="red">{s.milestonePlan.overdue} overdue</Badge>}
          </div>
        </div>
        <ProgressRing value={s?.overall ?? 0} size={62} label="overall" />
      </div>
      <div className="stack" style={{ marginTop: "0.9rem", gap: "0.55rem" }}>
        <ProgressBar value={s?.milestonePlan.progress ?? 0} label={`Milestone plan · ${s?.milestonePlan.done ?? 0}/${s?.milestonePlan.tasks ?? 0} activities`} />
        <ProgressBar value={s?.workPackages.progress ?? 0} label={`Work packages · ${s?.workPackages.count ?? 0} created`} />
        <ProgressBar value={s?.checklists.progress ?? 0} label="Checklists · not defined yet" />
      </div>
      <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.7rem" }}>Updated {fmtDateTime(p.updatedAt)} by {p.updatedBy}</div>
    </Card>
  );
}
