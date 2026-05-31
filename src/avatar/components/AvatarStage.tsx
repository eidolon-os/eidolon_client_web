import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AvatarStageProps } from "../types";
import { ParticleHead } from "../particles/ParticleHead";
import { sampleHeadGeometry } from "../particles/sampleHeadFromGLB";
import { createImageParticles } from "../particles/createImageParticles";
import { createHeadGeometry } from "../particles/createHeadParticles";
import { PORTRAIT_URL } from "../constants";
import styles from "../styles/companion.module.css";

/**
 * 全息粒子人像舞台。
 *
 * 几何来源（二选一）：
 *  - 默认：肖像图 → 粒子（createImageParticles）。清晰度=图片分辨率，平面 2.5D。
 *  - 传 modelUrl：GLB 头模表面采样（3D 可转）。
 * 失败回退到程序化抽象头。
 *
 * 渲染层与 LiveKit 解耦——只消费 controller.state + controller.getVolume()。
 * rAF 里读 getVolume()，不走 React state。组件以 dynamic(ssr:false) 引入。
 */
export function AvatarStage({ controller, modelUrl, imageUrl, particleCount, className }: AvatarStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<ParticleHead | null>(null);
  const [ready, setReady] = useState(false);

  // 加载 GLB → 采样点云 → 实例化 ParticleHead + rAF 驱动（mount 一次）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let raf = 0;
    let ro: ResizeObserver | null = null;

    const start = (geometry: THREE.BufferGeometry | undefined, flat: boolean) => {
      if (cancelled || !container) return;
      const head = new ParticleHead(container, { geometry, flat });
      headRef.current = head;
      head.setState(controller.state);
      setReady(true);

      let last = performance.now();
      const tick = (now: number) => {
        const dt = (now - last) / 1000;
        last = now;
        head.update(controller.getVolume(), dt);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      ro = new ResizeObserver(() => head.resize());
      ro.observe(container);
    };

    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    if (modelUrl) {
      // 3D 路径：GLB 头模表面采样（采样较重，点数保守）
      const count = particleCount ?? (isMobile ? 45000 : 80000);
      sampleHeadGeometry(modelUrl, count)
        .then((geo) => start(geo, false))
        .catch((err) => { console.error("[avatar] GLB 采样失败，回退程序化:", err); start(createHeadGeometry(count), false); });
    } else {
      // 默认：肖像图 → 粒子（像素采样很快，可用更高点数让轮廓更细腻）
      const count = particleCount ?? (isMobile ? 60000 : 110000);
      createImageParticles(imageUrl ?? PORTRAIT_URL, count)
        .then((geo) => start(geo, true))
        .catch((err) => { console.error("[avatar] 图片采样失败，回退程序化:", err); start(createHeadGeometry(count), false); });
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      headRef.current?.dispose();
      headRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl, imageUrl]);

  // 状态变化 → 平滑切换粒子运动模式
  useEffect(() => {
    headRef.current?.setState(controller.state);
  }, [controller.state]);

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      <div className={`${styles.backlight} ${controller.state === "speaking" ? styles.backlightActive : ""}`} />
      <div ref={containerRef} className="absolute inset-0" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-cyan-400/20 border-t-cyan-300" />
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-200/70">
              Materializing…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
