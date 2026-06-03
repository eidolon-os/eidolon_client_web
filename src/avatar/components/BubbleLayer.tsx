import React, { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { BubbleMessage } from "../types";
import { SpeechBubble } from "./SpeechBubble";

interface BubbleLayerProps {
  bubbles: BubbleMessage[];
}

/**
 * 字幕记录层：左侧一列**持久聊天记录**，最新在底部，旧的向上滚动（可手动上滑查看历史）。
 * agent 左对齐、user 右对齐。新消息到达时自动滚到底部（除非用户正在上滑查看历史）。
 */
export function BubbleLayer({ bubbles }: BubbleLayerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  // 记录用户是否停留在底部；只有在底部时才自动跟随新消息
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = dist < 48;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [bubbles]);

  return (
    <div className="pointer-events-none absolute bottom-28 left-6 top-24 z-10 flex w-[min(26rem,42vw)] flex-col justify-end">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="pointer-events-auto flex max-h-full flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:thin]"
      >
        <AnimatePresence initial={false}>
          {bubbles.map((b) => (
            <SpeechBubble key={b.id} message={b} position={b.source === "agent" ? "left" : "right"} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
