import { useCallback, useMemo } from "react";

export interface AppConfig {
  livekitUrl: string;
  appTitle: string;
  daemonWsUrl: string;
  // Phase 32.C: admin REST endpoint — client_web lists registered users
  // here for the "select identity" picker. If unset, the picker shows
  // a clear "admin URL not configured" hint rather than the default
  // chatty "could not fetch" network error.
  adminApiUrl: string;
}

export function useConfig() {
  const config: AppConfig = useMemo(() => ({
    livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "",
    appTitle: process.env.NEXT_PUBLIC_APP_TITLE ?? "Eidolon Agent",
    daemonWsUrl: process.env.NEXT_PUBLIC_DAEMON_WS_URL ?? "ws://localhost:8080/ws",
    adminApiUrl: process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "",
  }), []);

  const validate = useCallback((): string | null => {
    if (!config.livekitUrl) {
      return "LiveKit URL is not configured. Set NEXT_PUBLIC_LIVEKIT_URL in your environment.";
    }
    return null;
  }, [config]);

  return { config, validate };
}
