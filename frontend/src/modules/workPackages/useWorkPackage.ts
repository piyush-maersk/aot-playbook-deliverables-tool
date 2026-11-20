import type { Draft } from "immer";
import { useCallback } from "react";
import type { WorkPackage } from "../../domain/types";
import { useProjectStore } from "../../store/projectStore";

/** Current work package + a scoped updater. */
export function useWorkPackage(wpId: string) {
  const doc = useProjectStore((s) => s.doc);
  const update = useProjectStore((s) => s.update);
  const readOnly = useProjectStore((s) => s.saveState === "readonly");
  const wp = doc?.artefacts.workPackages.find((w) => w.id === wpId);
  const updateWp = useCallback(
    (recipe: (draft: Draft<WorkPackage>) => void) =>
      update((x) => {
        const target = x.artefacts.workPackages.find((w) => w.id === wpId);
        if (target) recipe(target);
      }),
    [update, wpId],
  );
  return { wp, doc, updateWp, readOnly };
}
