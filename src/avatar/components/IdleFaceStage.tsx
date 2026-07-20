import React from "react";
import styles from "../styles/companion.module.css";

/**
 * Idle digital-human stage (档3): the companion's configured display face with a
 * lightweight, purely-CSS "alive" micro-motion (breathing scale, slow drift, a
 * holographic sheen pulse).
 *
 * Rendered locally whenever the agent is not actively speaking, so idle never
 * shows the avatar service's frozen video frame and consumes no server video.
 * The scene crossfades to {@link VideoAvatarStage} (real lip-sync) while
 * speaking and back to this while idle — same configured face on both sides, so
 * there is no identity or style jump. A literal eyelid blink needs face
 * landmarks or an offline-generated clip (档1) and is intentionally out of scope
 * here.
 */
export function IdleFaceStage({
  imageUrl,
  className,
}: {
  imageUrl: string;
  className?: string;
}) {
  return (
    <div className={`${styles.idleFaceStage} ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- runtime cross-origin admin URL, not a static asset */}
      <img className={styles.idleFaceImg} src={imageUrl} alt="" draggable={false} />
      <div className={styles.idleFaceSheen} aria-hidden />
    </div>
  );
}
