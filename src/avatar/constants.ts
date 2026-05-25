import { AvatarMood, AvatarState } from "./types";

/**
 * 默认 Ready Player Me 头像。
 * 本地托管在 public/avatar/default.glb（来自 TalkingHead 官方仓库 brunette.glb，
 * CC BY-NC 4.0；包含 ARKit + Oculus Visemes blendshapes）。
 * 可通过 NEXT_PUBLIC_AVATAR_URL 覆盖（指向自定义的 RPM URL 或其他 .glb）。
 */
export const DEFAULT_AVATAR_URL =
  process.env.NEXT_PUBLIC_AVATAR_URL ?? "/avatar/default.glb";

export const DEFAULT_AVATAR_BODY: "F" | "M" = "F";

/** state → TalkingHead mood */
export const STATE_TO_MOOD: Record<AvatarState, AvatarMood> = {
  idle: "neutral",
  listening: "neutral",
  thinking: "neutral",
  speaking: "happy",
};

/** 状态切换时触发的一次性手势（可选） */
export const STATE_TO_GESTURE: Partial<Record<AvatarState, { name: string; durationSec: number }>> = {
  listening: { name: "index", durationSec: 2 },
  thinking: { name: "handup", durationSec: 3 },
};

/** 气泡停留时间（毫秒），到点后淡出 */
export const BUBBLE_TTL_MS = 8000;

/** 同屏最多保留的气泡数 */
export const BUBBLE_MAX_VISIBLE = 3;

/** 配色 token（极光夜空） */
export const PALETTE = {
  bgFrom: "#0b0a23",
  bgVia: "#1e1b4b",
  bgTo: "#312e81",
  accent1: "#7c3aed", // 紫
  accent2: "#22d3ee", // 青
  accent3: "#f472b6", // 粉点缀
};
