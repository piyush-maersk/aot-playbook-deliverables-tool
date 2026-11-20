import { useEffect, useState } from "react";
import { fetchBlobUrl } from "../../api/client";

/** Loads a protected uploaded image as an object URL (needs the bearer token, so <img src> can't fetch it directly). */
export function useLayoutUrl(projectId: string, documentId: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!documentId) {
      setUrl("");
      return;
    }
    let revoked = false;
    let current = "";
    fetchBlobUrl(`/projects/${projectId}/documents/${documentId}/file`)
      .then((u) => {
        if (revoked) URL.revokeObjectURL(u);
        else setUrl((current = u));
      })
      .catch(() => setUrl(""));
    return () => {
      revoked = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [projectId, documentId]);
  return url;
}
