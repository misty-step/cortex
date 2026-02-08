import { describe, it, expect } from "vitest";
import { parseGatewayLogLine } from "../../../src/server/parsers/gateway-log";

describe("parseGatewayLogLine", () => {
  it("returns null for placeholder implementation", () => {
    expect(parseGatewayLogLine("test")).toBeNull();
  });

  // Full parser tests implemented in PR 2
});
