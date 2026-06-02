import { useCallback, useState } from "react";
import { useConfig } from "@/hooks/useConfig";
import { useConnection } from "@/hooks/useConnection";

export type CompanionPhase = "pre-call" | "connecting" | "in-call" | "error";

/**
 * Companion 页面的会话状态：复用主仓库的 useConnection + useConfig，
 * 但暴露更适合"陪伴模式"的状态机（pre-call → connecting → in-call）。
 */
export function useCompanionSession() {
  const { config, validate } = useConfig();
  const connection = useConnection(config.livekitUrl);
  const [validationError, setValidationError] = useState<string | null>(null);

  const phase: CompanionPhase = (() => {
    if (connection.status === "connected") return "in-call";
    if (connection.status === "connecting") return "connecting";
    if (connection.status === "error") return "error";
    return "pre-call";
  })();

  /**
   * Phase 32.C: ``start`` takes a ``user_id`` (admin-registered identity)
   * rather than a free-form display name. ``displayName`` is optional —
   * defaults to user_id, used purely for room-UI text. Hub validates the
   * user_id against admin (404 on unknowns), so this entry point also
   * acquired the "no silent fallback" contract.
   */
  const start = useCallback(
    (userId: string, displayName?: string) => {
      const err = validate();
      if (err) {
        setValidationError(err);
        return;
      }
      if (!userId.trim()) {
        setValidationError("Pick an identity before starting the conversation.");
        return;
      }
      setValidationError(null);
      const room = `companion-${Date.now()}`;
      connection.connect(room, userId.trim(), (displayName ?? userId).trim());
    },
    [connection, validate],
  );

  const stop = useCallback(() => {
    connection.disconnect();
  }, [connection]);

  return {
    config,
    phase,
    serverUrl: connection.serverUrl,
    token: connection.token,
    identity: connection.identity,
    participantName: connection.participantName,
    roomName: connection.roomName,
    error: connection.error ?? validationError,
    start,
    stop,
  };
}
