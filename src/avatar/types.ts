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
  /** 传入则用 GLB 头模表面采样（3D 路径）。不传则走图片→粒子路径。 */
  modelUrl?: string;
  /** 肖像图 url；不传则用 PORTRAIT_URL。仅在未传 modelUrl 时生效。 */
  imageUrl?: string;
  /** 采样点数；不传则按设备自适应（桌面更密、移动更省） */
  particleCount?: number;
  className?: string;
}

export type BubbleSource = "agent" | "user";

export interface BubbleMessage {
  id: string;
  source: BubbleSource;
  text: string;
  timestamp: number;
}
