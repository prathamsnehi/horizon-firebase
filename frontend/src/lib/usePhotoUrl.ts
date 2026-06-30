import { useEffect, useState } from "react";
import { getPhotoUrl } from "./photos";

/** Resolve an IndexedDB photo id to an object URL, revoking on cleanup. */
export function usePhotoUrl(id: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let created: string | null = null;
    if (!id) {
      setUrl(null);
      return;
    }
    getPhotoUrl(id).then((u) => {
      if (active) {
        created = u;
        setUrl(u);
      } else if (u) {
        URL.revokeObjectURL(u);
      }
    });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [id]);

  return url;
}
