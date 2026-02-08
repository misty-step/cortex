// ─── useExport Hook ─────────────────────────────────────────────────────────
// Export data to file or clipboard
// Implemented in PR 4

export function useExport() {
  function toClipboard(data: unknown): void {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  }

  function toFile(data: unknown, filename: string, format: "json" | "csv" = "json"): void {
    const content =
      format === "json" ? JSON.stringify(data, null, 2) : String(data);
    const blob = new Blob([content], { type: `text/${format}` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { toClipboard, toFile };
}
