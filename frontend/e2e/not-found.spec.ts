import { test, expect } from "@playwright/test";

test.describe("404 Not Found page", () => {
  test.beforeEach(async ({ page }) => {
    // Mock NextAuth session endpoint to return unauthenticated
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      }),
    );
    await page.goto("/this-page-does-not-exist");
  });

  test("404 digits and controller icon are visible", async ({ page }) => {
    // Two "4" digits flanking the controller icon
    const fours = page.locator("span", { hasText: "4" });
    await expect(fours).toHaveCount(2);

    // Controller icon (SVG inside the icon box between the two 4s)
    const iconBox = page.locator("div.rounded-xl svg");
    await expect(iconBox).toBeVisible();
  });

  test("'Page not found' heading is visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Page not found/i }),
    ).toBeVisible();
  });

  test("description text is visible", async ({ page }) => {
    await expect(
      page.getByText(/doesn't exist or has been moved/i),
    ).toBeVisible();
  });

  test("'Go Home' link has href='/'", async ({ page }) => {
    const goHome = page.getByRole("link", { name: /Go Home/i });
    await expect(goHome).toBeVisible();
    await expect(goHome).toHaveAttribute("href", "/");
  });

  test("'Dashboard' link has href='/dashboard'", async ({ page }) => {
    const dashboard = page.getByRole("link", { name: /Dashboard/i });
    await expect(dashboard).toBeVisible();
    await expect(dashboard).toHaveAttribute("href", "/dashboard");
  });

  test("footer shows 'Game Builder' text", async ({ page }) => {
    await expect(
      page.getByText("Game Builder", { exact: true }),
    ).toBeVisible();
  });
});
