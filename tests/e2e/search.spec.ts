import { test, expect } from "@playwright/test";

test.describe("Search functionality", () => {
  test("should filter logs by search query", async ({ page }) => {
    await page.goto("/logs");

    // Wait for the page to load
    await expect(page.getByText("Gateway Logs")).toBeVisible();

    // Find and use the search input
    const searchInput = page.getByLabel("Search");
    await expect(searchInput).toBeVisible();

    // Type a search query
    await searchInput.fill("test query");

    // Clear button should appear after debounce
    const clearButton = page.getByLabel("Clear search");
    await expect(clearButton).toBeVisible();

    // Clear the search
    await clearButton.click();
    await expect(searchInput).toHaveValue("");
  });

  test("should filter sessions by search query", async ({ page }) => {
    await page.goto("/sessions");

    await expect(page.getByText("Agent Sessions")).toBeVisible();

    const searchInput = page.getByLabel("Search");
    await expect(searchInput).toBeVisible();

    await searchInput.fill("agent-1");

    // Should show clear button after debounce
    await expect(page.getByLabel("Clear search")).toBeVisible();
  });

  test("should filter crons by search and status", async ({ page }) => {
    await page.goto("/crons");

    await expect(page.getByText("Cron Jobs")).toBeVisible();

    // Test search
    const searchInput = page.getByLabel("Search");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("backup");

    // Wait for clear button to confirm debounce completed
    await expect(page.getByLabel("Clear search")).toBeVisible();

    // Test status filter
    const statusFilter = page.getByLabel("Filter by status");
    await expect(statusFilter).toBeVisible();
    await statusFilter.selectOption("enabled");
  });

  test("should filter models by provider", async ({ page }) => {
    await page.goto("/models");

    await expect(page.getByText("Available Models")).toBeVisible();

    const searchInput = page.getByLabel("Search");
    await expect(searchInput).toBeVisible();

    const providerFilter = page.getByLabel("Filter by provider");
    await expect(providerFilter).toBeVisible();
  });

  test("should filter sprites in overview", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Factory Overview")).toBeVisible();
    await expect(page.getByText("Fleet Status")).toBeVisible();

    const searchInput = page.getByLabel("Search");
    await expect(searchInput).toBeVisible();

    const statusFilter = page.getByLabel("Filter by status");
    await expect(statusFilter).toBeVisible();
    await statusFilter.selectOption("running");
  });
});

test.describe("DataTable sorting", () => {
  test("should sort columns when clicking headers", async ({ page }) => {
    await page.goto("/logs");

    await expect(page.getByText("Gateway Logs")).toBeVisible();

    // Click on Time header to sort
    const timeHeader = page.getByText("Time", { exact: true });
    await expect(timeHeader).toBeVisible();
    await timeHeader.click();

    // Should show sort indicator
    await expect(page.getByText("↑")).toBeVisible();

    // Click again to reverse sort
    await timeHeader.click();
    await expect(page.getByText("↓")).toBeVisible();
  });
});
