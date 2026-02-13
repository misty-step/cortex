import { describe, it, expect } from "vitest";
import { parseGatewayLogLine } from "../../../src/server/parsers/gateway-log";

describe("parseGatewayLogLine", () => {
  it("should parse a standard log line with timestamp, subsystem, and message", () => {
    const line = "2026-02-08T14:29:47.758Z [router] Request received for /api/health";
    const result = parseGatewayLogLine(line);

    expect(result).toEqual({
      time: "2026-02-08T14:29:47.758Z",
      level: "info",
      subsystem: "router",
      message: "Request received for /api/health",
      ts: new Date("2026-02-08T14:29:47.758Z").getTime(),
    });
  });

  it("should return null for empty string", () => {
    expect(parseGatewayLogLine("")).toBeNull();
  });

  it("should return null for whitespace-only string", () => {
    expect(parseGatewayLogLine("   \n\t  ")).toBeNull();
  });

  it("should return null for lines without timestamp prefix", () => {
    expect(parseGatewayLogLine("[router] some message")).toBeNull();
  });

  it("should return null for lines without subsystem brackets", () => {
    expect(
      parseGatewayLogLine("2026-02-08T14:29:47.758Z some message without brackets"),
    ).toBeNull();
  });

  it("should infer error level when message contains 'error'", () => {
    const line = "2026-02-08T14:29:47.758Z [gateway] Connection error on port 8080";
    const result = parseGatewayLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.level).toBe("error");
  });

  it("should infer error level when message contains 'fail'", () => {
    const line = "2026-02-08T14:29:47.758Z [auth] Authentication failed for user X";
    const result = parseGatewayLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.level).toBe("error");
  });

  it("should infer warn level when message contains 'warn'", () => {
    const line = "2026-02-08T14:29:47.758Z [pool] Connection pool warning: high usage";
    const result = parseGatewayLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.level).toBe("warn");
  });

  it("should default to info level for neutral messages", () => {
    const line = "2026-02-08T14:29:47.758Z [gateway] Server started on port 18789";
    const result = parseGatewayLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.level).toBe("info");
  });

  it("should trim whitespace from the line before parsing", () => {
    const line = "  2026-02-08T14:29:47.758Z [gateway] trimmed  ";
    const result = parseGatewayLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.message).toBe("trimmed");
  });

  it("should trim subsystem name", () => {
    const line = "2026-02-08T14:29:47.758Z [ gateway ] started";
    const result = parseGatewayLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.subsystem).toBe("gateway");
  });

  it("should parse timestamps without fractional seconds", () => {
    const line = "2026-02-08T14:29:47Z [gateway] no millis";
    const result = parseGatewayLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.time).toBe("2026-02-08T14:29:47Z");
  });

  it("should produce a valid numeric timestamp in ts field", () => {
    const line = "2026-02-08T14:29:47.758Z [gateway] test";
    const result = parseGatewayLogLine(line);

    expect(result).not.toBeNull();
    expect(typeof result!.ts).toBe("number");
    expect(result!.ts).toBeGreaterThan(0);
    expect(result!.ts).toBe(Date.parse("2026-02-08T14:29:47.758Z"));
  });

  it("should handle messages with special characters", () => {
    const line = '2026-02-08T14:29:47.758Z [parser] Parsed: {"key": "value"} [done]';
    const result = parseGatewayLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.message).toBe('Parsed: {"key": "value"} [done]');
  });

  it("should prefer error over warn when message contains both", () => {
    const line = "2026-02-08T14:29:47.758Z [gateway] warning: error occurred";
    const result = parseGatewayLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.level).toBe("error");
  });

  it("should return null for a plain text line", () => {
    expect(parseGatewayLogLine("just some random text")).toBeNull();
  });
});
