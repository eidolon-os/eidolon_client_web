import React from "react";
import { VideoTrack } from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-react";

/**
 * Photoreal digital-human video stage — an alternative renderer to the particle
 * {@link AvatarStage}, selected at runtime when the avatar worker publishes a
 * video track (see {@link useAvatarVideoTrack}).
 *
 * This is the swappable-backend the avatar module's README documents: it lives
 * behind the same "face slot" as the particle head and shares all the
 * surrounding chrome (bubbles / HUD / control dock). The audio is carried by the
 * worker's own audio track and rendered by the room's ``RoomAudioRenderer``, so
 * this component only paints the picture.
 */
export function VideoAvatarStage({
  trackRef,
  className,
}: {
  trackRef: TrackReference;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      <VideoTrack
        trackRef={trackRef}
        // The talking-head is portrait (e.g. 448x448); "contain" keeps the whole
        // face visible and centered rather than cropping to fill a wide viewport.
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}
