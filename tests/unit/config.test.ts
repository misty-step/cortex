import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { validatePort, validatePath } from "../../src/server/config.js";

describe("validatePort", () => {
  it("should throw error for non-numeric value", () => {
    expect(() => validatePort("CORTEX_PORT", "not-a-number", 18790)).toThrow(
      /Invalid CORTEX_PORT/i,
    );
  });

  it("should throw error for out-of-range port (too high)", () => {
    expect(() => validatePort("CORTEX_PORT", "99999", 18790)).toThrow(/Invalid CORTEX_PORT/i);
  });

  it("should throw error for out-of-range port (zero)", () => {
    expect(() => validatePort("GATEWAY_PORT", "0", 18789)).toThrow(/Invalid GATEWAY_PORT/i);
  });

  it("should throw error for negative port", () => {
    expect(() => validatePort("PORT", "-1", 8080)).toThrow(/Invalid PORT/i);
  });

  it("should accept valid port numbers", () => {
    expect(validatePort("PORT", "8080", 18790)).toBe(8080);
    expect(validatePort("PORT", "1", 18790)).toBe(1);
    expect(validatePort("PORT", "65535", 18790)).toBe(65535);
  });

  it("should use default value when env var is undefined", () => {
    expect(validatePort("PORT", undefined, 18790)).toBe(18790);
  });

  it("should use provided value over default", () => {
    expect(validatePort("PORT", "3000", 18790)).toBe(3000);
  });
});

describe("validatePath", () => {
  let tmpDir: string;
  const originalWarn = console.warn;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-path-test-"));
  });

  afterEach(() => {
    console.warn = originalWarn;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return the path unchanged", () => {
    const testPath = path.join(tmpDir, "test");
    fs.mkdirSync(testPath);

    expect(validatePath("TEST_PATH", testPath)).toBe(testPath);
  });

  it("should warn if parent directory does not exist", () => {
    const nonExistentPath = path.join(tmpDir, "nonexistent", "test");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    validatePath("TEST_PATH", nonExistentPath);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("TEST_PATH"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("does not exist"));

    warnSpy.mockRestore();
  });

  it("should not warn for existing paths", () => {
    const existingPath = path.join(tmpDir, "exists");
    fs.mkdirSync(existingPath);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    validatePath("TEST_PATH", existingPath);

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("should include path name in warning message", () => {
    const nonExistentPath = path.join(tmpDir, "nonexistent", "test.db");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    validatePath("CORTEX_DB_PATH", nonExistentPath);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("CORTEX_DB_PATH"));

    warnSpy.mockRestore();
  });
});

describe("config integration", () => {
  it("should export config object with expected properties", async () => {
    const { config } = await import("../../src/server/config.js");

    expect(config).toHaveProperty("port");
    expect(config).toHaveProperty("gatewayPort");
    expect(config).toHaveProperty("openclawHome");
    expect(config).toHaveProperty("logDir");
    expect(config).toHaveProperty("dbPath");
    expect(config).toHaveProperty("pollIntervalFast");
    expect(config).toHaveProperty("pollIntervalSlow");
    expect(config).toHaveProperty("maxLogEntries");
    expect(config).toHaveProperty("maxErrors");
  });

  it("should have correct default values", async () => {
    // Re-import to get fresh config with current env
    const { config } = await import("../../src/server/config.js");

    expect(typeof config.port).toBe("number");
    expect(typeof config.gatewayPort).toBe("number");
    expect(typeof config.pollIntervalFast).toBe("number");
    expect(typeof config.pollIntervalSlow).toBe("number");
    expect(typeof config.maxLogEntries).toBe("number");
    expect(typeof config.maxErrors).toBe("number");
  });
});
