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
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      include: [
        "src/client/lib/**/*.ts",
        "src/client/hooks/**/*.ts",
        "src/client/components/**/*.tsx",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/__tests__/**",
        "**/node_modules/**",
        "**/*.config.{ts,js}",
      ],
      thresholds: {
        "src/client/lib/**": {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        "src/client/hooks/**": {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
        "src/client/components/**": {
          lines: 70,
          functions: 70,
          branches: 65,
          statements: 70,
        },
      },
    },
  },
});
