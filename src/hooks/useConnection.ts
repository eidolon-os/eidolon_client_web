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
  displayName: string | null;
  identity: string | null;
  token: string | null;
  error: string | null;
}

export function useConnection(livekitUrl: string) {
  const [state, setState] = useState<ConnectionState>({
    status: "idle",
    roomName: null,
    ownerId: null,
    displayName: null,
    identity: null,
    token: null,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Phase 32.A handshake:
   *   hub /api/config?client_type=web&owner_id=<x>&room_name=<r>
   * Hub validates owner_id against admin and signs the LiveKit token
   * with identity=owner_id. Runtime identity is resolved again by
   * channel before it calls eidolon_agent.
   */
  const connect = useCallback(
    async (
      roomName: string,
      ownerId: string,
      displayName: string = ownerId,
    ) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const ac = new AbortController();
      abortControllerRef.current = ac;

      setState({
        status: "connecting",
        roomName,
        ownerId,
        displayName,
        identity: null,
        token: null,
        error: null,
      });

      try {
        const params = new URLSearchParams({
          client_type: "web",
          room_name: roomName,
          owner_id: ownerId,
          agent_mode: "streaming",
        });
        const tokenUrl =
          process.env.NEXT_PUBLIC_LIVEKIT_TOKEN_URL ??
          "http://localhost:8082/api/config";
        const response = await fetch(`${tokenUrl}?${params}`, {
          signal: ac.signal,
        });

        if (!response.ok) {
          // Hub's 32.A error contract: 404 user not found, 422
          // missing param, 502/503 admin/upstream issues. We surface
          // the FastAPI ``detail`` verbatim so the operator can
          // diagnose ("user 'manson' not found in admin registry").
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
          roomName,
          ownerId,
          displayName,
          identity: data.identity ?? ownerId,
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
    setState({
      status: "disconnected",
      roomName: null,
      ownerId: null,
      displayName: null,
      identity: null,
      token: null,
      error: null,
    });
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
