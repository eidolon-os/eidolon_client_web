import { useEffect, useState } from "react";
import { Track } from "livekit-client";
import { useTracks, useVoiceAssistant } from "@livekit/components-react";
import { AvatarController, AvatarState } from "../types";
import { useAudioAnalyser } from "./useAudioAnalyser";

/**
 * 整合 LiveKit 的 voice assistant state + agent audio track 的实时音量，
 * 输出统一的 AvatarController。需要在 <LiveKitRoom> 内部使用。
 */
export function useAvatarController(): AvatarController {
  const assistant = useVoiceAssistant();
  const agentTrack = useTracks([Track.Source.Microphone], { onlySubscribed: false })
    .find((t) => t.participant.isAgent);
  const analyser = useAudioAnalyser(agentTrack?.publication?.track);

  const [state, setState] = useState<AvatarState>("idle");
  useEffect(() => {
    switch (assistant.state) {
      case "listening": setState("listening"); break;
      case "thinking": setState("thinking"); break;
      case "speaking": setState("speaking"); break;
      default: setState("idle");
    }
  }, [assistant.state]);

  return {
    state,
    volume: 0, // 不再用 React state 传音量，避免 60fps re-render；走 getVolume
    getVolume: analyser.getVolume,
  };
}
