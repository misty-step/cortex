import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@shared": resolve(__dirname, "src/shared"),
      "bun:sqlite": resolve(__dirname, "tests/shims/bun-sqlite.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "**/e2e/**", "**/dist/**", "tests/unit/client/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      include: [
        "src/server/parsers/**/*.ts",
        "src/server/services/**/*.ts",
        "src/server/routes/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/__tests__/**",
        "**/node_modules/**",
        "**/*.config.{ts,js}",
        "**/types.ts",
      ],
      thresholds: {
        "src/server/parsers/**": {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
        "src/server/services/**": {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
        "src/server/routes/**": {
          lines: 75,
          functions: 75,
          branches: 75,
          statements: 75,
        },
      },
      clean: true,
      cleanOnRerun: true,
    },
  },
});
