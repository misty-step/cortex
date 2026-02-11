export function parseMergeReadyLines(input: string | null | undefined): string[] {
  if (!input) return [];

  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^([-*]|\u2022)\s+/, "").replace(/^\d+\.\s+/, ""))
    .filter(Boolean);
}
