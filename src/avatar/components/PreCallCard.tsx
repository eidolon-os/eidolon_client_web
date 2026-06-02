import React from "react";
import { motion } from "framer-motion";
import { UserPicker } from "@/components/UserPicker";
import type { UserRow } from "@/hooks/useUsers";
import styles from "../styles/companion.module.css";

/**
 * Phase 32.C (Companion follow-up): Companion's pre-call card now mirrors
 * the main index page — operators pick a registered admin user_id from
 * a dropdown instead of typing a free-form name. Same UX rationale as
 * index.tsx: hub validates user_id against admin and rejects unknowns
 * with 404, so free input was a footgun.
 *
 * Picker state (users / loading / error / selection) is owned by the
 * parent CompanionScene because (a) the picker is also used in
 * /index, sharing the same useUsers + localStorage logic, and (b) the
 * parent already routes ``session.start(userId)`` to the connection
 * hook. PreCallCard stays presentational.
 */

interface PreCallCardProps {
  appTitle: string;
  users: UserRow[];
  usersLoading: boolean;
  usersError: string | null;
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
  onRefresh: () => void;
  onStart: (userId: string) => void;
  error?: string | null;
}

export function PreCallCard({
  appTitle,
  users,
  usersLoading,
  usersError,
  selectedUserId,
  onSelect,
  onRefresh,
  onStart,
  error,
}: PreCallCardProps) {
  const canStart = Boolean(selectedUserId) && !usersLoading;
  const handleStart = () => {
    if (selectedUserId) onStart(selectedUserId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(420px,86vw)] -translate-x-1/2 -translate-y-1/2"
    >
      <div className={`${styles.glass} rounded-3xl p-8 text-white`}>
        {/* Logo / 头像光圈 */}
        <div className="mb-6 flex justify-center">
          <div className={`${styles.breathing} h-20 w-20 rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-cyan-300 p-[2px]`}>
            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-950">
              <svg className="h-9 w-9 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 14a4 4 0 100-8 4 4 0 000 8z M6 21v-1a6 6 0 0112 0v1" />
              </svg>
            </div>
          </div>
        </div>

        <h1 className="text-center text-2xl font-medium tracking-tight">{appTitle}</h1>
        <p className="mt-2 text-center text-sm text-white/60">
          和你的 AI 伙伴对话，自然、即时、专注于你
        </p>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-7 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-white/50">
              Identity
            </label>
            {/* UserPicker is light-themed by default; wrap in a darker
                container so it reads against the glass background. The
                picker exposes its own inline error / empty / warning
                states — no need to duplicate them here. */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-800">
              <UserPicker
                users={users}
                loading={usersLoading}
                error={usersError}
                selectedUserId={selectedUserId}
                onSelect={onSelect}
                onRefresh={onRefresh}
              />
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 px-4 py-3.5 text-[15px] font-medium text-white shadow-lg shadow-violet-500/30 transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            <span className="relative z-10">Begin Conversation</span>
            <span className="absolute inset-0 -z-0 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-violet-500 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-white/40">
          浏览器会请求麦克风权限
        </p>
      </div>
    </motion.div>
  );
}
