import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for hooks/pure logic. jsdom gives us window/location/fetch shims;
// tests mock ``global.fetch`` so they are hermetic (no live admin needed).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globals: true,
    testTimeout: 10_000,
  },
});
