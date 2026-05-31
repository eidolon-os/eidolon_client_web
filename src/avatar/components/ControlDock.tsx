import React, { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { useRoomContext } from "@livekit/components-react";
import styles from "../styles/companion.module.css";

interface ControlDockProps {
  onDisconnect: () => void;
  elapsedSec: number;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function ControlDock({ onDisconnect, elapsedSec }: ControlDockProps) {
  const room = useRoomContext();
  const [muted, setMuted] = useState(false);

  const toggleMute = useCallback(() => {
    if (!room?.localParticipant) return;
    const next = !muted;
    room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }, [muted, room]);

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="pointer-events-auto absolute bottom-8 left-1/2 -translate-x-1/2"
    >
      <div className={`${styles.glass} ${styles.hudCut} flex items-center gap-4 px-6 py-3 text-white`}>
        {/* 计时 */}
        <span className="flex items-center gap-2 px-1 font-mono text-sm tracking-widest text-cyan-200/80">
          <span className={`h-1.5 w-1.5 rounded-full bg-cyan-300 ${styles.statusDot}`} />
          {fmt(elapsedSec)}
        </span>

        {/* Mute */}
        <button
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ${
            muted
              ? "border border-rose-400/60 bg-rose-500/30 text-rose-100 hover:bg-rose-500/45"
              : `${styles.holoBtn} text-cyan-100`
          }`}
        >
          {muted ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        {/* End call */}
        <button
          onClick={onDisconnect}
          aria-label="End call"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-300/50 bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.5)] transition-transform hover:scale-105 active:scale-95"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
