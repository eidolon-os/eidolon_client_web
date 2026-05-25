import React from "react";
import { motion } from "framer-motion";

export function ConnectionOverlay({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-auto absolute inset-0 flex items-center justify-center"
    >
      <div className="flex flex-col items-center gap-5 text-white">
        <div className="relative h-20 w-20">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border border-violet-300/60"
              animate={{ scale: [1, 1.8], opacity: [0.8, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
            />
          ))}
          <span className="absolute inset-3 rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-cyan-300" />
        </div>
        <p className="text-sm tracking-wide text-white/70">{label}</p>
      </div>
    </motion.div>
  );
}
