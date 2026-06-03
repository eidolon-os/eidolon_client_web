import React, { useEffect, useState } from "react";
import {
  useConnectionState,
  useParticipants,
  useRemoteParticipants,
  useVoiceAssistant,
} from "@livekit/components-react";
import type { BubbleMessage } from "../types";

/**
 * 诊断面板 —— 显示房间内当前状态，用于排查"没有欢迎语"等问题。
 * 默认显示，可在 URL 加 ?nodebug 关闭。
 */
export function DiagnosticsPanel({ bubbles }: { bubbles: BubbleMessage[] }) {
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const remotes = useRemoteParticipants();
  const assistant = useVoiceAssistant();
  const [secondsSinceConnect, setSecondsSinceConnect] = useState(0);
  const [open, setOpen] = useState(false); // 默认关闭，点角标打开
  const [everSpoke, setEverSpoke] = useState(false);

  // 用实际音频/状态判断"说过话"——agent 一旦进入 speaking 即视为出过声（不依赖字幕）
  useEffect(() => {
    if (assistant.state === "speaking") setEverSpoke(true);
  }, [assistant.state]);

  // ?debug 默认打开诊断面板
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug")) {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (connectionState !== "connected") {
      setSecondsSinceConnect(0);
      return;
    }
    const t = setInterval(() => setSecondsSinceConnect((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [connectionState]);

  // 默认关闭：只显示一个可点击的角标，点了再打开
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto absolute right-4 top-16 z-30 rounded-lg border border-cyan-300/30 bg-slate-900/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/70 backdrop-blur transition-colors hover:border-cyan-300/60 hover:text-cyan-100"
        aria-label="打开诊断面板"
      >
        ⚙ diag
      </button>
    );
  }

  const agent = remotes.find((p) => (p as { isAgent?: boolean }).isAgent);
  const agentParticipant = agent ?? remotes.find((p) => p.identity?.startsWith("agent-") || p.identity?.includes("eidolon"));
  const lastAgentBubble = [...bubbles].reverse().find((b) => b.source === "agent");

  return (
    <div className="pointer-events-auto absolute right-4 top-16 z-30 w-80 rounded-2xl border border-white/15 bg-slate-900/80 p-4 font-mono text-[11px] text-white/85 shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-violet-300">DIAGNOSTICS</span>
        <button
          onClick={() => setOpen(false)}
          className="rounded text-white/40 hover:text-white/80"
          aria-label="关闭"
        >
          ✕
        </button>
      </div>

      <Row label="connection" value={connectionState} color={connectionState === "connected" ? "ok" : "warn"} />
      <Row label="elapsed" value={`${secondsSinceConnect}s`} />
      <Row label="participants" value={`${participants.length}`} />
      <Row label="remotes" value={`${remotes.length}`} />
      <Row
        label="agent joined"
        value={agentParticipant ? "✓" : (secondsSinceConnect > 3 ? "✗ NOT YET" : "…waiting")}
        color={agentParticipant ? "ok" : (secondsSinceConnect > 8 ? "bad" : "warn")}
      />
      {agentParticipant && (
        <Row label="agent identity" value={agentParticipant.identity} />
      )}
      <Row label="assistant.state" value={assistant.state ?? "(none)"} color={assistant.state ? "ok" : "warn"} />
      <Row label="ever spoke (audio)" value={everSpoke ? "✓" : "—"} color={everSpoke ? "ok" : "warn"} />
      <Row label="agent transcripts" value={`${assistant.agentTranscriptions?.length ?? 0}`} />
      <Row label="bubbles" value={`${bubbles.length}`} />
      <Row
        label="last agent bubble"
        value={lastAgentBubble ? `"${lastAgentBubble.text.slice(0, 30)}${lastAgentBubble.text.length > 30 ? "…" : ""}"` : "(none)"}
        color={lastAgentBubble ? "ok" : (secondsSinceConnect > 10 ? "bad" : "warn")}
      />

      {/* 诊断结论 */}
      {connectionState === "connected" && secondsSinceConnect > 10 && (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/40 p-2 text-[11px] leading-relaxed text-white/80">
          {!agentParticipant && (
            <p className="text-rose-300">
              ⚠ Agent 10s 内未加入。检查 eidolon_channel agent 服务是否在跑：
              <code className="ml-1 rounded bg-white/10 px-1">{`agent_name="eidolon"`}</code>
            </p>
          )}
          {agentParticipant && !everSpoke && !lastAgentBubble && (
            <p className="text-amber-300">
              ⚠ Agent 已加入但 10s 内未检测到语音(音频)与字幕。检查 welcome_message 配置是否为空、TTS/LLM 是否可用。
            </p>
          )}
          {agentParticipant && everSpoke && !lastAgentBubble && (
            <p className="text-white/50">
              ℹ Agent 已出声(检测到音频)，但未收到字幕文本——agent 未推送 transcription 时属正常，不影响语音。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string | number; color?: "ok" | "warn" | "bad" }) {
  const colorClass =
    color === "ok" ? "text-emerald-300" :
    color === "bad" ? "text-rose-300" :
    color === "warn" ? "text-amber-200" :
    "text-white/70";
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-white/50">{label}</span>
      <span className={`truncate text-right ${colorClass}`}>{String(value)}</span>
    </div>
  );
}
