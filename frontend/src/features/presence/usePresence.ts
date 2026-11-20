import { useEffect, useRef, useState } from "react";
import { api, apiUrl, authHeaders } from "../../api/client";

export interface PresenceUser {
  name: string;
  email: string;
  mode: "viewing" | "editing";
  since: string;
}

/** 30 s heartbeat; returns other users seen in the last 75 s (editors first). */
export function usePresence(projectId: string | undefined, mode: "viewing" | "editing") {
  const [others, setOthers] = useState<PresenceUser[]>([]);
  const modeRef = useRef(mode);
  const beatRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    const beat = () =>
      void api<{ others: PresenceUser[] }>(`/projects/${projectId}/presence`, { method: "PUT", body: { mode: modeRef.current } })
        .then((r) => alive && setOthers(r.others))
        .catch(() => undefined);
    beatRef.current = beat;
    beat();
    const handle = setInterval(beat, 30_000);
    const leave = async () => {
      fetch(apiUrl(`/projects/${projectId}/presence`), { method: "DELETE", keepalive: true, headers: await authHeaders() }).catch(() => undefined);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      alive = false;
      beatRef.current = () => undefined;
      clearInterval(handle);
      window.removeEventListener("pagehide", leave);
      void leave();
    };
  }, [projectId]);

  useEffect(() => {
    if (modeRef.current === mode) return;
    modeRef.current = mode;
    beatRef.current();
  }, [mode]);

  return others;
}
