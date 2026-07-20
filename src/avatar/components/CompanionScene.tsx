import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { LiveKitRoom, RoomAudioRenderer, StartAudio } from "@livekit/components-react";
import "@livekit/components-styles";
import { useCompanionSession } from "../hooks/useCompanionSession";
import { useAvatarController } from "../hooks/useAvatarController";
import { useAvatarVideoTrack } from "../hooks/useAvatarVideoTrack";
import { useCompanionPoster } from "../hooks/useCompanionPoster";
import { VideoAvatarStage } from "./VideoAvatarStage";
import { IdleFaceStage } from "./IdleFaceStage";
import { useBubbleStream } from "../hooks/useBubbleStream";
import { useClientAudioStatePublisher } from "@/hooks/useClientAudioStatePublisher";
import {
  PLAYBACK_STATE_AGENT_SPEAKING,
  PLAYBACK_STATE_IDLE,
} from "@/lib/contracts";
import { useOwners } from "@/hooks/useOwners";
import { useCompanionBootstrap } from "@/hooks/useCompanionBootstrap";
import { AmbientBackground } from "./AmbientBackground";
import { PreCallCard } from "./PreCallCard";
import { ConnectionOverlay } from "./ConnectionOverlay";
import { StatusOverlay } from "./StatusOverlay";
import { BubbleLayer } from "./BubbleLayer";
import { ControlDock } from "./ControlDock";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { HudOverlay } from "./HudOverlay";
import styles from "../styles/companion.module.css";

// AvatarStage 用 dynamic import 隔离 WebGL / three.js，避免 SSR 报错
const AvatarStage = dynamic(
  () => import("./AvatarStage").then((m) => m.AvatarStage),
  { ssr: false }
);

/**
 * Companion 体验的顶层场景（无表单，打开即对话）：
 *  bootstrap.resolving  → StatusOverlay「正在唤醒…」
 *  bootstrap.error      → StatusOverlay（诊断 + 重试）
 *  bootstrap.ambiguous  → PreCallCard（多 owner 时的极简选择器）
 *  ready + connecting   → ConnectionOverlay
 *  ready + in-call      → LiveKitRoom( AvatarStage + BubbleLayer + ControlDock )
 *  ready + hung-up      → StatusOverlay（重新连接）
 */
export function CompanionScene() {
  const session = useCompanionSession();
  const bootstrap = useCompanionBootstrap(session.config.adminApiUrl);
  const {
    owners,
    loading: ownersLoading,
    error: ownersError,
    refresh: refreshOwners,
  } = useOwners(session.config.adminApiUrl);

  // Idle digital-human face (档3): the companion's configured display face,
  // rendered locally at idle. Only in avatar mode — audio-only sessions keep the
  // particle head. Resolves to null (→ particle fallback) when no face is set.
  const avatarMode = process.env.NEXT_PUBLIC_AVATAR === "1";
  const posterUrl = useCompanionPoster(
    session.config.adminApiUrl,
    bootstrap.identity?.ownerId,
    bootstrap.identity?.companionId,
  );
  const idleFaceUrl = avatarMode ? posterUrl : null;

  // Fallback picker (only shown when bootstrap is ambiguous).
  const [pickedOwnerId, setPickedOwnerId] = useState<string | null>(null);
  // True once we've auto-started at least once, so a user hang-up doesn't
  // immediately auto-reconnect (they get an explicit "reconnect" affordance).
  const autoStartedRef = useRef(false);

  const startFromIdentity = useCallback(() => {
    if (!bootstrap.identity) return;
    autoStartedRef.current = true;
    session.startBody(bootstrap.identity);
  }, [bootstrap.identity, session]);

  // Auto-connect once bootstrap resolves an identity and the session is idle.
  useEffect(() => {
    if (bootstrap.status !== "ready" || !bootstrap.identity) return;
    if (session.phase !== "pre-call") return;
    if (autoStartedRef.current) return;
    startFromIdentity();
  }, [bootstrap.status, bootstrap.identity, session.phase, startFromIdentity]);

  const handlePickOwner = useCallback((ownerId: string) => {
    setPickedOwnerId(ownerId);
  }, []);

  const handleResolvePickedOwner = useCallback(
    (ownerId: string) => {
      autoStartedRef.current = false; // allow the auto-start effect to fire again
      bootstrap.resolveOwner(ownerId);
    },
    [bootstrap],
  );

  const handleRetry = useCallback(() => {
    autoStartedRef.current = false;
    bootstrap.retry();
  }, [bootstrap]);

  const handleReconnect = useCallback(() => {
    startFromIdentity();
  }, [startFromIdentity]);

  // Whether the pre-call slot means "hung up" (already auto-started once) vs
  // the brief moment before the first auto-start fires.
  const hungUp = bootstrap.status === "ready" && session.phase === "pre-call" && autoStartedRef.current;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
      <AmbientBackground />

      {/* 顶部状态条 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 text-white">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em]">
          <span className={`h-2 w-2 rounded-full ${session.phase === "in-call" ? "bg-cyan-300 " + styles.statusDot : "bg-white/30"}`} />
          <span className="text-cyan-100/70">{session.config.appTitle}</span>
        </div>
        <div className="font-mono text-[11px] tracking-[0.25em] text-cyan-200/40">
          <span>SES://{session.phase === "in-call" ? "ONLINE" : "OFFLINE"}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Bootstrap: waking up (resolving who I am) */}
        {bootstrap.status === "resolving" && (
          <StatusOverlay key="waking" title="正在唤醒你的伙伴…" />
        )}

        {/* Bootstrap failed (admin unreachable / misconfigured) */}
        {bootstrap.status === "error" && (
          <StatusOverlay
            key="boot-error"
            tone="error"
            title="无法连接到你的伙伴"
            detail={bootstrap.error}
            actionLabel="重试"
            onAction={handleRetry}
          />
        )}

        {/* Ambiguous: several owners, no default — minimal picker */}
        {bootstrap.status === "ambiguous" && (
          <PreCallCard
            key="pick"
            appTitle={session.config.appTitle}
            owners={owners}
            ownersLoading={ownersLoading}
            ownersError={ownersError}
            selectedOwnerId={pickedOwnerId}
            onSelect={handlePickOwner}
            onRefresh={refreshOwners}
            onStart={handleResolvePickedOwner}
            error={bootstrap.error}
          />
        )}

        {/* Ready + connecting to LiveKit */}
        {bootstrap.status === "ready" && session.phase === "connecting" && (
          <ConnectionOverlay key="conn" label="连接中…" />
        )}

        {/* Ready but the LiveKit handshake failed */}
        {bootstrap.status === "ready" && session.phase === "error" && (
          <StatusOverlay
            key="sess-error"
            tone="error"
            title="连接失败"
            detail={session.error}
            actionLabel="重试"
            onAction={handleReconnect}
          />
        )}

        {/* Ready + user hung up → offer reconnect */}
        {hungUp && (
          <StatusOverlay
            key="reconnect"
            title="通话已结束"
            detail="随时可以再次开始对话。"
            actionLabel="重新连接"
            onAction={handleReconnect}
          />
        )}
      </AnimatePresence>

      {/* 实际通话：放在 LiveKitRoom 里，子组件能用 hooks 取上下文 */}
      {session.phase === "in-call" && session.token && (
        <LiveKitRoom
          serverUrl={session.serverUrl}
          token={session.token}
          connect
          audio={{
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }}
          video={false}
          className="absolute inset-0"
          // LiveKit 默认主题 .lk-room-container 会用 --lk-bg(#fff) 画白底，盖掉全息背景；置透明
          style={{ background: "transparent" }}
        >
          <RoomAudioRenderer />
          <StartAudio label="Enable Audio" />
          <InCallInner onDisconnect={session.stop} idleFaceUrl={idleFaceUrl} />
        </LiveKitRoom>
      )}
    </div>
  );
}

/**
 * in-call 阶段的内层；放在 LiveKitRoom 内部，能用 useRoomContext / useDataChannel 等。
 */
function InCallInner({
  onDisconnect,
  idleFaceUrl,
}: {
  onDisconnect: () => void;
  idleFaceUrl: string | null;
}) {
  const controller = useAvatarController();
  // Runtime face selection. The avatar worker publishes its video track for the
  // whole session (a frozen frame when idle), so track presence alone is NOT the
  // signal — we show the live talking-head only while the agent is *speaking*.
  // Otherwise we render idle locally: the configured face with micro-motion
  // (档3) when available, else the particle head. This keeps idle from freezing
  // and consumes no server video at idle.
  const avatarVideo = useAvatarVideoTrack();
  const showVideo = controller.state === "speaking" && Boolean(avatarVideo);
  const { bubbles } = useBubbleStream();
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  useClientAudioStatePublisher({
    inputMode: "auto",
    playbackState:
      controller.state === "speaking"
        ? PLAYBACK_STATE_AGENT_SPEAKING
        : PLAYBACK_STATE_IDLE,
  });

  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          {showVideo ? (
            <motion.div
              key="video"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <VideoAvatarStage trackRef={avatarVideo!} />
            </motion.div>
          ) : idleFaceUrl ? (
            <motion.div
              key="idle-face"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <IdleFaceStage imageUrl={idleFaceUrl} />
            </motion.div>
          ) : (
            <motion.div
              key="particle"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <AvatarStage controller={controller} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <HudOverlay state={controller.state} />
      <BubbleLayer bubbles={bubbles} />
      <ControlDock onDisconnect={onDisconnect} elapsedSec={elapsed} />
      <DiagnosticsPanel bubbles={bubbles} />
    </>
  );
}
