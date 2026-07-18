import { useCallback, useMemo } from "react";

export interface AppConfig {
  livekitUrl: string;
  appTitle: string;
  // Admin REST endpoint — the client resolves its owner→master companion→web
  // body here (GET /api/bootstrap) and lists owners for the fallback picker.
  // If unset, the client shows a clear "admin URL not configured" hint rather
  // than a chatty network error.
  adminApiUrl: string;
}

export function useConfig() {
  const config: AppConfig = useMemo(() => ({
    livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "",
    appTitle: process.env.NEXT_PUBLIC_APP_TITLE ?? "Eidolon Agent",
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
