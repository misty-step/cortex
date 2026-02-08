import { describe, it, expect } from "vitest";
import { parseGatewayErrLine } from "../../../src/server/parsers/gateway-err";

describe("parseGatewayErrLine", () => {
  it("returns null for placeholder implementation", () => {
    expect(parseGatewayErrLine("test")).toBeNull();
  });

  // Full parser tests implemented in PR 2
});
