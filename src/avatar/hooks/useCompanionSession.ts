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

  const start = useCallback((name: string) => {
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    const room = `companion-${Date.now()}`;
    const participant = name.trim() || `user-${Date.now()}`;
    connection.connect(room, participant);
  }, [connection, validate]);

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
