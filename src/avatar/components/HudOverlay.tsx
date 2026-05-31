import React from "react";
import { useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { AvatarState } from "../types";
import styles from "../styles/companion.module.css";

const STATE_LABEL: Record<AvatarState, string> = {
  idle: "STANDBY",
  listening: "LISTENING",
  thinking: "PROCESSING",
  speaking: "SPEAKING",
};

const STATE_COLOR: Record<AvatarState, string> = {
  idle: "text-slate-300",
  listening: "text-cyan-300",
  thinking: "text-amber-300",
  speaking: "text-sky-300",
};

/** 四角科幻角标 */
function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const map: Record<string, string> = {
    tl: "top-4 left-4 border-l border-t",
    tr: "top-4 right-4 border-r border-t",
    bl: "bottom-4 left-4 border-l border-b",
    br: "bottom-4 right-4 border-r border-b",
  };
  return <div className={`absolute h-7 w-7 border-cyan-300/40 ${map[pos]}`} />;
}

/**
 * HUD 叠加层：四角角标 + 状态读数 + 连接状态。纯展示，不拦截事件。
 */
export function HudOverlay({ state }: { state: AvatarState }) {
  const conn = useConnectionState();
  const online = conn === ConnectionState.Connected;

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />

      {/* 状态读数（右上，避开顶部状态条） */}
      <div className="absolute right-6 top-16 flex flex-col items-end gap-1.5 font-mono text-[11px] tracking-[0.2em]">
        <div className="flex items-center gap-2">
          <span className="text-cyan-200/50">AVATAR</span>
          <span className={`${STATE_COLOR[state]} [text-shadow:0_0_8px_currentColor]`}>
            {STATE_LABEL[state]}
          </span>
          <span className={`h-1.5 w-1.5 rounded-full bg-cyan-300 ${styles.statusDot}`} />
        </div>
        <div className="flex items-center gap-2 text-cyan-200/40">
          <span>LINK</span>
          <span className={online ? "text-emerald-300" : "text-rose-300"}>
            {online ? "ONLINE" : conn.toString().toUpperCase()}
          </span>
        </div>
      </div>

      {/* 左侧装饰刻度条 */}
      <div className="absolute left-6 top-1/2 flex -translate-y-1/2 flex-col gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className="h-px bg-cyan-300/30"
            style={{ width: `${10 + (i % 3) * 6}px` }}
          />
        ))}
      </div>
    </div>
  );
}
