import { useEffect, useState } from "react";

/**
 * Build the URL of a companion's configured display face (the digital-human
 * ``cond_image``), served by the admin gateway. The browser already reaches
 * admin directly (same origin used for bootstrap) and has the ids from
 * bootstrap, so no extra backend is needed. Returns ``null`` when any id is
 * missing.
 */
export function companionFaceImageUrl(
  adminApiUrl: string | undefined,
  ownerId: string | null | undefined,
  companionId: string | null | undefined,
): string | null {
  if (!adminApiUrl || !ownerId || !companionId) return null;
  return (
    `${adminApiUrl}/api/owners/${encodeURIComponent(ownerId)}` +
    `/companions/${encodeURIComponent(companionId)}/face/image`
  );
}

/**
 * Preload-probe the companion's configured display face. Returns the URL only
 * once the image successfully loads, so a companion with no configured face
 * (endpoint 404s) resolves to ``null`` and the caller falls back to the
 * particle head instead of flashing a broken image. Display-only (plain
 * ``<img>``), so no CORS is required.
 */
export function useCompanionPoster(
  adminApiUrl: string | undefined,
  ownerId: string | null | undefined,
  companionId: string | null | undefined,
): string | null {
  const url = companionFaceImageUrl(adminApiUrl, ownerId, companionId);
  const [ready, setReady] = useState<string | null>(null);

  useEffect(() => {
    setReady(null);
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setReady(url);
    };
    img.onerror = () => {
      if (!cancelled) setReady(null);
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return ready;
}
