/**
 * Device⇄server wire contract — TypeScript view (web client).
 *
 * SOURCE OF RECORD is the Python module `eidolon_sdk/eidolon_sdk/contracts`.
 * This file is the exported TS mirror (plan Track A2): keep the values byte-for-
 * byte identical. `eidolon_sdk/tests/contracts/test_contracts.py` pins the
 * Python side; when you change a value there, change it here too.
 *
 * Why this exists: the topic names / enum strings / `type` labels used to be
 * hand-copied inline across the web client. A single typo degraded silently
 * (e.g. the body `type` was set to the topic string, so the server dropped every
 * client.audio_state packet). Centralizing kills that class of bug.
 */

// Bump in lockstep with Python WIRE_SCHEMA_VERSION on a breaking envelope change.
export const WIRE_SCHEMA_VERSION = 1;

// LiveKit data-channel topics.
export const CLIENT_AUDIO_STATE_TOPIC = "eidolon.audio_state"; // device → server
export const CONTROL_TOPIC = "eidolon.control"; // server → device
export const COMPANION_UI_STATE_TOPIC = "eidolon.ui_state"; // server → device
export const SESSION_CONTROL_TOPIC = "eidolon.session_control"; // server → device

// client.audio_state — body "type" label (NOT the routing topic above).
export const CLIENT_AUDIO_STATE_TYPE = "client.audio_state";

export type InputMode = "auto" | "ptt" | "manual";
export type PlaybackState = "idle" | "agent_speaking";

export const INPUT_MODE_AUTO: InputMode = "auto";
export const INPUT_MODE_PTT: InputMode = "ptt";
export const INPUT_MODE_MANUAL: InputMode = "manual";

export const PLAYBACK_STATE_IDLE: PlaybackState = "idle";
export const PLAYBACK_STATE_AGENT_SPEAKING: PlaybackState = "agent_speaking";

// session_end — server → device teardown notice (SESSION_CONTROL_TOPIC).
export const SESSION_END_TYPE = "session_end";
export const SESSION_END_IDLE_NORMAL = "idle_normal_end";
export const SESSION_END_USER_LEFT = "user_left";
export const SESSION_END_ERROR = "error";
export const SESSION_END_PROACTIVE_DONE = "proactive_done";
export const SESSION_END_SUPERSEDED = "superseded";

// Session metadata enums (hub stamps these into the token; web declares
// full_duplex). Mirrored for completeness.
export const INTERACTION_MODE_HALF_DUPLEX = "half_duplex";
export const INTERACTION_MODE_FULL_DUPLEX = "full_duplex";
export const SESSION_INTENT_USER_INITIATED = "user_initiated";
export const SESSION_INTENT_PROACTIVE = "proactive_initiated";

// Device control ops carried as `op` in the eidolon.control envelope.
export const CONTROL_OP_ROOM_JOIN = "room.join";
export const CONTROL_OP_PLAYBACK_STOP = "playback.stop";
export const CONTROL_OP_CONFIG_REFRESH = "config.refresh";
