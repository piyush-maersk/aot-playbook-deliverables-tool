import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTemplateLibrary } from "../../api/queries";
import { useCurrentUser } from "../../auth/useCurrentUser";
import { Badge, Button, Card, EmptyState, Field, Loading, Modal, ProgressBar, TextInput } from "../../components/ui";
import { newWorkPackage, nextId, sortCodes } from "../../domain/factory";
import { workPackageCompleteness } from "../../domain/progress";
import { documentTitle, fmtDate } from "../../domain/render";
import { TEMPLATE_TYPICAL_USE, type TemplateLibrary } from "../../domain/templates";
import type { WorkPackage } from "../../domain/types";
import { useProjectStore } from "../../store/projectStore";

const STATUS_TONE = { Draft: "grey", "In Review": "amber", Approved: "green", Issued: "navy" } as const;

export function WorkPackageList() {
  const { doc, update, saveState } = useProjectStore();
  const lib = useTemplateLibrary();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const readOnly = saveState === "readonly";
  if (!doc || lib.isLoading) return <Loading />;
  if (!lib.data) return <div className="banner error">Template library could not be loaded.</div>;
  const wps = doc.artefacts.workPackages;

  const remove = (wp: WorkPackage) => {
    if (!confirm(`Delete ${wp.id}? This cannot be undone except via version history.`)) return;
    update((x) => { x.artefacts.workPackages = x.artefacts.workPackages.filter((w) => w.id !== wp.id); });
  };

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="row between">
        <p className="muted" style={{ margin: 0, maxWidth: 820 }}>
          Each work package follows the governed 4-page structure: Page 1 Project Overview & Scope · Page 2 Functional & Technical Requirements ·
          Page 3 Deliverables · Page 4 Appendix (A–J). Template text is reused verbatim; you add project facts, decisions and appendix content.
        </p>
        {!readOnly && <Button onClick={() => setCreating(true)}>+ New work package</Button>}
      </div>
      {wps.length === 0 ? (
        <Card>
          <EmptyState title="No work packages yet" action={!readOnly && <Button onClick={() => setCreating(true)}>Create work package</Button>}>
            Pick one or more of the eight Page-2 templates (WAN, MDF, Cabling, LAN, IT Hardware, OT Hardware, OT Automation Machines, OT Machine Network).
          </EmptyState>
        </Card>
      ) : (
        <div className="grid auto">
          {wps.map((wp) => {
            const pct = workPackageCompleteness(wp, doc.artefacts.overview);
            return (
              <Card key={wp.id} onClick={() => navigate(wp.id)}>
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <div>
                    <div className="row"><strong style={{ color: "var(--navy)" }}>{wp.id}</strong><Badge tone={STATUS_TONE[wp.status]}>{wp.status}</Badge><Badge tone="grey">{wp.mode}</Badge></div>
                    <h3 style={{ margin: "0.4rem 0 0.2rem" }}>{documentTitle(wp, lib.data).replace("Automation & Operational Technology: ", "")}</h3>
                  </div>
                  {!readOnly && <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); remove(wp); }}>Delete</Button>}
                </div>
                <div className="row" style={{ margin: "0.4rem 0 0.8rem" }}>
                  {wp.templateCodes.map((c) => <Badge key={c}>{c} · {lib.data!.templates.find((t) => t.code === c)?.short}</Badge>)}
                </div>
                <ProgressBar value={pct} label="Information completeness" />
                <div className="muted" style={{ fontSize: "0.78rem", marginTop: 8 }}>
                  v{wp.documentControl.version || "–"} · issue date {wp.documentControl.issueDate ? fmtDate(wp.documentControl.issueDate) : "[DD/MM/YYYY]"} · owner {wp.documentControl.aotEngineerOwner || "[TBC]"}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {creating && (
        <NewWorkPackageModal lib={lib.data} existingIds={wps.map((w) => w.id)} onClose={() => setCreating(false)}
          onCreate={(created) => {
            update((x) => { x.artefacts.workPackages.push(...created); });
            setCreating(false);
            if (created.length === 1) navigate(created[0]!.id);
          }} />
      )}
    </div>
  );
}

function NewWorkPackageModal({ lib, existingIds, onClose, onCreate }: {
  lib: TemplateLibrary; existingIds: string[]; onClose: () => void; onCreate: (wps: WorkPackage[]) => void;
}) {
  const me = useCurrentUser();
  const [mode, setMode] = useState<"SEPARATE" | "COMBINED">("SEPARATE");
  const [codes, setCodes] = useState<string[]>([]);
  const [combinedTitle, setCombinedTitle] = useState("IT-OT Automation");
  const toggle = (c: string) => setCodes((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const create = () => {
    const ids = [...existingIds];
    const owner = me.data?.name ?? "";
    const made = mode === "COMBINED"
      ? [newWorkPackage(lib, { id: nextId("WP", ids), mode, codes, combinedTitle, owner })]
      : sortCodes(codes).map((c) => {
        const id = nextId("WP", ids);
        ids.push(id);
        return newWorkPackage(lib, { id, mode, codes: [c], owner });
      });
    onCreate(made);
  };

  return (
    <Modal title="New work package" wide onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!codes.length || (mode === "COMBINED" && !combinedTitle.trim())} onClick={create}>
          {mode === "SEPARATE" && codes.length > 1 ? `Create ${codes.length} work packages` : "Create work package"}
        </Button>
      </>
    }>
      <h4>A1 · Generation mode</h4>
      <div className="chip-select mb">
        <div className={`opt ${mode === "SEPARATE" ? "on" : ""}`} onClick={() => setMode("SEPARATE")}>
          <strong>SEPARATE</strong><small>One complete work package per selected template. Use when packages go to different vendors or teams.</small>
        </div>
        <div className={`opt ${mode === "COMBINED" ? "on" : ""}`} onClick={() => setMode("COMBINED")}>
          <strong>COMBINED</strong><small>One work package merging all selected templates. Use when one vendor delivers everything.</small>
        </div>
      </div>
      {mode === "COMBINED" && (
        <Field label="COMBINED_TITLE" hint={`Title: "Automation & Operational Technology: ${combinedTitle || "…"} – Work Package"`} className="mb">
          <TextInput value={combinedTitle} onChange={setCombinedTitle} />
        </Field>
      )}
      <h4>A2 · Page-2 templates</h4>
      <div className="chip-select">
        {lib.templates.map((t) => (
          <div key={t.code} className={`opt ${codes.includes(t.code) ? "on" : ""}`} onClick={() => toggle(t.code)}>
            <div className="row between"><strong>{t.code} · {t.name}</strong><input type="checkbox" readOnly checked={codes.includes(t.code)} /></div>
            <small>{TEMPLATE_TYPICAL_USE[t.code]}</small>
            <div className="muted" style={{ fontSize: "0.72rem", marginTop: 4 }}>{t.functionalRequirements.length} FR · {t.technicalRequirements.length} TR · {t.appendices.length} appendices</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
