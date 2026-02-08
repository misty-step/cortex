import { describe, it, expect } from "vitest";
import { parseJsonLogLine } from "../../../src/server/parsers/json-log";

describe("parseJsonLogLine", () => {
  it("returns null for placeholder implementation", () => {
    expect(parseJsonLogLine("{}")).toBeNull();
  });

  // Full parser tests implemented in PR 2
});
