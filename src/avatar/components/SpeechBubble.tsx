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
      className={`pointer-events-auto relative max-w-[22rem] px-5 py-3.5 text-[15px] leading-relaxed ${
        isAgent
          ? "rounded-3xl rounded-bl-md bg-white/85 text-slate-900 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl"
          : "rounded-3xl rounded-br-md bg-violet-500/90 text-white shadow-[0_8px_30px_rgba(124,58,237,0.45)] backdrop-blur-md"
      } ${align === "left" ? "self-start" : "self-end"}`}
    >
      {/* 三角尖角 */}
      <span
        aria-hidden
        className={`absolute bottom-1.5 h-3 w-3 rotate-45 ${
          isAgent
            ? "left-3 bg-white/85"
            : "right-3 bg-violet-500/90"
        }`}
      />
      <p className="break-words">{message.text}</p>
    </motion.div>
  );
}
