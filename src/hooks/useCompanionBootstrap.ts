import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The host-local web client resolves *who it is* with zero forms:
 *
 *  1. If mission-control launched this tab with ``?owner_id&device_id`` in the
 *     URL, use those verbatim (the web body of a specific companion).
 *  2. Otherwise ask admin ``GET /api/bootstrap`` for the default owner's master
 *     companion + its web body device.
 *
 * A 409 means admin can't pick a default owner (several exist and no
 * ``EIDOLON_LOCAL_OWNER_ID``) — the UI drops to a minimal owner picker whose
 * selection is resolved via ``GET /api/bootstrap?owner_id=<id>`` (``resolveOwner``).
 */
export interface CompanionIdentity {
  ownerId: string;
  companionId: string | null;
  deviceId: string | null;
  displayName: string;
}

export type BootstrapStatus = "resolving" | "ready" | "ambiguous" | "error";

// Cap the admin round-trip so an unreachable admin (down, or black-holed by a
// system proxy that never sends RST) surfaces the error+retry overlay instead
// of hanging forever on the "waking…" state.
const BOOTSTRAP_TIMEOUT_MS = 8000;

interface BootstrapBody {
  owner_id: string;
  owner_display_name?: string;
  companion_id?: string;
  companion_display_name?: string;
  device_id?: string;
}

export function useCompanionBootstrap(adminApiUrl: string) {
  const [status, setStatus] = useState<BootstrapStatus>("resolving");
  const [identity, setIdentity] = useState<CompanionIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const fetchBootstrap = useCallback(
    async (ownerId?: string) => {
      setStatus("resolving");
      setError(null);
      if (!adminApiUrl) {
        setError(
          "Admin API URL is not configured. Set NEXT_PUBLIC_ADMIN_API_URL " +
            "(usually http://127.0.0.1:9000) in .env.local.",
        );
        setStatus("error");
        return;
      }
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), BOOTSTRAP_TIMEOUT_MS);
      try {
        const url = new URL(`${adminApiUrl}/api/bootstrap`);
        if (ownerId) url.searchParams.set("owner_id", ownerId);
        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
          signal: ac.signal,
        });
        if (res.status === 409) {
          // Ambiguous: several owners, no configured default. Fall back to picker.
          const body = await res.json().catch(() => ({}));
          setError(body.detail ?? "Multiple owners found — pick one to continue.");
          setStatus("ambiguous");
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? `admin /api/bootstrap → HTTP ${res.status}`);
        }
        const data: BootstrapBody = await res.json();
        setIdentity({
          ownerId: data.owner_id,
          companionId: data.companion_id ?? null,
          deviceId: data.device_id ?? null,
          displayName:
            data.companion_display_name || data.owner_display_name || data.owner_id,
        });
        setError(null);
        setStatus("ready");
      } catch (err) {
        const message = ac.signal.aborted
          ? `连接 admin 超时（${Math.round(BOOTSTRAP_TIMEOUT_MS / 1000)}s）。请确认 admin 服务在运行` +
            `（NEXT_PUBLIC_ADMIN_API_URL=${adminApiUrl}）。`
          : err instanceof Error
            ? err.message
            : "Bootstrap failed";
        setError(message);
        setStatus("error");
      } finally {
        clearTimeout(timer);
      }
    },
    [adminApiUrl],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    // Mission-control launch: identity is fully in the URL, no admin round-trip.
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      const ownerId = q.get("owner_id");
      const deviceId = q.get("device_id");
      if (ownerId && deviceId) {
        const companionId = q.get("companion_id");
        setIdentity({
          ownerId,
          companionId,
          deviceId,
          displayName: companionId ?? ownerId,
        });
        setError(null);
        setStatus("ready");
        return;
      }
    }
    void fetchBootstrap();
  }, [fetchBootstrap]);

  const retry = useCallback(() => {
    void fetchBootstrap();
  }, [fetchBootstrap]);

  const resolveOwner = useCallback(
    (ownerId: string) => {
      void fetchBootstrap(ownerId);
    },
    [fetchBootstrap],
  );

  return { status, identity, error, retry, resolveOwner };
}
