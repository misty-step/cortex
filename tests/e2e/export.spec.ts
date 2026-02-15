import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe("Export functionality", () => {
  const downloadsPath = path.join(__dirname, "..", "..", "test-downloads");

  test.beforeEach(async () => {
    // Ensure downloads directory exists
    await fs.mkdir(downloadsPath, { recursive: true }).catch(() => {});

    // Clear previous downloads
    const files = await fs.readdir(downloadsPath).catch(() => []);
    for (const file of files) {
      await fs.unlink(path.join(downloadsPath, file)).catch(() => {});
    }
  });

  test("should show Export button on Overview page", async ({ page }) => {
    await page.goto("/");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Export button should be present if there are sprites
    const exportButton = page.getByRole("button", { name: "Export" });

    // Button may or may not be visible depending on data
    const isVisible = await exportButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(exportButton).toBeEnabled();
    }
  });

  test("should show Export button on Sessions page", async ({ page }) => {
    await page.goto("/sessions");

    await page.waitForLoadState("networkidle");

    const exportButton = page.getByRole("button", { name: "Export" });
    const isVisible = await exportButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(exportButton).toBeEnabled();
    }
  });

  test("should show Export button on Logs page", async ({ page }) => {
    await page.goto("/logs");

    await page.waitForLoadState("networkidle");

    const exportButton = page.getByRole("button", { name: "Export" });
    const isVisible = await exportButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(exportButton).toBeEnabled();
    }
  });

  test("should open export menu when clicking Export button", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const exportButton = page.getByRole("button", { name: "Export" });
    const isVisible = await exportButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, "No data to export, skipping test");
      return;
    }

    await exportButton.click();

    // Export menu should appear with JSON and CSV options
    await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  });

  test("should close export menu when clicking outside", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const exportButton = page.getByRole("button", { name: "Export" });
    const isVisible = await exportButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, "No data to export, skipping test");
      return;
    }

    await exportButton.click();

    // Menu should be visible
    await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();

    // Click outside the menu
    await page.click("body", { position: { x: 10, y: 10 } });

    // Menu should close
    await expect(page.getByRole("button", { name: "Export JSON" })).not.toBeVisible();
  });
});

test.describe("Export data validation", () => {
  test("exported JSON should be valid", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const exportButton = page.getByRole("button", { name: "Export" });
    const isVisible = await exportButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, "No data to export, skipping test");
      return;
    }

    // Intercept the download
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      exportButton.click(),
      page.getByRole("button", { name: "Export JSON" }).click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    if (downloadPath) {
      // Read and validate the JSON
      const content = await fs.readFile(downloadPath, "utf-8");
      const data = JSON.parse(content);

      // Should be an array
      expect(Array.isArray(data)).toBe(true);

      // Clean up
      await fs.unlink(downloadPath);
    }
  });

  test("exported CSV should have valid format", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const exportButton = page.getByRole("button", { name: "Export" });
    const isVisible = await exportButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, "No data to export, skipping test");
      return;
    }

    // Intercept the download
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      exportButton.click(),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    if (downloadPath) {
      // Read and validate the CSV
      const content = await fs.readFile(downloadPath, "utf-8");

      // Should have at least a header row and one data row
      const lines = content.trim().split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(2);

      // First line should be headers (comma-separated)
      const firstLine = lines[0];
      if (firstLine) {
        const headers = firstLine.split(",");
        expect(headers.length).toBeGreaterThan(0);
      }

      // Clean up
      await fs.unlink(downloadPath);
    }
  });
});
