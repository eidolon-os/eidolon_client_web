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
   * ``start`` takes an owner_id instead of a free-form display name.
   * ``displayName`` is optional and used only for room UI text.
   */
  const start = useCallback(
    (ownerId: string, displayName?: string) => {
      const err = validate();
      if (err) {
        setValidationError(err);
        return;
      }
      if (!ownerId.trim()) {
        setValidationError("Pick an identity before starting the conversation.");
        return;
      }
      setValidationError(null);
      const room = `companion-${Date.now()}`;
      connection.connect(room, ownerId.trim(), (displayName ?? ownerId).trim());
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
