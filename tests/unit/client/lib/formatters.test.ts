import { describe, it, expect } from "vitest";
import {
  relativeTime,
  formatTime,
  formatTokens,
  formatBytes,
  formatDuration,
  usageColor,
  filterByText,
} from "@/client/lib/formatters";

describe("formatters", () => {
  describe("relativeTime", () => {
    it("returns 'never' for falsy values", () => {
      expect(relativeTime(0)).toBe("never");
      expect(relativeTime(null as unknown as number)).toBe("never");
      expect(relativeTime(undefined as unknown as number)).toBe("never");
    });

    it("returns 'just now' for future timestamps", () => {
      const future = Date.now() + 1000;
      expect(relativeTime(future)).toBe("just now");
    });

    it("formats seconds correctly", () => {
      const secondsAgo = Date.now() - 30_000;
      expect(relativeTime(secondsAgo)).toBe("30s ago");
    });

    it("formats minutes correctly", () => {
      const minutesAgo = Date.now() - 5 * 60_000;
      expect(relativeTime(minutesAgo)).toBe("5m ago");
    });

    it("formats hours correctly", () => {
      const hoursAgo = Date.now() - 3 * 3_600_000;
      expect(relativeTime(hoursAgo)).toBe("3h ago");
    });

    it("formats days correctly", () => {
      const daysAgo = Date.now() - 2 * 86_400_000;
      expect(relativeTime(daysAgo)).toBe("2d ago");
    });
  });

  describe("formatTime", () => {
    it("returns empty string for falsy input", () => {
      expect(formatTime("")).toBe("");
      expect(formatTime(null as unknown as string)).toBe("");
    });

    it("formats ISO timestamp to time string", () => {
      const iso = "2024-01-15T14:30:45.123Z";
      const result = formatTime(iso);
      // Result depends on local timezone, but should contain time components
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("formatTokens", () => {
    it("formats numbers less than 1000 as-is", () => {
      expect(formatTokens(0)).toBe("0");
      expect(formatTokens(500)).toBe("500");
      expect(formatTokens(999)).toBe("999");
    });

    it("formats thousands with k suffix", () => {
      expect(formatTokens(1000)).toBe("1.0k");
      expect(formatTokens(1500)).toBe("1.5k");
      expect(formatTokens(999_999)).toBe("1000.0k");
    });

    it("formats millions with M suffix", () => {
      expect(formatTokens(1_000_000)).toBe("1.0M");
      expect(formatTokens(2_500_000)).toBe("2.5M");
      expect(formatTokens(1_000_000_000)).toBe("1000.0M");
    });
  });

  describe("formatBytes", () => {
    it("formats bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(500)).toBe("500 B");
      expect(formatBytes(1023)).toBe("1023 B");
    });

    it("formats kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
      expect(formatBytes(1_048_575)).toBe("1024.0 KB");
    });

    it("formats megabytes", () => {
      expect(formatBytes(1_048_576)).toBe("1.0 MB");
      expect(formatBytes(5_242_880)).toBe("5.0 MB");
    });

    it("formats gigabytes", () => {
      expect(formatBytes(1_073_741_824)).toBe("1.0 GB");
      expect(formatBytes(2_147_483_648)).toBe("2.0 GB");
    });
  });

  describe("formatDuration", () => {
    it("formats milliseconds", () => {
      expect(formatDuration(0)).toBe("0ms");
      expect(formatDuration(500)).toBe("500ms");
      expect(formatDuration(999)).toBe("999ms");
    });

    it("formats seconds", () => {
      expect(formatDuration(1000)).toBe("1.0s");
      expect(formatDuration(1500)).toBe("1.5s");
      expect(formatDuration(59_999)).toBe("60.0s");
    });

    it("formats minutes and seconds", () => {
      expect(formatDuration(60_000)).toBe("1m 0s");
      expect(formatDuration(90_000)).toBe("1m 30s");
      expect(formatDuration(125_000)).toBe("2m 5s");
    });

    it("formats hours and minutes", () => {
      expect(formatDuration(3_600_000)).toBe("1h 0m");
      expect(formatDuration(3_900_000)).toBe("1h 5m");
      expect(formatDuration(7_200_000)).toBe("2h 0m");
    });
  });

  describe("usageColor", () => {
    it("returns green for usage below 50%", () => {
      expect(usageColor(0)).toBe("green");
      expect(usageColor(25)).toBe("green");
      expect(usageColor(49)).toBe("green");
      expect(usageColor(50)).toBe("yellow");
    });

    it("returns yellow for usage between 50% and 80%", () => {
      expect(usageColor(50)).toBe("yellow");
      expect(usageColor(65)).toBe("yellow");
      expect(usageColor(79)).toBe("yellow");
      expect(usageColor(80)).toBe("red");
    });

    it("returns red for usage at or above 80%", () => {
      expect(usageColor(80)).toBe("red");
      expect(usageColor(90)).toBe("red");
      expect(usageColor(100)).toBe("red");
    });
  });

  describe("filterByText", () => {
    const data = [
      { id: 1, name: "Alice", role: "admin" },
      { id: 2, name: "Bob", role: "user" },
      { id: 3, name: "Charlie", role: "admin" },
    ];

    it("returns all data for empty query", () => {
      expect(filterByText(data, "", ["name"])).toEqual(data);
      expect(filterByText(data, "   ", ["name"])).toEqual(data);
    });

    it("filters by single key", () => {
      const result = filterByText(data, "ali", ["name"]);
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Alice");
    });

    it("filters by multiple keys", () => {
      const result = filterByText(data, "admin", ["name", "role"]);
      expect(result).toHaveLength(2);
      expect(result.map((d) => d.name)).toContain("Alice");
      expect(result.map((d) => d.name)).toContain("Charlie");
    });

    it("is case insensitive", () => {
      const result = filterByText(data, "ALICE", ["name"]);
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Alice");
    });

    it("handles null/undefined values gracefully", () => {
      const dataWithNull = [
        { id: 1, name: "Alice", optional: null },
        { id: 2, name: "Bob", optional: "value" },
      ];
      const result = filterByText(dataWithNull, "value", ["optional"]);
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Bob");
    });

    it("returns empty array when no matches", () => {
      const result = filterByText(data, "xyz", ["name"]);
      expect(result).toHaveLength(0);
    });

    it("converts non-string values to strings for comparison", () => {
      const numericData = [{ id: 123, name: "Test" }];
      const result = filterByText(numericData, "123", ["id"]);
      expect(result).toHaveLength(1);
    });
  });
});
