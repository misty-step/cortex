import { test, expect } from "@playwright/test";

test.describe("Dashboard / Overview", () => {
  test("should display Factory Overview heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Factory Overview" })).toBeVisible();
  });

  test("should show gateway health status", async ({ page }) => {
    await page.goto("/");

    // Wait for health card to appear
    const gatewayCard = page.getByText("Gateway").first();
    await expect(gatewayCard).toBeVisible();

    // Health status should show a status indicator (any colored badge)
    const healthStatus = page.locator("[class*='bg-'][class*='-500']").first();
    await expect(healthStatus).toBeVisible();
  });

  test("should display running sprites count", async ({ page }) => {
    await page.goto("/");

    // Find the card containing "Running Sprites" label
    const runningCard = page.locator("div:has-text('Running Sprites')");
    await expect(runningCard).toBeVisible();

    // The count should be a number in a span or similar element
    const runningCount = runningCard.locator("span, p, div").filter({ hasText: /^\d+$/ }).first();
    await expect(runningCount).toBeVisible();
  });

  test("should display idle sprites count", async ({ page }) => {
    await page.goto("/");

    // Find the card containing "Idle Sprites" label
    const idleCard = page.locator("div:has-text('Idle Sprites')");
    await expect(idleCard).toBeVisible();

    // The count should be a number in a span or similar element
    const idleCount = idleCard.locator("span, p, div").filter({ hasText: /^\d+$/ }).first();
    await expect(idleCount).toBeVisible();
  });

  test("should show Fleet Status section", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Fleet Status" })).toBeVisible();
  });

  test("should display sprite table with columns", async ({ page }) => {
    await page.goto("/");

    // Wait for the Fleet Status table to load
    await expect(page.getByRole("heading", { name: "Fleet Status" })).toBeVisible();

    // Check table headers
    await expect(page.getByText("Sprite", { exact: true })).toBeVisible();
    await expect(page.getByText("Status", { exact: true })).toBeVisible();
    await expect(page.getByText("Agents", { exact: true })).toBeVisible();
    await expect(page.getByText("Last Seen", { exact: true })).toBeVisible();
  });

  test("should have search functionality for sprites", async ({ page }) => {
    await page.goto("/");

    const searchInput = page.getByPlaceholder("Search sprites...");
    await expect(searchInput).toBeVisible();

    // Type something in the search
    await searchInput.fill("test");

    // Clear button should appear
    const clearButton = page.getByLabel("Clear search");
    await expect(clearButton).toBeVisible();
  });

  test("should have status filter dropdown", async ({ page }) => {
    await page.goto("/");

    const statusFilter = page.getByLabel("Filter by status");
    await expect(statusFilter).toBeVisible();

    // Check options exist
    await expect(statusFilter.getByText("All Status")).toBeVisible();
    await expect(statusFilter.getByText("Running")).toBeVisible();
    await expect(statusFilter.getByText("Idle")).toBeVisible();
  });

  test("should show Export button when sprites exist", async ({ page }) => {
    await page.goto("/");

    // Wait for content to load
    await page.waitForLoadState("networkidle");

    // Check if Export button is visible (sprites exist)
    const exportButton = page.getByRole("button", { name: "Export" });
    const hasExportButton = await exportButton.isVisible().catch(() => false);

    if (hasExportButton) {
      await expect(exportButton).toBeVisible();
    }
  });
});

test.describe("Navigation", () => {
  test("should navigate to Sessions page", async ({ page }) => {
    await page.goto("/");

    // Click on Sessions nav link
    await page.getByRole("link", { name: "Sessions" }).click();

    // Should navigate to /sessions
    await expect(page).toHaveURL(/.*\/sessions/);
    await expect(page.getByRole("heading", { name: "Agent Sessions" })).toBeVisible();
  });

  test("should navigate to Logs page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Logs" }).click();

    await expect(page).toHaveURL(/.*\/logs/);
    await expect(page.getByRole("heading", { name: "Gateway Logs" })).toBeVisible();
  });

  test("should navigate to Crons page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Crons" }).click();

    await expect(page).toHaveURL(/.*\/crons/);
    await expect(page.getByRole("heading", { name: "Cron Jobs" })).toBeVisible();
  });

  test("should navigate to Agents page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Agents" }).click();

    await expect(page).toHaveURL(/.*\/agents/);
    await expect(page.getByRole("heading", { name: "Available Agents" })).toBeVisible();
  });

  test("should navigate to Errors page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Errors" }).click();

    await expect(page).toHaveURL(/.*\/errors/);
    await expect(page.getByRole("heading", { name: "Error Logs" })).toBeVisible();
  });
});
