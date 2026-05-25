import React from "react";
import { AnimatePresence } from "framer-motion";
import { BubbleMessage } from "../types";
import { SpeechBubble } from "./SpeechBubble";

interface BubbleLayerProps {
  bubbles: BubbleMessage[];
}

/**
 * 气泡层：在角色上方区域以纵向堆叠展示气泡。
 * agent 气泡贴右上、user 气泡贴左下，便于和 3D 角色构图。
 */
export function BubbleLayer({ bubbles }: BubbleLayerProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex">
      {/* Agent 区：右上 */}
      <div className="absolute right-[6%] top-[12%] flex max-w-[28rem] flex-col items-end gap-3">
        <AnimatePresence initial={false}>
          {bubbles
            .filter((b) => b.source === "agent")
            .map((b) => (
              <SpeechBubble key={b.id} message={b} position="left" />
            ))}
        </AnimatePresence>
      </div>

      {/* User 区：左下 */}
      <div className="absolute bottom-[24%] left-[6%] flex max-w-[24rem] flex-col items-start gap-3">
        <AnimatePresence initial={false}>
          {bubbles
            .filter((b) => b.source === "user")
            .map((b) => (
              <SpeechBubble key={b.id} message={b} position="right" />
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
