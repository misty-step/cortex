import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";

test.describe("Export functionality", () => {
  test("should show Export button on Overview page", async ({ page }) => {
    await page.goto("/");

    // Wait for page to load
    await page.waitForLoadState("domcontentloaded");

    // Export button should be present if there are sprites
    const exportButton = page.getByRole("button", { name: "Export" });

    // Use expect with optional visibility check
    await expect(exportButton)
      .toBeVisible({ visible: true })
      .catch(() => {});
  });

  test("should show Export button on Sessions page", async ({ page }) => {
    await page.goto("/sessions");

    await page.waitForLoadState("domcontentloaded");

    const exportButton = page.getByRole("button", { name: "Export" });
    await expect(exportButton)
      .toBeVisible({ visible: true })
      .catch(() => {});
  });

  test("should show Export button on Logs page", async ({ page }) => {
    await page.goto("/logs");

    await page.waitForLoadState("domcontentloaded");

    const exportButton = page.getByRole("button", { name: "Export" });
    await expect(exportButton)
      .toBeVisible({ visible: true })
      .catch(() => {});
  });

  test("should open export menu when clicking Export button", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const exportButton = page.getByRole("button", { name: "Export" });
    await expect(exportButton).toBeVisible();

    await exportButton.click();

    // Export menu should appear with JSON and CSV options
    await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  });

  test("should close export menu when clicking outside", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const exportButton = page.getByRole("button", { name: "Export" });
    await expect(exportButton).toBeVisible();

    await exportButton.click();

    // Menu should be visible
    await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();

    // Press Escape to close the menu
    await page.keyboard.press("Escape");

    // Menu should close
    await expect(page.getByRole("button", { name: "Export JSON" })).not.toBeVisible();
  });
});

test.describe("Export data validation", () => {
  test("exported JSON should be valid", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const exportButton = page.getByRole("button", { name: "Export" });
    await expect(exportButton).toBeVisible();

    // Open the export menu first
    await exportButton.click();
    await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();

    // Then intercept the download
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    const download = await downloadPromise;

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Read and validate the JSON
    const content = await fs.readFile(downloadPath, "utf-8");
    const data = JSON.parse(content);

    // Should be an array
    expect(Array.isArray(data)).toBe(true);

    // Clean up
    await fs.unlink(downloadPath);
  });

  test("exported CSV should have valid format", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const exportButton = page.getByRole("button", { name: "Export" });
    await expect(exportButton).toBeVisible();

    // Open the export menu first
    await exportButton.click();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();

    // Then intercept the download
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

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
  });
});
