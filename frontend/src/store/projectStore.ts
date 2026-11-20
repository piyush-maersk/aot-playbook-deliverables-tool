// Project document store (blueprint 10.6): local-first copy, dirty tracking, debounced autosave,
// baseRevision tracking and 409/410 handling.
import { produce, type Draft } from "immer";
import { create } from "zustand";
import { api, ApiError } from "../api/client";
import type { LoadedProject, ProjectDocument } from "../domain/types";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "conflict" | "deleted" | "error" | "readonly";

interface ConflictInfo {
  revision: number;
  updatedBy: string;
  updatedAt: string;
}

interface ProjectStore {
  projectId: string | null;
  doc: ProjectDocument | null;
  revision: number | null;
  saveState: SaveState;
  lastSavedAt: string | null;
  conflict: ConflictInfo | null;
  error: string;
  recovered: boolean;
  load: (id: string) => Promise<void>;
  update: (recipe: (draft: Draft<ProjectDocument>) => void) => void;
  saveNow: () => Promise<void>;
  reloadFromServer: () => Promise<void>;
  overwriteServer: () => Promise<void>;
  replaceDocument: (doc: ProjectDocument) => void;
  setReadonly: (readonly: boolean) => void;
  reset: () => void;
}

const DEBOUNCE_MS = 1200;
const backupKey = (id: string) => `aot-project-backup:${id}`;
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<void> | null = null;
let editsSinceSave = 0;

function backup(id: string, doc: ProjectDocument, revision: number | null) {
  try {
    localStorage.setItem(backupKey(id), JSON.stringify({ baseRevision: revision, doc, at: new Date().toISOString() }));
  } catch {
    // Storage full or disabled – autosave to the server still works.
  }
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projectId: null,
  doc: null,
  revision: null,
  saveState: "idle",
  lastSavedAt: null,
  conflict: null,
  error: "",
  recovered: false,

  async load(id) {
    clearTimeout(timer);
    if (inFlight) await inFlight;
    set({ projectId: id, doc: null, revision: null, saveState: "idle", conflict: null, error: "", recovered: false });
    try {
      const loaded = await api<LoadedProject>(`/projects/${id}`);
      if (get().projectId !== id) return;
      const doc: ProjectDocument = { project: loaded.project, artefacts: loaded.artefacts };
      const raw = localStorage.getItem(backupKey(id));
      const saved = raw ? (JSON.parse(raw) as { baseRevision: number; doc: ProjectDocument }) : null;
      if (saved && saved.baseRevision === loaded.revision) {
        // Unsaved edits from a previous session on top of the same server revision – recover them.
        set({ doc: saved.doc, revision: loaded.revision, saveState: "dirty", lastSavedAt: loaded.updatedAt, recovered: true });
        schedule(get);
      } else {
        localStorage.removeItem(backupKey(id));
        set({ doc, revision: loaded.revision, saveState: "saved", lastSavedAt: loaded.updatedAt });
      }
    } catch (e) {
      set({ error: e instanceof ApiError && e.status === 404 ? "Project not found" : String((e as Error).message), saveState: "error" });
    }
  },

  update(recipe) {
    const { doc, projectId, saveState } = get();
    if (!doc || !projectId || saveState === "deleted" || saveState === "readonly") return;
    const next = produce(doc, recipe);
    editsSinceSave++;
    set({ doc: next, saveState: saveState === "conflict" ? "conflict" : "dirty" });
    backup(projectId, next, get().revision);
    if (get().saveState !== "conflict") schedule(get);
  },

  async saveNow() {
    clearTimeout(timer);
    if (inFlight) await inFlight;
    const { doc, projectId, revision, saveState } = get();
    if (!doc || !projectId || saveState === "conflict" || saveState === "deleted" || saveState === "readonly") return;
    if (saveState !== "dirty" && saveState !== "error") return;
    const editsAtStart = editsSinceSave;
    set({ saveState: "saving" });
    inFlight = (async () => {
      try {
        const res = await api<{ revision: number; updatedAt: string }>(`/projects/${projectId}`, {
          method: "PUT",
          body: { project: doc.project, artefacts: doc.artefacts, baseRevision: revision },
        });
        if (get().projectId !== projectId) {
          localStorage.removeItem(backupKey(projectId));
          return; // another project was opened meanwhile
        }
        const changedMeanwhile = editsSinceSave !== editsAtStart;
        set({ revision: res.revision, lastSavedAt: res.updatedAt, saveState: changedMeanwhile ? "dirty" : "saved", error: "" });
        if (changedMeanwhile) {
          backup(projectId, get().doc!, res.revision);
          schedule(get);
        } else {
          localStorage.removeItem(backupKey(projectId));
        }
      } catch (e) {
        if (get().projectId !== projectId) return;
        if (e instanceof ApiError && e.status === 409) set({ saveState: "conflict", conflict: e.body as ConflictInfo });
        else if (e instanceof ApiError && e.status === 410) set({ saveState: "deleted" });
        else set({ saveState: "error", error: (e as Error).message });
      }
    })();
    await inFlight;
    inFlight = null;
  },

  async reloadFromServer() {
    const id = get().projectId;
    if (!id) return;
    localStorage.removeItem(backupKey(id));
    await get().load(id);
  },

  async overwriteServer() {
    const { conflict } = get();
    if (!conflict) return;
    set({ revision: conflict.revision, conflict: null, saveState: "dirty" });
    await get().saveNow();
  },

  replaceDocument(doc) {
    get().update((draft) => {
      draft.artefacts = doc.artefacts as Draft<ProjectDocument>["artefacts"];
      draft.project = { ...doc.project, id: draft.project.id } as Draft<ProjectDocument>["project"];
    });
  },

  setReadonly(readonly) {
    if (readonly) set({ saveState: "readonly" });
  },

  reset() {
    clearTimeout(timer);
    set({ projectId: null, doc: null, revision: null, saveState: "idle", conflict: null, error: "", recovered: false });
  },
}));

function schedule(get: () => ProjectStore) {
  clearTimeout(timer);
  timer = setTimeout(() => void get().saveNow(), DEBOUNCE_MS);
}

/** Flush pending edits when the tab is hidden or closed. */
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void useProjectStore.getState().saveNow();
  });
}
