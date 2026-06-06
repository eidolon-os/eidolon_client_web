import { useEffect, useRef } from "react";
import {
  useConnectionState,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

const TOPIC = "client.audio_state";
const DEBUG_REPORT_INTERVAL_MS = 10_000;
const FAILURE_REPORT_INTERVAL_MS = 2_000;

type InputMode = "auto" | "ptt" | "manual";
type PlaybackState = "idle" | "agent_speaking";

interface Options {
  enabled?: boolean;
  inputMode?: InputMode;
  playbackState: PlaybackState;
  ptt?: boolean;
  manualInterrupt?: boolean;
  intervalMs?: number;
}

export function useClientAudioStatePublisher({
  enabled = true,
  inputMode = "auto",
  playbackState,
  ptt = false,
  manualInterrupt = false,
  intervalMs = 500,
}: Options) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const seqRef = useRef(0);
  const lastStateKeyRef = useRef<string>("");
  const lastDebugReportAtRef = useRef(0);
  const lastFailureReportAtRef = useRef(0);

  useEffect(() => {
    if (
      !enabled ||
      !room?.localParticipant ||
      connectionState !== ConnectionState.Connected
    ) {
      return;
    }

    const reportDebug = (
      event: "published" | "failed",
      payload: Record<string, unknown>,
      reason: string,
      error?: unknown,
    ) => {
      if (process.env.NODE_ENV === "production") return;
      const now = Date.now();
      if (event === "published") {
        const shouldReport =
          reason !== "heartbeat" ||
          now - lastDebugReportAtRef.current >= DEBUG_REPORT_INTERVAL_MS;
        if (!shouldReport) return;
        lastDebugReportAtRef.current = now;
      } else {
        if (now - lastFailureReportAtRef.current < FAILURE_REPORT_INTERVAL_MS) {
          return;
        }
        lastFailureReportAtRef.current = now;
      }
      const body = JSON.stringify({
        event,
        reason,
        room: room.name,
        local_identity: room.localParticipant.identity,
        payload,
        error: error instanceof Error ? error.message : String(error ?? ""),
      });
      void fetch("/api/debug/client-audio-state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        // Debug-only server log path; never disrupt the call.
      });
      if (event === "failed") {
        // Browser console is still useful when the dev server endpoint is down.
        console.debug("[client.audio_state] publish failed", { reason, error });
      }
    };

    const publish = () => {
      if (connectionState !== ConnectionState.Connected) return;
      const stateKey = [
        inputMode,
        ptt,
        manualInterrupt,
        playbackState,
        room.localParticipant.isMicrophoneEnabled,
      ].join("|");
      const reason =
        seqRef.current === 0
          ? "initial"
          : stateKey !== lastStateKeyRef.current
            ? "state_change"
            : "heartbeat";
      lastStateKeyRef.current = stateKey;
      const payload = {
        type: TOPIC,
        seq: ++seqRef.current,
        input_mode: inputMode,
        ptt,
        manual_interrupt: manualInterrupt,
        playback_state: playbackState,
        mic_muted: !room.localParticipant.isMicrophoneEnabled,
        client_ts_ms: Date.now(),
      };
      const reliable = reason !== "heartbeat";

      void room.localParticipant
        .publishData(new TextEncoder().encode(JSON.stringify(payload)), {
          reliable,
          topic: TOPIC,
        })
        .then(() => {
          reportDebug("published", payload, reason);
        })
        .catch((error) => {
          reportDebug("failed", payload, reason, error);
        });
    };

    publish();
    const id = window.setInterval(publish, intervalMs);
    return () => window.clearInterval(id);
  }, [
    enabled,
    connectionState,
    inputMode,
    intervalMs,
    manualInterrupt,
    playbackState,
    ptt,
    room,
  ]);
}
