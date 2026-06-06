import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    res.status(204).end();
    return;
  }

  const body = typeof req.body === "object" && req.body !== null ? req.body : {};
  const payload = typeof body.payload === "object" && body.payload !== null
    ? body.payload as Record<string, unknown>
    : {};
  console.log("[client_audio_state]", {
    event: body.event,
    reason: body.reason,
    room: body.room,
    local_identity: body.local_identity,
    seq: payload.seq,
    playback_state: payload.playback_state,
    mic_muted: payload.mic_muted,
    reliable: body.reason !== "heartbeat",
    error: body.error || undefined,
  });
  res.status(204).end();
}
