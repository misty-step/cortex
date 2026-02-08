import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "**/e2e/**", "**/dist/**"],
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
        "**/*.spec.ts",
        "**/__tests__/**",
        "**/node_modules/**",
        "**/*.config.{ts,js}",
        "**/types.ts",
      ],
      thresholds: {
        // PR 1: Scaffold — no code to cover yet
        // PR 2: Parsers at 95%+, services at 80%+
        // PR 3: Routes at 75%+
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
      clean: true,
      cleanOnRerun: true,
    },
  },
});
