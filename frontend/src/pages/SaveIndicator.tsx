import { fmtDateTime } from "../components/ui";
import { useProjectStore } from "../store/projectStore";

const LABEL: Record<string, string> = {
  idle: "", dirty: "Unsaved changes…", saving: "Saving…", saved: "All changes saved", conflict: "Conflict – not saved",
  deleted: "Project deleted", error: "Save failed – retrying on next edit", readonly: "Read-only",
};

export function SaveIndicator() {
  const { saveState, lastSavedAt, error, saveNow } = useProjectStore();
  const color = saveState === "saved" ? "var(--green)" : saveState === "conflict" || saveState === "error" || saveState === "deleted" ? "var(--red)" : "var(--blue)";
  return (
    <span className="save-state" title={saveState === "error" ? error : lastSavedAt ? `Last saved ${fmtDateTime(lastSavedAt)}` : ""}>
      <span className="dot" style={{ background: color }} />
      {LABEL[saveState]}
      {saveState === "error" && <button className="btn ghost sm" onClick={() => void saveNow()}>Retry</button>}
    </span>
  );
}
