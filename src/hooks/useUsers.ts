import { useCallback, useEffect, useState } from "react";

/**
 * Phase 32.C: list users from admin so the pre-connection UI can show
 * a picker instead of a free-text name field.
 *
 * Why this matters: under Phase 32.A, hub validates ``user_id`` against
 * admin and rejects unknown ones with 404. If the operator types a
 * random name, they get a confusing "user not found" error at connect
 * time. Showing a dropdown of admin-registered users removes that
 * footgun entirely — pick or create.
 *
 * The hook is intentionally minimal:
 *   - One GET on mount.
 *   - Reload via the returned ``refresh()`` for the "I just created a
 *     user in admin, show it in the dropdown now" case.
 *   - No optimistic / cached state. Admin's user list is tiny (dev
 *     stack: 1-3 users), so we just refetch.
 *
 * Errors are surfaced as a string in ``error`` rather than thrown — the
 * picker UI treats "admin unreachable" and "no users yet" as distinct
 * states for the operator.
 */

export interface UserRow {
  user_id: string;
  display_name: string;
  tenant_id: string;
  /** From admin's UserView.active_agent_id — null means "no agent
   * configured yet", picker can warn the operator before connecting. */
  active_agent_id: string | null;
  /** Indicates the memory worker reachability — used by the picker to
   * grey-out unhealthy users. */
  health_ok: boolean;
}

interface UseUsersState {
  loading: boolean;
  users: UserRow[];
  error: string | null;
}

/**
 * Admin's GET /api/users response shape — narrow projection. See
 * eidolon_admin_server/app/registry/schemas/user.py for the full shape.
 */
interface AdminUserView {
  spec: {
    user_id: string;
    tenant_id: string;
    display_name: string;
  };
  health: {
    worker_running: boolean;
    mcp_reachable: boolean;
    palace_initialized: boolean;
  };
  active_agent_id: string | null;
}

interface AdminUsersResponse {
  users: AdminUserView[];
  memory_available: boolean;
}

export function useUsers(adminApiUrl: string) {
  const [state, setState] = useState<UseUsersState>({
    loading: false,
    users: [],
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!adminApiUrl) {
      setState({
        loading: false,
        users: [],
        error:
          "Admin API URL is not configured. Set NEXT_PUBLIC_ADMIN_API_URL " +
          "(usually http://127.0.0.1:9000) in .env.local.",
      });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`${adminApiUrl}/api/users`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        // 503 = registry not initialized (admin started without NATS).
        // We pass the message through verbatim — operator runs the
        // stack via run_all.sh, the message will say "registry routes
        // will return 503 until NATS recovers".
        const body = await res.text();
        throw new Error(`admin /api/users → ${res.status}: ${body}`);
      }
      const data: AdminUsersResponse = await res.json();
      const rows: UserRow[] = data.users.map((u) => ({
        user_id: u.spec.user_id,
        display_name: u.spec.display_name || u.spec.user_id,
        tenant_id: u.spec.tenant_id,
        active_agent_id: u.active_agent_id,
        // We treat "all three health flags true" as healthy. Less than
        // that is greyed in the picker — the chat would technically
        // start but memory writes would fail.
        health_ok:
          u.health.worker_running &&
          u.health.mcp_reachable &&
          u.health.palace_initialized,
      }));
      setState({ loading: false, users: rows, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load users";
      setState({ loading: false, users: [], error: message });
    }
  }, [adminApiUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
