import { TrackReference, useTrackVolume, useVoiceAssistant } from "@livekit/components-react";
import { AvatarController, AvatarState } from "./types";

export function useAvatarController(agentAudioTrack?: TrackReference): AvatarController {
  const assistant = useVoiceAssistant();
  const volume = useTrackVolume(agentAudioTrack);

  const state: AvatarState = (() => {
    switch (assistant.state) {
      case "listening": return "listening";
      case "thinking": return "thinking";
      case "speaking": return "speaking";
      default: return "idle";
    }
  })();

  return { state, volume };
}
