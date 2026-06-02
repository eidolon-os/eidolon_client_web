import React from "react";
import type { UserRow } from "@/hooks/useUsers";

/**
 * Phase 32.C: "choose identity" dropdown shown before the user connects.
 *
 * UX contract:
 *   - Empty users list → render a hint that points operator at admin
 *     UI's /users page so they can create one. No "create here" button
 *     — keeping creation in admin UI avoids duplicating that 4-layer
 *     CRUD surface and the memory-side worker boot delay handling.
 *   - Errors are shown inline. We don't auto-retry; the parent's
 *     "refresh" button re-triggers ``useUsers.refresh``.
 *   - Selected user is highlighted; warns when ``active_agent_id`` is
 *     null because that means the hub→admin lookup will 409 at connect
 *     time. Better to surface the problem in the picker than at
 *     "Start Conversation" click.
 */

export interface UserPickerProps {
  users: UserRow[];
  loading: boolean;
  error: string | null;
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
  onRefresh: () => void;
}

export const UserPicker: React.FC<UserPickerProps> = ({
  users,
  loading,
  error,
  selectedUserId,
  onSelect,
  onRefresh,
}) => {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
        Loading identities from admin…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
          {error}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs text-primary-600 hover:text-primary-700 underline underline-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
        No users registered in admin yet.{" "}
        <a
          href="http://127.0.0.1:9001/users"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 hover:text-amber-900"
        >
          Create one in admin →
        </a>
        <button
          type="button"
          onClick={onRefresh}
          className="ml-2 text-xs text-amber-700 hover:text-amber-900 underline underline-offset-2"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-300 overflow-hidden bg-white">
        <select
          value={selectedUserId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="" disabled>
            Select identity…
          </option>
          {users.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.display_name} ({u.user_id})
              {!u.health_ok ? " — memory unhealthy" : ""}
              {u.active_agent_id === null ? " — no active agent" : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedUserId && (() => {
        const u = users.find((x) => x.user_id === selectedUserId);
        if (!u) return null;
        if (u.active_agent_id === null) {
          return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {u.display_name} has no active agent yet — open admin and
              set one before connecting, or the agent runtime will reject
              the session.
            </div>
          );
        }
        if (!u.health_ok) {
          return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Memory worker for {u.display_name} is not fully healthy.
              Conversation may start but recall / write may fail.
            </div>
          );
        }
        return (
          <div className="text-xs text-slate-500">
            Tenant: <span className="font-mono">{u.tenant_id}</span> · Active
            agent: <span className="font-mono">{u.active_agent_id}</span>
          </div>
        );
      })()}

      <button
        type="button"
        onClick={onRefresh}
        className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
      >
        Refresh list
      </button>
    </div>
  );
};
