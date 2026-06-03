/**
 * 肖像图 → 粒子（默认渲染方式）。放一张清晰正面肖像到 public/avatar/portrait.jpg。
 * 可用 NEXT_PUBLIC_PORTRAIT_URL 覆盖。清晰度取决于图片分辨率。
 *
 * 注：另有可选的 3D 路径（向 <AvatarStage modelUrl="xxx.glb" /> 传入 GLB，
 * 会用 MeshSurfaceSampler 从网格表面采样）；默认不使用，未随仓库附带 glb。
 */
export const PORTRAIT_URL =
  process.env.NEXT_PUBLIC_PORTRAIT_URL ?? "/avatar/portrait.jpg";

/** 聊天记录最多保留的消息条数（超出丢弃最早的；不再按时间淡出） */
export const BUBBLE_LOG_MAX = 60;

/** 配色 token（全息青蓝） */
export const PALETTE = {
  /** 背景深色（青黑） */
  bgDeep: "#04121f",
  bgFrom: "#02080f",
  bgVia: "#06182a",
  bgTo: "#0a2233",
  /** 全息主色 */
  holoCyan: "#22d3ee",
  holoBlue: "#38bdf8",
  holoGlow: "#7dd3fc",
  holoWhite: "#e0fbff",
  accent1: "#22d3ee", // 青（主）
  accent2: "#38bdf8", // 蓝
  accent3: "#7dd3fc", // 亮青点缀
};

/** 粒子 avatar 全息着色（three.js Color 十六进制，0x 形式见 ParticleHead） */
export const HOLO_COLORS = {
  /** 深处/基底青 */
  colorA: "#0891b2",
  /** 表层亮青白 */
  colorB: "#a5f3fc",
  /** 高能量/特征区强调（近白青） */
  colorAccent: "#e0fbff",
};
