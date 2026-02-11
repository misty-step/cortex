import { describe, it, expect } from "vitest";
import { parseMergeReadyLines } from "@/client/lib/parseMergeReady";

describe("parseMergeReadyLines", () => {
  it("splits into trimmed non-empty lines", () => {
    expect(parseMergeReadyLines("a\nb\n\n c \n")).toEqual(["a", "b", "c"]);
  });

  it("strips common bullet/number prefixes", () => {
    const input = `
repo1#123 Fix thing
- repo2#456 Another
* repo3#789
1. repo4#000
`;

    expect(parseMergeReadyLines(input)).toEqual([
      "repo1#123 Fix thing",
      "repo2#456 Another",
      "repo3#789",
      "repo4#000",
    ]);
  });
});
