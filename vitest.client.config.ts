import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Vitest configuration for client-side tests (React components, hooks)
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/client/**/*.test.ts", "tests/unit/client/**/*.test.tsx"],
    setupFiles: ["tests/setup/client.ts"],
    coverage: {
      enabled: false, // Coverage is handled by main vitest.config.ts
    },
  },
});
