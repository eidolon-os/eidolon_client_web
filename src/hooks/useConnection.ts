import { useCallback, useRef, useState } from "react";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/**
 * Connect as a companion's host-local **web body**. ``ownerId`` is required;
 * ``deviceId`` (``web-<companion_id>``) makes hub mint a device-identity token
 * and channel resolve the kind=device runtime envelope. ``companionId`` lets
 * hub verify the device binding.
 */
export interface ConnectBodyOptions {
  ownerId: string;
  companionId?: string | null;
  deviceId?: string | null;
  displayName?: string;
  /**
   * Request a digital-human video avatar for this session. Forwarded to hub as
   * ``avatar=1``; hub stamps it into the token's participant metadata, which the
   * channel reads (``resolve_avatar_requested``) to run the avatar worker.
   * Absent/false → audio-only (unchanged behaviour).
   */
  avatar?: boolean;
}

export interface ConnectionState {
  status: ConnectionStatus;
  ownerId: string | null;
  companionId: string | null;
  deviceId: string | null;
  displayName: string | null;
  identity: string | null;
  token: string | null;
  error: string | null;
}

const IDLE_STATE: ConnectionState = {
  status: "idle",
  ownerId: null,
  companionId: null,
  deviceId: null,
  displayName: null,
  identity: null,
  token: null,
  error: null,
};

export function useConnection(livekitUrl: string) {
  const [state, setState] = useState<ConnectionState>(IDLE_STATE);

  const abortControllerRef = useRef<AbortController | null>(null);
  // The web body currently connected, so disconnect() can notify the opener
  // (mission-control) that this body went offline.
  const bodyDeviceIdRef = useRef<string | null>(null);

  /**
   * hub ``/api/config?client_type=web`` web-body handshake: hub derives a
   * per-session voice room from the device (no room_name sent), mints a token
   * whose identity is the device_id, and channel resolves the runtime envelope
   * via /api/resolve/device/{id} → full-duplex StreamingPipeline.
   */
  const connect = useCallback(async (opts: ConnectBodyOptions) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    const ownerId = opts.ownerId;
    const companionId = opts.companionId ?? null;
    const deviceId = opts.deviceId ?? null;
    const displayName = opts.displayName ?? ownerId;
    bodyDeviceIdRef.current = deviceId;

    setState({
      status: "connecting",
      ownerId,
      companionId,
      deviceId,
      displayName,
      identity: null,
      token: null,
      error: null,
    });

    try {
      const params = new URLSearchParams({
        client_type: "web",
        owner_id: ownerId,
        agent_mode: "streaming",
      });
      if (companionId) params.set("companion_id", companionId);
      if (deviceId) params.set("device_id", deviceId);
      if (opts.avatar) params.set("avatar", "1");
      const tokenUrl =
        process.env.NEXT_PUBLIC_LIVEKIT_TOKEN_URL ??
        "http://localhost:8082/api/config";
      const response = await fetch(`${tokenUrl}?${params}`, { signal: ac.signal });

      if (!response.ok) {
        // Hub's error contract: 404 owner/device not found, 422 missing param,
        // 403 body binding mismatch, 502/503 admin/upstream. Surface the
        // FastAPI ``detail`` verbatim so the operator can diagnose.
        let detail: string;
        try {
          const body = await response.json();
          detail = body.detail ?? body.error ?? `HTTP ${response.status}`;
        } catch {
          detail = `HTTP ${response.status}`;
        }
        throw new Error(detail);
      }

      const data = await response.json();
      if (ac.signal.aborted) return;

      setState({
        status: "connected",
        ownerId,
        companionId,
        deviceId,
        displayName,
        identity: data.identity ?? deviceId ?? ownerId,
        token: data.accessToken,
        error: null,
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Connection failed";
      setState((prev) => ({ ...prev, status: "error", error: message }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Best-effort presence hint to the launcher (mission-control) that this
    // web body went offline. Cross-origin, so targetOrigin is "*"; the payload
    // carries no secrets.
    const deviceId = bodyDeviceIdRef.current;
    bodyDeviceIdRef.current = null;
    if (deviceId && typeof window !== "undefined" && window.opener) {
      try {
        window.opener.postMessage(
          { type: "eidolon:web-body:disconnected", deviceId },
          "*",
        );
      } catch {
        // opener may be gone / cross-origin locked down — ignore.
      }
    }
    setState({ ...IDLE_STATE, status: "disconnected" });
  }, []);

  return {
    serverUrl: livekitUrl,
    ...state,
    connect,
    disconnect,
  };
}
