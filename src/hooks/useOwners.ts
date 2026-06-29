import { useCallback, useEffect, useState } from "react";

export interface OwnerRow {
  owner_id: string;
  display_name: string;
  kind: string;
  status: string;
}

interface UseOwnersState {
  loading: boolean;
  owners: OwnerRow[];
  error: string | null;
}

interface AdminOwnerView {
  owner_id: string;
  display_name: string;
  kind: string;
  status: string;
}

interface AdminOwnersResponse {
  owners: AdminOwnerView[];
}

export function useOwners(adminApiUrl: string) {
  const [state, setState] = useState<UseOwnersState>({
    loading: false,
    owners: [],
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!adminApiUrl) {
      setState({
        loading: false,
        owners: [],
        error:
          "Admin API URL is not configured. Set NEXT_PUBLIC_ADMIN_API_URL " +
          "(usually http://127.0.0.1:9000) in .env.local.",
      });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`${adminApiUrl}/api/owners`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`admin /api/owners -> ${res.status}: ${body}`);
      }
      const data: AdminOwnersResponse = await res.json();
      setState({
        loading: false,
        owners: data.owners.map((owner) => ({
          owner_id: owner.owner_id,
          display_name: owner.display_name || owner.owner_id,
          kind: owner.kind,
          status: owner.status,
        })),
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load owners";
      setState({ loading: false, owners: [], error: message });
    }
  }, [adminApiUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
