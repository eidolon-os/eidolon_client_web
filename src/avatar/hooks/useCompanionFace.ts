import { useEffect, useState } from "react";

/**
 * The companion's configured display face and its offline idle loop, resolved
 * from the admin gateway (the browser already reaches admin for bootstrap, and
 * has the ids from it — no extra backend needed).
 *
 *  - ``posterUrl``  — the still cond_image (档3 fallback: micro-motion on a still)
 *  - ``videoUrl``   — the generated looping idle clip (档1), present only once ready
 *  - ``idleStatus`` — none | pending | generating | ready | failed
 *
 * While generation is in flight it polls (bounded) so a clip that finishes
 * mid-session is picked up. Any error / missing face resolves to "no face" so
 * the caller falls back to the particle head.
 */
export interface CompanionFace {
  hasFace: boolean;
  posterUrl: string | null;
  videoUrl: string | null;
  idleStatus: string;
}

const EMPTY: CompanionFace = {
  hasFace: false,
  posterUrl: null,
  videoUrl: null,
  idleStatus: "none",
};

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 24; // ~2 min of watching an in-flight generation

export function useCompanionFace(
  adminApiUrl: string | undefined,
  ownerId: string | null | undefined,
  companionId: string | null | undefined,
): CompanionFace {
  const [info, setInfo] = useState<CompanionFace>(EMPTY);

  useEffect(() => {
    if (!adminApiUrl || !ownerId || !companionId) {
      setInfo(EMPTY);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const faceBase =
      `${adminApiUrl}/api/owners/${encodeURIComponent(ownerId)}` +
      `/companions/${encodeURIComponent(companionId)}/face`;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(faceBase, { headers: { Accept: "application/json" } });
        if (cancelled) return;
        if (!res.ok) {
          setInfo(EMPTY);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const idleStatus = String(data.idle_status ?? "none");
        const cacheKey = encodeURIComponent(String(data.sha256 ?? ""));
        setInfo({
          hasFace: true,
          posterUrl: `${faceBase}/image?v=${cacheKey}`,
          videoUrl: data.idle_ready ? `${faceBase}/idle/video?v=${cacheKey}` : null,
          idleStatus,
        });
        if (
          (idleStatus === "pending" || idleStatus === "generating") &&
          attempts < MAX_POLLS
        ) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setInfo(EMPTY);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [adminApiUrl, ownerId, companionId]);

  return info;
}
