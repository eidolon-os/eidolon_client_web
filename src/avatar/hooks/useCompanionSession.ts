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
   * Connect as a companion's host-local **web body** (the proper device path):
   * identity = device_id, room omitted so hub derives a per-session voice room,
   * and channel resolves the kind=device runtime envelope → full-duplex
   * StreamingPipeline. This replaces the legacy owner-participant path (which
   * used a client-invented room and did not resolve a device envelope).
   */
  const startBody = useCallback(
    (opts: {
      ownerId: string;
      companionId?: string | null;
      deviceId?: string | null;
      displayName?: string;
    }) => {
      const err = validate();
      if (err) {
        setValidationError(err);
        return;
      }
      const ownerId = opts.ownerId?.trim();
      if (!ownerId) {
        setValidationError("Missing owner identity — cannot start the conversation.");
        return;
      }
      setValidationError(null);
      connection.connect({
        ownerId,
        companionId: opts.companionId ?? null,
        deviceId: opts.deviceId ?? null,
        displayName: (opts.displayName ?? ownerId).trim(),
        // M1 gate for requesting the video avatar. Runtime-dynamic per session;
        // the render side shows the avatar track whenever it appears regardless.
        avatar: process.env.NEXT_PUBLIC_AVATAR === "1",
      });
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
    error: connection.error ?? validationError,
    startBody,
    stop,
  };
}
