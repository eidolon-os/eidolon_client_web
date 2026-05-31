import React from "react";
import { motion } from "framer-motion";
import { BubbleMessage } from "../types";

interface SpeechBubbleProps {
  message: BubbleMessage;
  /** 浮动方向，agent 左下尖角、user 右下尖角 */
  position?: "left" | "right";
}

export function SpeechBubble({ message, position }: SpeechBubbleProps) {
  const isAgent = message.source === "agent";
  const align = position ?? (isAgent ? "left" : "right");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.35 } }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      className={`pointer-events-auto relative max-w-[22rem] px-5 py-3.5 text-[14.5px] leading-relaxed backdrop-blur-xl ${
        isAgent
          ? "rounded-2xl rounded-bl-sm border border-cyan-300/40 bg-cyan-950/40 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.3)]"
          : "rounded-2xl rounded-br-sm border border-sky-200/50 bg-sky-400/15 text-sky-50 shadow-[0_0_24px_rgba(56,189,248,0.35)]"
      } ${align === "left" ? "self-start" : "self-end"}`}
    >
      {/* 发光边角指引 */}
      <span
        aria-hidden
        className={`absolute bottom-1 h-2.5 w-2.5 rotate-45 border ${
          isAgent
            ? "left-2.5 border-cyan-300/40 bg-cyan-950/60"
            : "right-2.5 border-sky-200/50 bg-sky-400/25"
        }`}
      />
      <p className="break-words [text-shadow:0_0_8px_rgba(34,211,238,0.25)]">{message.text}</p>
    </motion.div>
  );
}
