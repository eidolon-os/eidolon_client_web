export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

export type AvatarMood = "neutral" | "happy" | "angry" | "sad" | "fear" | "disgust" | "love" | "sleep";

export interface AvatarController {
  state: AvatarState;
  /** 0..1 实时音量 (RMS) — 用于驱动 jawOpen */
  volume: number;
  /** ref-style getter，避免高频 re-render */
  getVolume: () => number;
  /** 预留：精细 viseme 权重（A/E/I/O/U/...） */
  visemeWeights?: Record<string, number>;
}

export interface AvatarStageProps {
  controller: AvatarController;
  /** RPM GLB url；不传则用默认 */
  modelUrl?: string;
  className?: string;
}

export type BubbleSource = "agent" | "user";

export interface BubbleMessage {
  id: string;
  source: BubbleSource;
  text: string;
  timestamp: number;
}
