import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCompanionBootstrap } from "@/hooks/useCompanionBootstrap";

const ADMIN = "http://127.0.0.1:9000";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function setSearch(search: string) {
  window.history.replaceState({}, "", search || "/");
}

afterEach(() => {
  vi.restoreAllMocks();
  setSearch("/");
});

describe("useCompanionBootstrap", () => {
  it("uses URL params (mission-control launch) without hitting admin", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setSearch("/?owner_id=benchmark&companion_id=benchmark&device_id=web-benchmark");

    const { result } = renderHook(() => useCompanionBootstrap(ADMIN));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.identity).toEqual({
      ownerId: "benchmark",
      companionId: "benchmark",
      deviceId: "web-benchmark",
      displayName: "benchmark",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves the default owner via GET /api/bootstrap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          owner_id: "benchmark",
          owner_display_name: "Benchmark",
          companion_id: "benchmark",
          companion_display_name: "Benchmark",
          device_id: "web-benchmark",
        }),
      ),
    );

    const { result } = renderHook(() => useCompanionBootstrap(ADMIN));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.identity?.deviceId).toBe("web-benchmark");
    expect(result.current.identity?.displayName).toBe("Benchmark");
  });

  it("drops to ambiguous on 409 and recovers via resolveOwner", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get("owner_id") === "b") {
        return jsonResponse(200, {
          owner_id: "b",
          companion_id: "cb",
          device_id: "web-cb",
        });
      }
      return jsonResponse(409, { detail: "multiple owners (a, b)" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCompanionBootstrap(ADMIN));

    await waitFor(() => expect(result.current.status).toBe("ambiguous"));
    expect(result.current.error).toContain("multiple owners");

    act(() => result.current.resolveOwner("b"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.identity?.deviceId).toBe("web-cb");
  });

  it("surfaces an error on non-ok bootstrap response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(500, { detail: "boom" })),
    );

    const { result } = renderHook(() => useCompanionBootstrap(ADMIN));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toContain("boom");
  });

  it("surfaces an error when the admin fetch rejects (unreachable)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const { result } = renderHook(() => useCompanionBootstrap(ADMIN));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toContain("Failed to fetch");
  });

  it("errors clearly when admin URL is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCompanionBootstrap(""));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toContain("NEXT_PUBLIC_ADMIN_API_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
