import { test, expect } from "@playwright/test";

test.describe("Dashboard / Overview", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display Factory Overview heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Factory Overview" })).toBeVisible();
  });

  test("should show gateway health status", async ({ page }) => {
    // Wait for health card to appear - look for Gateway text
    await expect(page.getByText("Gateway")).toBeVisible();

    // Verify the page has loaded and contains health-related content
    await expect(page.getByRole("heading", { name: /Health|Status|Gateway/i })).toBeVisible();
  });

  test("should display running sprites count", async ({ page }) => {
    await page.goto("/");

    // Find the card containing "Running Sprites" label
    const runningCard = page.locator("div:has-text('Running Sprites')");
    await expect(runningCard).toBeVisible();

    // The count should be a number - look for text that contains digits within the card
    const runningCount = runningCard.getByText(/^\d+$/);
    await expect(runningCount).toBeVisible();
  });

  test("should display idle sprites count", async ({ page }) => {
    // Find the card containing "Idle Sprites" label
    const idleCard = page.locator("div:has-text('Idle Sprites')");
    await expect(idleCard).toBeVisible();

    // The count should be a number - look for text that contains digits within the card
    const idleCount = idleCard.getByText(/^\d+$/);
    await expect(idleCount).toBeVisible();
  });

  test("should show Fleet Status section", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Fleet Status" })).toBeVisible();
  });

  test("should display sprite table with columns", async ({ page }) => {
    // Wait for the Fleet Status table to load
    await expect(page.getByRole("heading", { name: "Fleet Status" })).toBeVisible();

    // Check table headers
    await expect(page.getByText("Sprite", { exact: true })).toBeVisible();
    await expect(page.getByText("Status", { exact: true })).toBeVisible();
    await expect(page.getByText("Agents", { exact: true })).toBeVisible();
    await expect(page.getByText("Last Seen", { exact: true })).toBeVisible();
  });

  test("should have search functionality for sprites", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search sprites...");
    await expect(searchInput).toBeVisible();

    // Type something in the search
    await searchInput.fill("test");

    // Clear button should appear
    const clearButton = page.getByLabel("Clear search");
    await expect(clearButton).toBeVisible();
  });

  test("should have status filter dropdown", async ({ page }) => {
    const statusFilter = page.getByLabel("Filter by status");
    await expect(statusFilter).toBeVisible();

    // Check options exist
    await expect(statusFilter.getByText("All Status")).toBeVisible();
    await expect(statusFilter.getByText("Running")).toBeVisible();
    await expect(statusFilter.getByText("Idle")).toBeVisible();
  });

  test("should show Export button when sprites exist", async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState("domcontentloaded");

    // Export button should be visible when sprites exist
    await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should navigate to Sessions page", async ({ page }) => {
    // Click on Sessions nav link
    await page.getByRole("link", { name: "Sessions" }).click();

    // Should navigate to /sessions
    await expect(page).toHaveURL(/.*\/sessions/);
    await expect(page.getByRole("heading", { name: "Agent Sessions" })).toBeVisible();
  });

  test("should navigate to Logs page", async ({ page }) => {
    await page.getByRole("link", { name: "Logs" }).click();

    await expect(page).toHaveURL(/.*\/logs/);
    await expect(page.getByRole("heading", { name: "Gateway Logs" })).toBeVisible();
  });

  test("should navigate to Crons page", async ({ page }) => {
    await page.getByRole("link", { name: "Crons" }).click();

    await expect(page).toHaveURL(/.*\/crons/);
    await expect(page.getByRole("heading", { name: "Cron Jobs" })).toBeVisible();
  });

  test("should navigate to Agents page", async ({ page }) => {
    await page.getByRole("link", { name: "Agents" }).click();

    await expect(page).toHaveURL(/.*\/agents/);
    await expect(page.getByRole("heading", { name: "Agent Status" })).toBeVisible();
  });

  test("should navigate to Errors page", async ({ page }) => {
    await page.getByRole("link", { name: "Errors" }).click();

    await expect(page).toHaveURL(/.*\/errors/);
    await expect(page.getByRole("heading", { name: "Recent Errors" })).toBeVisible();
  });
});
