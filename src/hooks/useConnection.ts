import { useCallback, useRef, useState } from "react";

export type ConnectionMode = "livekit";
export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface ConnectionState {
  status: ConnectionStatus;
  roomName: string | null;
  ownerId: string | null;
  companionId: string | null;
  deviceId: string | null;
  displayName: string | null;
  identity: string | null;
  token: string | null;
  error: string | null;
}

/**
 * Options for connecting as a managed *web body* of a companion (see the
 * eidolon web-body plan, W3-4). When ``deviceId`` is present hub mints a
 * device-identity token (identity=device_id) and channel resolves the runtime
 * envelope via /api/resolve/device/{id}, so this browser tab acts as that
 * companion's host-local body instead of an anonymous owner participant.
 */
export interface ConnectBodyOptions {
  companionId?: string | null;
  deviceId?: string | null;
}

const IDLE_STATE: ConnectionState = {
  status: "idle",
  roomName: null,
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
   * hub /api/config?client_type=web handshake. Two flavours:
   *   - owner participant: owner_id + room_name (identity=owner_id).
   *   - web body: owner_id + companion_id + device_id, room_name optional
   *     (identity=device_id; hub derives a per-session room from the device).
   * Runtime identity is resolved again by channel before it calls
   * eidolon_agent.
   */
  const connect = useCallback(
    async (
      roomName: string,
      ownerId: string,
      displayName: string = ownerId,
      opts: ConnectBodyOptions = {},
    ) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const ac = new AbortController();
      abortControllerRef.current = ac;

      const companionId = opts.companionId ?? null;
      const deviceId = opts.deviceId ?? null;
      bodyDeviceIdRef.current = deviceId;

      setState({
        status: "connecting",
        roomName: roomName || null,
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
        // A web body may omit room_name — hub derives a per-session room from
        // the device. The owner path still needs an explicit room.
        if (roomName) params.set("room_name", roomName);
        if (companionId) params.set("companion_id", companionId);
        if (deviceId) params.set("device_id", deviceId);
        const tokenUrl =
          process.env.NEXT_PUBLIC_LIVEKIT_TOKEN_URL ??
          "http://localhost:8082/api/config";
        const response = await fetch(`${tokenUrl}?${params}`, {
          signal: ac.signal,
        });

        if (!response.ok) {
          // Hub's error contract: 404 owner/device not found, 422 missing
          // param, 403 body binding mismatch, 502/503 admin/upstream. We
          // surface the FastAPI ``detail`` verbatim so the operator can
          // diagnose ("owner 'manson' not found in admin registry").
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
          roomName: roomName || null,
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
        setState((prev) => ({
          ...prev,
          status: "error",
          error: message,
        }));
      }
    },
    [],
  );

  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Best-effort presence hint to the launcher (mission-control) that this
    // web body went offline. Cross-origin (client :3000 -> admin :9001), so
    // targetOrigin is "*"; the payload carries no secrets.
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
    // Legacy alias for downstream consumers that still read
    // ``participantName``. Once the room UI stops using it, this
    // can be removed.
    participantName: state.displayName,
    connect,
    disconnect,
  };
}
