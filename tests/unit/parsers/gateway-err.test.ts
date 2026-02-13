import { describe, it, expect } from "vitest";
import { parseGatewayErrLine } from "../../../src/server/parsers/gateway-err";

describe("parseGatewayErrLine", () => {
  it("should parse a standard error log line", () => {
    const line = "2026-02-08T14:29:47.758Z ENOENT: no such file or directory";
    const result = parseGatewayErrLine(line);

    expect(result).toEqual({
      time: "2026-02-08T14:29:47.758Z",
      level: "error",
      subsystem: "gateway",
      message: "ENOENT: no such file or directory",
      ts: new Date("2026-02-08T14:29:47.758Z").getTime(),
    });
  });

  it("should return null for empty string", () => {
    expect(parseGatewayErrLine("")).toBeNull();
  });

  it("should return null for whitespace-only string", () => {
    expect(parseGatewayErrLine("   ")).toBeNull();
  });

  it("should return null for lines without timestamp prefix", () => {
    expect(parseGatewayErrLine("just an error message")).toBeNull();
  });

  it("should always set level to error", () => {
    const line = "2026-02-08T14:29:47.758Z some informational looking message";
    const result = parseGatewayErrLine(line);

    expect(result).not.toBeNull();
    expect(result!.level).toBe("error");
  });

  it("should always set subsystem to gateway", () => {
    const line = "2026-02-08T14:29:47.758Z error from somewhere";
    const result = parseGatewayErrLine(line);

    expect(result).not.toBeNull();
    expect(result!.subsystem).toBe("gateway");
  });

  it("should trim whitespace from line before parsing", () => {
    const line = "  2026-02-08T14:29:47.758Z   trimmed error   ";
    const result = parseGatewayErrLine(line);

    expect(result).not.toBeNull();
    expect(result!.message).toBe("trimmed error");
  });

  it("should produce a valid numeric timestamp in ts field", () => {
    const line = "2026-02-08T14:29:47.758Z test error";
    const result = parseGatewayErrLine(line);

    expect(result).not.toBeNull();
    expect(typeof result!.ts).toBe("number");
    expect(result!.ts).toBe(Date.parse("2026-02-08T14:29:47.758Z"));
  });

  it("should parse timestamps without fractional seconds", () => {
    const line = "2026-02-08T14:29:47Z no millis error";
    const result = parseGatewayErrLine(line);

    expect(result).not.toBeNull();
    expect(result!.time).toBe("2026-02-08T14:29:47Z");
  });

  it("should handle multiline stack trace first line", () => {
    const line = "2026-02-08T14:29:47.758Z Error: Cannot find module 'foo'";
    const result = parseGatewayErrLine(line);

    expect(result).not.toBeNull();
    expect(result!.message).toBe("Error: Cannot find module 'foo'");
  });

  it("should handle messages with colons and special characters", () => {
    const line =
      '2026-02-08T14:29:47.758Z TypeError: Cannot read properties of undefined (reading "id")';
    const result = parseGatewayErrLine(line);

    expect(result).not.toBeNull();
    expect(result!.message).toBe('TypeError: Cannot read properties of undefined (reading "id")');
  });
});
