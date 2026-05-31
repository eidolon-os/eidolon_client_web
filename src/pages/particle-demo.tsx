import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { AmbientBackground } from "@/avatar/components/AmbientBackground";
import { AvatarController, AvatarState } from "@/avatar/types";

// 与 CompanionScene 一致：dynamic ssr:false 隔离 WebGL
const AvatarStage = dynamic(
  () => import("@/avatar/components/AvatarStage").then((m) => m.AvatarStage),
  { ssr: false }
);

const STATES: AvatarState[] = ["idle", "listening", "thinking", "speaking"];

/**
 * 仅用于本地视觉验证：无需 LiveKit/agent。
 * mock controller 自动循环四态，并用正弦波模拟音量驱动口型。
 */
export default function ParticleDemoPage() {
  const [state, setState] = useState<AvatarState>("idle");
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      setState((s) => STATES[(STATES.indexOf(s) + 1) % STATES.length]);
    }, 4500);
    return () => clearInterval(id);
  }, [auto]);

  const controller: AvatarController = useMemo(
    () => ({
      state,
      volume: 0,
      // 正弦波模拟实时音量（仅 speaking 态生效）
      getVolume: () => 0.5 + 0.5 * Math.sin(performance.now() / 220),
    }),
    [state]
  );

  // ?model=/avatar/cand/xxx.glb 覆盖头模；?count=110000 覆盖点数（用于调试细腻度）
  // 关键：先解析完 query 再挂载 AvatarStage，避免「先加载默认模型再 remount」造成的双重重采样卡顿
  const [params, setParams] = useState<{ model?: string; count?: number } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = q.get("count");
    setParams({ model: q.get("model") ?? undefined, count: c ? parseInt(c, 10) : undefined });
  }, []);

  return (
    <>
      <Head>
        <title>Particle Avatar Demo</title>
      </Head>
      <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
        <AmbientBackground />
        <div className="absolute inset-0">
          {params && (
            <AvatarStage
              key={`${params.model ?? "default"}-${params.count ?? "auto"}`}
              controller={controller}
              modelUrl={params.model}
              particleCount={params.count}
            />
          )}
        </div>

        {/* 手动状态切换 */}
        <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setAuto((a) => !a)}
            className="rounded border border-cyan-300/40 bg-cyan-500/10 px-3 py-1.5 uppercase tracking-widest text-cyan-100 hover:bg-cyan-500/20"
          >
            {auto ? "AUTO ▶" : "AUTO ⏸"}
          </button>
          {STATES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setAuto(false);
                setState(s);
              }}
              className={`rounded border px-3 py-1.5 uppercase tracking-widest transition-colors ${
                state === s
                  ? "border-cyan-300 bg-cyan-400/30 text-white"
                  : "border-cyan-300/30 bg-cyan-500/5 text-cyan-200/70 hover:bg-cyan-500/15"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
