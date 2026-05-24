export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

export interface AvatarController {
  state: AvatarState;
  volume: number;
  visemeHint?: string;
}

export interface AvatarStageProps {
  controller: AvatarController;
  className?: string;
}
