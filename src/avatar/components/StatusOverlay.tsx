import React from "react";
import { motion } from "framer-motion";
import styles from "../styles/companion.module.css";

interface StatusOverlayProps {
  /** Short headline, e.g. "正在唤醒你的伙伴…" or "连接失败". */
  title: string;
  /** Optional secondary line (diagnostic / hint). */
  detail?: string | null;
  /** When set with ``onAction``, renders a primary action button. */
  actionLabel?: string;
  onAction?: () => void;
  /** "wake" shows a breathing orb; "error" shows a muted rose orb. */
  tone?: "wake" | "error";
}

/**
 * Full-bleed centered status card for the pre-conversation lifecycle
 * (bootstrap → connect → error/reconnect). Replaces the old form-heavy
 * pre-call surface: the common path shows only a breathing "waking…" orb,
 * and failures surface a clear diagnostic + retry.
 */
export function StatusOverlay({
  title,
  detail,
  actionLabel,
  onAction,
  tone = "wake",
}: StatusOverlayProps) {
  const orb =
    tone === "error"
      ? "from-rose-400 via-rose-500 to-orange-400"
      : "from-violet-400 via-fuchsia-400 to-cyan-300";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-auto absolute inset-0 flex items-center justify-center px-6"
    >
      <div className={`${styles.glass} w-[min(420px,86vw)] rounded-3xl p-8 text-center text-white`}>
        <div className="mb-6 flex justify-center">
          <div className={`${styles.breathing} h-16 w-16 rounded-full bg-gradient-to-br ${orb} p-[2px]`}>
            <div className="h-full w-full rounded-full bg-slate-950/80" />
          </div>
        </div>
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        {detail && (
          <p className="mx-auto mt-3 max-w-sm break-words text-sm leading-relaxed text-white/60">
            {detail}
          </p>
        )}
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
}
