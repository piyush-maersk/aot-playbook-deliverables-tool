import { Fragment, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Select, TextArea, TextInput } from "../../components/ui";
import { newActivity } from "../../domain/factory";
import { isOverdue, milestonePlanProgress, milestoneRag } from "../../domain/progress";
import { fmtDate } from "../../domain/render";
import type { MilestoneActivity } from "../../domain/types";
import { useProjectStore } from "../../store/projectStore";

// Phases and milestones of the AOT Milestone Plan workbook.
export const PHASES = ["Sales Stage", "Initiate", "Planning", "Execute", "Hypercare", "Complete"];
export const MILESTONES = [
  { key: "", name: "Pre-sales (no milestone)", phase: "Sales Stage" },
  { key: "MS0", name: "MS0 – Kick-Off", phase: "Initiate" },
  { key: "MS1.1", name: "MS1.1 – Provision of Requirements", phase: "Planning" },
  { key: "MS1.2", name: "MS1.2 – Provision of Suppliers", phase: "Planning" },
  { key: "MS1.3", name: "MS1.3 – Provision of Designs", phase: "Planning" },
  { key: "MS2", name: "MS2 – FAT (Factory Acceptance)", phase: "Execute" },
  { key: "MS3", name: "MS3 – SAT (Unit Testing & Commissioning)", phase: "Execute" },
  { key: "MS4", name: "MS4 – UAT (Integration & User Acceptance)", phase: "Execute" },
  { key: "MS5", name: "MS5 – Hypercare", phase: "Hypercare" },
  { key: "MS6", name: "MS6 – BAU (Business as Usual)", phase: "Complete" },
];

const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1;

export function MilestonePlanView() {
  const { doc, update, saveState } = useProjectStore();
  const readOnly = saveState === "readonly";
  const [phase, setPhase] = useState("All");
  const [milestone, setMilestone] = useState("All");
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const activities = doc?.artefacts.milestonePlan.activities ?? [];
  const targets = doc?.artefacts.overview.engineeringMilestones ?? {};
  const workPackages = doc?.artefacts.workPackages ?? [];

  const groupStatus = useMemo(() => {
    const out: Record<string, number | null> = {};
    activities.forEach((a, i) => {
      if (!a.isGroup) return;
      const kids: MilestoneActivity[] = [];
      for (let j = i + 1; j < activities.length && !activities[j]!.isGroup && activities[j]!.milestone === a.milestone; j++) kids.push(activities[j]!);
      out[a.id] = kids.length ? kids.reduce((s, k) => s + (Number(k.status) || 0), 0) / kids.length : null;
    });
    return out;
  }, [activities]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter((a) =>
      (phase === "All" || a.phase === phase) && (milestone === "All" || a.milestone === milestone) &&
      (!overdueOnly || isOverdue(a)) &&
      (!q || [a.activity, a.deliverables, a.responsibleTeam, a.responsible, a.comments].some((v) => v?.toLowerCase().includes(q))));
  }, [activities, phase, milestone, search, overdueOnly]);

  if (!doc) return null;
  const overall = milestonePlanProgress(activities);

  const patch = (id: string, changes: Partial<MilestoneActivity>) => update((x) => {
    const a = x.artefacts.milestonePlan.activities.find((r) => r.id === id);
    if (!a) return;
    Object.assign(a, changes);
    if (("startDate" in changes || "endDate" in changes) && a.startDate && a.endDate && a.endDate >= a.startDate) {
      a.planDuration = String(daysBetween(a.startDate, a.endDate));
    }
  });

  const addTo = (ms: string, ph: string) => {
    const created = newActivity(activities, ph, ms);
    update((x) => {
      const list = x.artefacts.milestonePlan.activities;
      let insertAt = list.length;
      for (let i = list.length - 1; i >= 0; i--) if (list[i]!.milestone === ms && list[i]!.phase === ph) { insertAt = i + 1; break; }
      list.splice(insertAt, 0, created);
    });
    setOpen(created.id);
  };

  const remove = (id: string) => update((x) => {
    x.artefacts.milestonePlan.activities = x.artefacts.milestonePlan.activities.filter((a) => a.id !== id);
  });

  const msSummary = MILESTONES.filter((m) => m.key).map((m) => {
    const tasks = activities.filter((a) => a.milestone === m.key && !a.isGroup);
    const progress = tasks.length ? tasks.reduce((s, a) => s + (Number(a.status) || 0), 0) / tasks.length : 0;
    return { ...m, tasks: tasks.length, progress, target: targets[m.key] ?? "", rag: milestoneRag(targets[m.key] ?? "", progress) };
  });

  let lastPhase = "";
  let lastMs = "__";

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <Card title="Milestones" actions={<span className="muted">Overall {Math.round(overall.progress)}% · {overall.done}/{overall.tasks} activities · {overall.overdue} overdue</span>}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))" }}>
          {msSummary.map((m) => (
            <div key={m.key} className={`card flat clickable ${milestone === m.key ? "selected" : ""}`} style={{ padding: "0.7rem" }}
              onClick={() => setMilestone(milestone === m.key ? "All" : m.key)}>
              <div className="row between"><strong style={{ color: "var(--navy)" }}>{m.key}</strong><span className={`dot ${m.rag}`} title={`RAG: ${m.rag}`} /></div>
              <div className="muted" style={{ fontSize: "0.75rem", minHeight: 30 }}>{m.name.split("–")[1]?.trim()}</div>
              <div className="progress sm"><span style={{ width: `${m.progress}%` }} /></div>
              <div className="row between" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                <span>{Math.round(m.progress)}%</span>
                <span className="muted">{m.key === "MS0" ? "–" : m.target ? fmtDate(m.target) : "no target"}</span>
              </div>
            </div>
          ))}
        </div>
        <small className="muted">Targets come from the engineering milestone dates in Project Information. RAG: red = target passed and not complete, amber = due within 14 days and below 75 %.</small>
      </Card>

      <div className="row between">
        <div className="row">
          <Select value={phase} onChange={setPhase} options={["All", ...PHASES]} style={{ width: 160 }} aria-label="Phase" />
          <Select value={milestone} onChange={setMilestone} options={[{ value: "All", label: "All milestones" }, ...MILESTONES.map((m) => ({ value: m.key, label: m.name }))]} style={{ width: 270 }} aria-label="Milestone" />
          <input placeholder="Search activity, deliverable, owner…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }} />
          <label className="check"><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue only</label>
        </div>
      </div>

      {activities.length === 0 ? (
        <Card><EmptyState title="Milestone plan is empty" action={!readOnly && <Button onClick={() => addTo("MS0", "Initiate")}>Add first activity</Button>} /></Card>
      ) : (
        <div className="table-wrap" style={{ maxHeight: "70vh" }}>
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 30 }} />
                <th style={{ minWidth: 260 }}>Activity</th>
                <th style={{ minWidth: 180 }}>Deliverables & Workpackages</th>
                <th>Responsible Team</th>
                <th>Responsible</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th style={{ width: 130 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => {
                const rows = [];
                if (a.phase !== lastPhase) {
                  lastPhase = a.phase;
                  lastMs = "__";
                  rows.push(<tr key={`p-${a.id}`} className="phase"><td colSpan={9}>{a.phase}</td></tr>);
                }
                if (a.milestone !== lastMs) {
                  lastMs = a.milestone;
                  const m = MILESTONES.find((x) => x.key === a.milestone);
                  rows.push(
                    <tr key={`m-${a.id}`} className="group">
                      <td colSpan={9}>
                        <div className="row between">
                          <span>{m?.name ?? (a.milestone || "No milestone")}{a.milestone && targets[a.milestone] ? <span className="muted" style={{ fontWeight: 400 }}> · target {fmtDate(targets[a.milestone])}</span> : null}</span>
                          {!readOnly && <Button variant="ghost" size="sm" onClick={() => addTo(a.milestone, a.phase)}>+ Add activity</Button>}
                        </div>
                      </td>
                    </tr>,
                  );
                }
                const overdue = isOverdue(a);
                rows.push(
                  <tr key={a.id}>
                    <td><button className="btn ghost sm" onClick={() => setOpen(open === a.id ? null : a.id)} aria-label="Details">{open === a.id ? "▾" : "▸"}</button></td>
                    <td style={a.isGroup ? { fontWeight: 700, color: "var(--navy)" } : undefined}>
                      <TextInput className="input-sm" value={a.activity} disabled={readOnly} onChange={(v) => patch(a.id, { activity: v })} style={a.isGroup ? { fontWeight: 700 } : undefined} />
                    </td>
                    <td><TextInput className="input-sm" value={a.deliverables} disabled={readOnly} onChange={(v) => patch(a.id, { deliverables: v })} /></td>
                    <td><TextInput className="input-sm" value={a.responsibleTeam} disabled={readOnly} onChange={(v) => patch(a.id, { responsibleTeam: v })} /></td>
                    <td>{!a.isGroup && <TextInput className="input-sm" value={a.responsible} disabled={readOnly} onChange={(v) => patch(a.id, { responsible: v })} />}</td>
                    <td>{!a.isGroup && <input type="date" className="input-sm" value={a.startDate} disabled={readOnly} onChange={(e) => patch(a.id, { startDate: e.target.value })} />}</td>
                    <td>{!a.isGroup && <input type="date" className="input-sm" value={a.endDate} disabled={readOnly} onChange={(e) => patch(a.id, { endDate: e.target.value })} style={overdue ? { borderColor: "var(--red)", color: "var(--red)" } : undefined} />}</td>
                    <td className="num">{!a.isGroup && (a.planDuration || "–")}</td>
                    <td>
                      {a.isGroup ? (
                        groupStatus[a.id] == null ? <span className="muted">–</span> : <div className="progress sm" title={`${Math.round(groupStatus[a.id]!)}%`}><span style={{ width: `${groupStatus[a.id]}%` }} /></div>
                      ) : (
                        <div className="row" style={{ flexWrap: "nowrap" }}>
                          <input type="number" min={0} max={100} step={5} className="input-sm" style={{ width: 64 }} value={a.status} disabled={readOnly}
                            onChange={(e) => patch(a.id, { status: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                          <span>%</span>
                          {overdue && <Badge tone="red">late</Badge>}
                        </div>
                      )}
                    </td>
                  </tr>,
                );
                if (open === a.id) {
                  rows.push(
                    <tr key={`d-${a.id}`}>
                      <td />
                      <td colSpan={8} style={{ background: "var(--blue-50)" }}>
                        <div className="grid cols-3">
                          <Field label="Support Team (L1)"><TextInput value={a.supportL1} disabled={readOnly} onChange={(v) => patch(a.id, { supportL1: v })} /></Field>
                          <Field label="Support Team (L2)"><TextInput value={a.supportL2} disabled={readOnly} onChange={(v) => patch(a.id, { supportL2: v })} /></Field>
                          <Field label="Plan Start"><input type="date" value={a.planStart} disabled={readOnly} onChange={(e) => patch(a.id, { planStart: e.target.value })} /></Field>
                          <Field label="Predecessor Condition"><TextArea rows={2} value={a.predecessor} disabled={readOnly} onChange={(v) => patch(a.id, { predecessor: v })} /></Field>
                          <Field label="Challenge"><TextArea rows={2} value={a.challenge} disabled={readOnly} onChange={(v) => patch(a.id, { challenge: v })} /></Field>
                          <Field label="Additional Comments & Links"><TextArea rows={2} value={a.comments} disabled={readOnly} onChange={(v) => patch(a.id, { comments: v })} /></Field>
                          <Field label="Plan Duration (days)"><TextInput value={a.planDuration} disabled={readOnly} onChange={(v) => patch(a.id, { planDuration: v })} /></Field>
                          <Field label="Deliverable Link"><TextInput value={a.deliverableLink} disabled={readOnly} onChange={(v) => patch(a.id, { deliverableLink: v })} placeholder="https://…" /></Field>
                          <Field label="Linked work package">
                            <Select value={a.workPackageId} disabled={readOnly} onChange={(v) => patch(a.id, { workPackageId: v })}
                              options={[{ value: "", label: "–" }, ...workPackages.map((w) => ({ value: w.id, label: `${w.id} · ${w.mode === "COMBINED" ? w.combinedTitle : w.templateCodes.join(", ")}` }))]} />
                          </Field>
                        </div>
                        <div className="row between mt">
                          <div className="row">
                            <Field label="Milestone">
                              <Select value={a.milestone} disabled={readOnly} onChange={(v) => patch(a.id, { milestone: v, phase: MILESTONES.find((m) => m.key === v)?.phase ?? a.phase })}
                                options={MILESTONES.map((m) => ({ value: m.key, label: m.name }))} />
                            </Field>
                            <label className="check" style={{ marginTop: 18 }}>
                              <input type="checkbox" checked={a.isGroup} disabled={readOnly} onChange={(e) => patch(a.id, { isGroup: e.target.checked })} /> Section header row
                            </label>
                          </div>
                          {!readOnly && <Button variant="danger" size="sm" onClick={() => remove(a.id)}>Delete activity</Button>}
                        </div>
                      </td>
                    </tr>,
                  );
                }
                return <Fragment key={`f-${a.id}`}>{rows}</Fragment>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
