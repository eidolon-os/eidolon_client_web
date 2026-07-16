import { Track } from "livekit-client";
import { useTracks } from "@livekit/components-react";
import type { TrackReference } from "@livekit/components-react";

/**
 * Identity prefix of the digital-human avatar worker participant. The channel
 * spawns it as ``avatar-<room>`` (see channel ``eidolon/livekit/avatar/worker.py``
 * ``avatar_identity_for``). It publishes a synchronized talking-head video+audio
 * track when the session runs in avatar mode.
 */
export const AVATAR_IDENTITY_PREFIX = "avatar-";

/**
 * The avatar worker's camera-source video track, once subscribed, or undefined.
 *
 * Runtime-dynamic: returns a track only when the session is actually running an
 * avatar worker. Callers render the photoreal video when present and fall back
 * to the particle stage otherwise — no per-session config needed on the render
 * side; it simply reflects whatever tracks the room contains.
 */
export function useAvatarVideoTrack(): TrackReference | undefined {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  return tracks.find(
    (t) =>
      t.participant.identity.startsWith(AVATAR_IDENTITY_PREFIX) &&
      Boolean(t.publication?.track),
  ) as TrackReference | undefined;
}
