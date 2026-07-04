import React, { useState, useCallback, useEffect, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { LiveKitRoom, RoomAudioRenderer, StartAudio } from "@livekit/components-react";
import "@livekit/components-styles";
import { useConfig } from "@/hooks/useConfig";
import { useConnection } from "@/hooks/useConnection";
import { useOwners } from "@/hooks/useOwners";
import { OwnerPicker } from "@/components/OwnerPicker";
import { ConversationRoom } from "@/components/ConversationRoom";
import { ManualMode } from "@/components/ManualMode";
import { PushToTalkMode } from "@/components/PushToTalkMode";
import { motion } from "framer-motion";

type ConnectionMode = "livekit" | "manual" | "ptt";

const SELECTED_OWNER_STORAGE_KEY = "eidolon.client_web.selected_owner_id";

function HomeContent() {
  const { config, validate } = useConfig();
  const {
    serverUrl,
    status,
    roomName,
    participantName,
    token,
    identity,
    error,
    connect,
    disconnect,
  } = useConnection(config.livekitUrl);

  // List admin owners for the picker. The hook
  // self-loads on mount; ``refresh()`` re-fetches (operator may have
  // just created a new owner in admin UI).
  const {
    owners,
    loading: ownersLoading,
    error: ownersError,
    refresh: refreshOwners,
  } = useOwners(config.adminApiUrl);

  const [mode, setMode] = useState<ConnectionMode>("livekit");
  const [manualConnected, setManualConnected] = useState(false);
  const [pttConnected, setPttConnected] = useState(false);
  const [pendingRoom, setPendingRoom] = useState<string>("");
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  // A "web body" launch (mission-control opened this tab with device params in
  // the URL) skips the picker and auto-connects as that companion's body.
  const [bodyLaunch, setBodyLaunch] = useState(false);
  const autoConnectedRef = useRef(false);

  // Restore last-used identity from localStorage so returning visitors
  // skip the picker if their previous selection is still valid. Stale
  // entries (owner deleted in admin) silently fall back to the picker
  // showing nothing selected.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(SELECTED_OWNER_STORAGE_KEY);
    if (saved) setSelectedOwnerId(saved);
  }, []);

  // Whenever owners finish loading, confirm the restored selection
  // still exists. If not, clear it — better than letting the user
  // hit "Start Conversation" and get a 404 from hub.
  useEffect(() => {
    if (!selectedOwnerId) return;
    if (ownersLoading) return;
    if (owners.length === 0) return;
    const still = owners.some((owner) => owner.owner_id === selectedOwnerId);
    if (!still) {
      setSelectedOwnerId(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SELECTED_OWNER_STORAGE_KEY);
      }
    }
  }, [owners, ownersLoading, selectedOwnerId]);

  const handleSelectOwner = useCallback((ownerId: string) => {
    setSelectedOwnerId(ownerId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELECTED_OWNER_STORAGE_KEY, ownerId);
    }
  }, []);

  const handleConnect = useCallback(() => {
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    if (!selectedOwnerId) {
      setValidationError("Pick an identity before starting the conversation.");
      return;
    }
    setValidationError(null);
    const room = pendingRoom.trim() || `room-${Date.now()}`;
    const picked = owners.find((owner) => owner.owner_id === selectedOwnerId);
    const displayName = picked?.display_name ?? selectedOwnerId;
    connect(room, selectedOwnerId, displayName);
  }, [validate, pendingRoom, selectedOwnerId, owners, connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  // Web-body launch: mission-control opens this tab with
  // ?owner_id=&companion_id=&device_id=&room= — auto-connect as that
  // companion's host-local body, bypassing the owner picker. Runs once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (autoConnectedRef.current) return;
    const q = new URLSearchParams(window.location.search);
    const ownerId = q.get("owner_id");
    const deviceId = q.get("device_id");
    if (!ownerId || !deviceId) return;
    autoConnectedRef.current = true;
    const companionId = q.get("companion_id");
    const room = q.get("room") ?? "";
    const err = validate();
    if (err) {
      // Leave the normal card visible so the config error is actionable.
      setValidationError(err);
      return;
    }
    setBodyLaunch(true);
    setMode("livekit");
    connect(room, ownerId, companionId ?? ownerId, { companionId, deviceId });
  }, [validate, connect]);

  useEffect(() => {
    if (status === "disconnected" || status === "error") {
      setPendingRoom("");
      // intentionally keep selectedOwnerId — it's stored across sessions.
      setManualConnected(false);
      setPttConnected(false);
      setBodyLaunch(false);
    }
  }, [status]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Pre-connection screen (hidden during a web-body auto-launch) */}
        {!bodyLaunch && status !== "connected" && status !== "connecting" && !manualConnected && !pttConnected && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-primary-500 px-6 py-5 relative">
              <h1 className="text-xl font-semibold text-white">
                {config.appTitle}
              </h1>
              <p className="text-primary-100 text-sm mt-1">
                Connect to your voice agent
              </p>
              <Link
                href="/companion"
                className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Try Companion →
              </Link>
            </div>

            {/* Mode switcher */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setMode("livekit")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  mode === "livekit"
                    ? "text-primary-600 border-b-2 border-primary-500"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Real-time
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  mode === "manual"
                    ? "text-primary-600 border-b-2 border-primary-500"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Upload Audio
              </button>
              <button
                onClick={() => setMode("ptt")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  mode === "ptt"
                    ? "text-primary-600 border-b-2 border-primary-500"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Push to Talk
              </button>
            </div>

            {/* LiveKit mode */}
            {mode === "livekit" && (
              <>
                <div className="px-6 py-6 space-y-4">
                  {validationError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {validationError}
                    </div>
                  )}

                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Room Name
                    </label>
                    <input
                      type="text"
                      value={pendingRoom}
                      onChange={(e) => setPendingRoom(e.target.value)}
                      placeholder="e.g., my-session-001"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Identity
                    </label>
                      <OwnerPicker
                        owners={owners}
                        loading={ownersLoading}
                        error={ownersError}
                        selectedOwnerId={selectedOwnerId}
                        onSelect={handleSelectOwner}
                        onRefresh={refreshOwners}
                      />
                  </div>

                  <button
                    onClick={handleConnect}
                    disabled={!selectedOwnerId || ownersLoading}
                    className="w-full py-2.5 rounded-lg bg-primary-500 text-white font-medium text-sm hover:bg-primary-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary-500"
                  >
                    Start Conversation
                  </button>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                  <p className="text-xs text-slate-500 text-center">
                    Your browser will request microphone access.
                  </p>
                </div>
              </>
            )}

            {/* Manual mode */}
            {mode === "manual" && (
              <>
                <div className="px-6 py-6 space-y-4">
                  <div className="text-center py-2">
                    <svg
                      className="w-10 h-10 mx-auto mb-3 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <h3 className="font-semibold text-slate-800 mb-1">Upload Audio File</h3>
                    <p className="text-sm text-slate-500">
                      Send a pre-recorded audio message to the agent.
                      Supports WAV, MP3, OGG, WebM.
                    </p>
                  </div>

                  <button
                    onClick={() => setManualConnected(true)}
                    className="w-full py-2.5 rounded-lg bg-blue-500 text-white font-medium text-sm hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Start Manual Session
                  </button>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                  <p className="text-xs text-slate-500 text-center">
                    Audio is processed through the daemon WebSocket pipeline.
                  </p>
                </div>
              </>
            )}

            {/* PTT mode */}
            {mode === "ptt" && (
              <>
                <div className="px-6 py-6 space-y-4">
                  <div className="text-center py-2">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-purple-100 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-purple-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-slate-800 mb-1">Push to Talk</h3>
                    <p className="text-sm text-slate-500">
                      Hold to record your voice and send it to the agent.
                      Release to stop and process.
                    </p>
                  </div>

                  <button
                    onClick={() => setPttConnected(true)}
                    className="w-full py-2.5 rounded-lg bg-purple-500 text-white font-medium text-sm hover:bg-purple-600 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  >
                    Start PTT Session
                  </button>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                  <p className="text-xs text-slate-500 text-center">
                    Hold the microphone button to record.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Connecting indicator */}
        {status === "connecting" && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-primary-500 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Connecting...
            </h2>
            <p className="text-sm text-slate-500">
              Joining room <span className="font-medium">{roomName}</span>
            </p>
          </div>
        )}

        {/* Connected — LiveKit Room */}
        {status === "connected" && token && (
          <LiveKitRoom
            serverUrl={serverUrl}
            token={token}
            connect={true}
            audio={{
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }}
            video={false}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden h-[600px]"
          >
            <RoomAudioRenderer />
            <StartAudio label="Enable Audio" />
            <ConversationRoom
              participantName={participantName ?? identity ?? "User"}
              onDisconnect={handleDisconnect}
            />
          </LiveKitRoom>
        )}

        {/* Connected — Manual Mode */}
        {manualConnected && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden h-[600px]">
            <ManualMode
              daemonWsUrl={config.daemonWsUrl}
              onDisconnect={() => setManualConnected(false)}
            />
          </div>
        )}

        {/* Connected — Push to Talk */}
        {pttConnected && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden h-[600px]">
            <PushToTalkMode
              daemonWsUrl={config.daemonWsUrl}
              onDisconnect={() => setPttConnected(false)}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function Home() {
  const { config } = useConfig();

  return (
    <>
      <Head>
        <title>{config.appTitle}</title>
        <meta name="description" content="Eidolon Agent Web Client" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <HomeContent />
    </>
  );
}
