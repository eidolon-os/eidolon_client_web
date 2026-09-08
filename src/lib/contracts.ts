/**
 * Device⇄server wire contract — TypeScript view (web client).
 *
 * SOURCE OF RECORD is the Python module `eidolon_sdk.biz.contracts`
 * (`eidolon_sdk/eidolon_sdk/biz/contracts/__init__.py`). This file is the TS
 * mirror: the values are byte-for-byte identical, and that is now checked
 * rather than requested. `tests/wireContractMirror.test.ts` compares every
 * constant below against the contract and holds `wire_contract_mirror.json` to
 * the whole of it, so a name added to the contract fails here until somebody
 * either mirrors it or records why this client does not carry it.
 *
 * Adding a constant here means adding its decision to that ledger. Most of what
 * this file declares is not read anywhere yet — see `_declared_only` in the
 * ledger — so a wrong value would sit inert rather than break something, which
 * is exactly why it is worth checking.
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

// Session metadata enums. Hub stamps these into the participant token and this
// client joins with the token it is given — it declares no interaction mode of
// its own, despite what an earlier version of this comment said. Mirrored for
// completeness; nothing here reads them.
export const INTERACTION_MODE_HALF_DUPLEX = "half_duplex";
export const INTERACTION_MODE_FULL_DUPLEX = "full_duplex";
export const SESSION_INTENT_USER_INITIATED = "user_initiated";
export const SESSION_INTENT_PROACTIVE = "proactive_initiated";

// Device control ops carried as `op` in the eidolon.control envelope.
export const CONTROL_OP_ROOM_JOIN = "room.join";
export const CONTROL_OP_PLAYBACK_STOP = "playback.stop";
export const CONTROL_OP_CONFIG_REFRESH = "config.refresh";
