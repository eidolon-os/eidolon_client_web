import React from "react";
import styles from "../styles/companion.module.css";

/**
 * Idle digital-human stage (档1): plays the companion's offline-generated
 * looping idle clip (a few seconds of the configured face gently moving, driven
 * by silence). Rendered locally at idle instead of consuming the avatar
 * service's live video; the scene crossfades to the real talking-head while
 * speaking. If the clip fails to load, ``onError`` lets the scene fall back to
 * the still micro-motion (档3) or the particle head.
 */
export function IdleVideoStage({
  videoUrl,
  onError,
  className,
}: {
  videoUrl: string;
  onError?: () => void;
  className?: string;
}) {
  return (
    <div className={`${styles.idleFaceStage} ${className ?? ""}`}>
      <video
        className={styles.idleVideo}
        src={videoUrl}
        autoPlay
        loop
        muted
        playsInline
        onError={onError}
      />
      <div className={styles.idleFaceSheen} aria-hidden />
    </div>
  );
}
