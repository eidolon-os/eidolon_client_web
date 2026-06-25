import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { LiveKitRoom, RoomAudioRenderer, StartAudio } from "@livekit/components-react";
import "@livekit/components-styles";
import { useCompanionSession } from "../hooks/useCompanionSession";
import { useAvatarController } from "../hooks/useAvatarController";
import { useBubbleStream } from "../hooks/useBubbleStream";
import { useClientAudioStatePublisher } from "@/hooks/useClientAudioStatePublisher";
import {
  PLAYBACK_STATE_AGENT_SPEAKING,
  PLAYBACK_STATE_IDLE,
} from "@/lib/contracts";
import { useUsers } from "@/hooks/useUsers";
import { AmbientBackground } from "./AmbientBackground";
import { PreCallCard } from "./PreCallCard";
import { ConnectionOverlay } from "./ConnectionOverlay";
import { BubbleLayer } from "./BubbleLayer";
import { ControlDock } from "./ControlDock";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { HudOverlay } from "./HudOverlay";
import styles from "../styles/companion.module.css";

// Phase 32.C (companion follow-up): share the same persisted-identity
// key with the main /index page so picking a user in one place hydrates
// the other. Both pages dispatch to the same hub /api/config user_id
// validation, so the persistence semantics line up exactly.
const SELECTED_USER_STORAGE_KEY = "eidolon.client_web.selected_user_id";

// AvatarStage 用 dynamic import 隔离 WebGL / three.js，避免 SSR 报错
const AvatarStage = dynamic(
  () => import("./AvatarStage").then((m) => m.AvatarStage),
  { ssr: false }
);

/**
 * Companion 体验的顶层场景：
 *  pre-call:   AmbientBackground + PreCallCard
 *  connecting: AmbientBackground + ConnectionOverlay
 *  in-call:    AmbientBackground + LiveKitRoom( AvatarStage + BubbleLayer + ControlDock )
 */
export function CompanionScene() {
  const session = useCompanionSession();
  const {
    users,
    loading: usersLoading,
    error: usersError,
    refresh: refreshUsers,
  } = useUsers(session.config.adminApiUrl);

  // localStorage hydration (mirrors index.tsx). Wrapped in useEffect so
  // Next.js SSR doesn't trip on ``window``.
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(SELECTED_USER_STORAGE_KEY);
    if (saved) setSelectedUserId(saved);
  }, []);
  useEffect(() => {
    if (!selectedUserId) return;
    if (usersLoading) return;
    if (users.length === 0) return;
    const still = users.some((u) => u.user_id === selectedUserId);
    if (!still) {
      setSelectedUserId(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SELECTED_USER_STORAGE_KEY);
      }
    }
  }, [users, usersLoading, selectedUserId]);

  const handleSelectUser = useCallback((userId: string) => {
    setSelectedUserId(userId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELECTED_USER_STORAGE_KEY, userId);
    }
  }, []);

  const handleStart = useCallback(
    (userId: string) => {
      const picked = users.find((u) => u.user_id === userId);
      session.start(userId, picked?.display_name);
    },
    [session, users],
  );

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
          {session.phase === "in-call" && session.roomName ? (
            <span>SES://{session.roomName}</span>
          ) : (
            <span>SES://OFFLINE</span>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {session.phase === "pre-call" && (
          <PreCallCard
            key="pre"
            appTitle={session.config.appTitle}
            users={users}
            usersLoading={usersLoading}
            usersError={usersError}
            selectedUserId={selectedUserId}
            onSelect={handleSelectUser}
            onRefresh={refreshUsers}
            onStart={handleStart}
            error={session.error}
          />
        )}

        {session.phase === "connecting" && (
          <ConnectionOverlay key="conn" label="Connecting…" />
        )}

        {session.phase === "error" && (
          <PreCallCard
            key="err"
            appTitle={session.config.appTitle}
            users={users}
            usersLoading={usersLoading}
            usersError={usersError}
            selectedUserId={selectedUserId}
            onSelect={handleSelectUser}
            onRefresh={refreshUsers}
            onStart={handleStart}
            error={session.error}
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
          <InCallInner onDisconnect={session.stop} />
        </LiveKitRoom>
      )}
    </div>
  );
}

/**
 * in-call 阶段的内层；放在 LiveKitRoom 内部，能用 useRoomContext / useDataChannel 等。
 */
function InCallInner({ onDisconnect }: { onDisconnect: () => void }) {
  const controller = useAvatarController();
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
        <AvatarStage controller={controller} />
      </div>
      <HudOverlay state={controller.state} />
      <BubbleLayer bubbles={bubbles} />
      <ControlDock onDisconnect={onDisconnect} elapsedSec={elapsed} />
      <DiagnosticsPanel bubbles={bubbles} />
    </>
  );
}
