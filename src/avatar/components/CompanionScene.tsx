import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { LiveKitRoom, RoomAudioRenderer, StartAudio } from "@livekit/components-react";
import "@livekit/components-styles";
import { useCompanionSession } from "../hooks/useCompanionSession";
import { useAvatarController } from "../hooks/useAvatarController";
import { useBubbleStream } from "../hooks/useBubbleStream";
import { AmbientBackground } from "./AmbientBackground";
import { PreCallCard } from "./PreCallCard";
import { ConnectionOverlay } from "./ConnectionOverlay";
import { BubbleLayer } from "./BubbleLayer";
import { ControlDock } from "./ControlDock";
import { DiagnosticsPanel } from "./DiagnosticsPanel";

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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
      <AmbientBackground />

      {/* 顶部状态条 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 text-white">
        <div className="flex items-center gap-2 text-sm tracking-wide">
          <span className={`h-2 w-2 rounded-full ${session.phase === "in-call" ? "bg-emerald-400" : "bg-white/30"}`} />
          <span className="text-white/70">{session.config.appTitle}</span>
        </div>
        <div className="text-xs text-white/40">
          {session.phase === "in-call" && session.roomName && (
            <span className="font-mono">{session.roomName}</span>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {session.phase === "pre-call" && (
          <PreCallCard
            key="pre"
            appTitle={session.config.appTitle}
            onStart={session.start}
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
            onStart={session.start}
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
          audio
          video={false}
          className="absolute inset-0"
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
      <BubbleLayer bubbles={bubbles} />
      <ControlDock onDisconnect={onDisconnect} elapsedSec={elapsed} />
      <DiagnosticsPanel bubbles={bubbles} />
    </>
  );
}
