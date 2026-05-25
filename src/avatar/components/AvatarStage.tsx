import React, { useEffect, useRef, useState } from "react";
import { DEFAULT_AVATAR_BODY, DEFAULT_AVATAR_URL, STATE_TO_GESTURE, STATE_TO_MOOD } from "../constants";
import { AvatarStageProps } from "../types";
import styles from "../styles/companion.module.css";

/**
 * 3D 角色舞台。
 *
 * 设计要点：
 * 1. TalkingHead 是浏览器专属库（用了 window / WebGL），用 dynamic import 避开 SSR
 * 2. 不走 TalkingHead 的 speakAudio/TTS pipeline；只用它来加载模型 + 跑 idle 动画
 *    嘴型用 controller.getVolume() 在 rAF 里直接驱动 jawOpen morph target
 * 3. controller.state 变化时切 mood / 触发 gesture
 */
export function AvatarStage({ controller, modelUrl, className }: AvatarStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<unknown | null>(null);
  const rafRef = useRef<number | null>(null);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 1. 初始化 TalkingHead + 加载模型（仅在 modelUrl 变化时重跑）
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!containerRef.current) return;
      try {
        // 通过 CDN 动态加载，绕开 webpack 对 TalkingHead 内部模块的解析。
        // 用 esm.sh 而非 jsdelivr：esm.sh 会自动把 TalkingHead 内部的
        // 裸 import（如 `import "three"`）改写成 esm.sh 上的对应 URL，
        // 解决浏览器原生 ESM 不识别 bare specifier 的问题。
        const cdnUrl = process.env.NEXT_PUBLIC_TALKINGHEAD_CDN ??
          "https://esm.sh/@met4citizen/talkinghead@1.7";
        const mod: { TalkingHead: new (node: HTMLElement, opts: Record<string, unknown>) => unknown } =
          await (new Function("url", "return import(url)") as (url: string) => Promise<{ TalkingHead: new (node: HTMLElement, opts: Record<string, unknown>) => unknown }>)(cdnUrl);
        const TalkingHead = mod.TalkingHead;

        const head = new TalkingHead(containerRef.current, {
          // 我们不使用 TTS，但 TalkingHead 构造需要一个 endpoint；给占位即可，
          // 我们永远不调用 head.speakText
          ttsEndpoint: "https://invalid.local/tts",
          // 不加载任何 lipsync 子模块 —— 我们用 setFixedValue 直接驱动嘴型，
          // 不依赖 TalkingHead 自带的文本→viseme 算法
          lipsyncModules: [],
          cameraView: "upper",
          modelFPS: 30,
        });
        if (cancelled) return;
        headRef.current = head;

        await (head as { showAvatar: (opt: Record<string, unknown>, onProg?: (ev: ProgressEvent) => void) => Promise<void> }).showAvatar(
          {
            url: modelUrl ?? DEFAULT_AVATAR_URL,
            body: DEFAULT_AVATAR_BODY,
            avatarMood: "neutral",
            lipsyncLang: "en",
          },
          (ev: ProgressEvent) => {
            if (ev.lengthComputable) {
              setLoadProgress(Math.round((ev.loaded / ev.total) * 100));
            }
          }
        );
        if (cancelled) return;
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(msg);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const head = headRef.current as { dispose?: () => void; stop?: () => void } | null;
      try { head?.stop?.(); } catch { /* noop */ }
      try { head?.dispose?.(); } catch { /* noop */ }
      headRef.current = null;
    };
  }, [modelUrl]);

  // 2. 实时音量 → jawOpen / mouthOpen morph target
  useEffect(() => {
    if (!ready) return;
    const head = headRef.current as { setFixedValue?: (key: string, val: number) => void } | null;
    if (!head?.setFixedValue) return;

    const tick = () => {
      const vol = controller.getVolume();
      try {
        head.setFixedValue!("jawOpen", vol * 0.7);
        head.setFixedValue!("mouthOpen", vol * 0.5);
      } catch { /* noop */ }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready, controller]);

  // 3. state → mood + gesture
  useEffect(() => {
    if (!ready) return;
    const head = headRef.current as {
      setMood?: (m: string) => void;
      playGesture?: (n: string, dur: number, mirror?: boolean, ms?: number) => void;
    } | null;
    if (!head) return;
    try {
      head.setMood?.(STATE_TO_MOOD[controller.state]);
      const gesture = STATE_TO_GESTURE[controller.state];
      if (gesture) head.playGesture?.(gesture.name, gesture.durationSec, false, 800);
    } catch { /* noop */ }
  }, [ready, controller.state]);

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      {/* 背光 + 地面阴影 */}
      <div className={`${styles.backlight} ${controller.state === "speaking" ? styles.backlightActive : ""}`} />
      <div className={styles.groundShadow} />

      {/* TalkingHead 注入 canvas 的容器 */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* 加载态 */}
      {!ready && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/5 px-8 py-6 backdrop-blur-sm">
            <div className="h-14 w-14 animate-spin rounded-full border-[3px] border-white/15 border-t-violet-300" />
            <p className="text-sm font-medium tracking-wider text-white/85">
              Loading avatar… {loadProgress}%
            </p>
          </div>
        </div>
      )}

      {/* 加载错误 —— 显眼版 */}
      {loadError && (
        <div className="pointer-events-auto absolute inset-x-6 top-1/2 z-10 -translate-y-1/2 mx-auto max-w-2xl rounded-2xl border border-rose-400/60 bg-rose-950/85 px-6 py-5 text-white shadow-2xl shadow-rose-500/30 backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/30 ring-2 ring-rose-400/60">
              <svg className="h-5 w-5 text-rose-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold tracking-wide text-rose-100">
                Avatar 加载失败
              </h3>
              <p className="mt-1.5 break-words text-sm text-rose-50/95">
                {loadError}
              </p>
              <p className="mt-3 text-xs text-rose-200/80">
                可在 <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono">.env.local</code> 设置{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono">NEXT_PUBLIC_TALKINGHEAD_CDN</code>{" "}
                或{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono">NEXT_PUBLIC_AVATAR_URL</code>{" "}
                指向可访问的 mirror，然后重启 dev server。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
