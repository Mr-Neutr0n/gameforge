import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    // Mock NextAuth session endpoint to return unauthenticated
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      }),
    );
    await page.goto("/");
  });

  test("page has correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/Game Builder/);
  });

  test("nav shows Game Builder branding and sign-in button", async ({
    page,
  }) => {
    const nav = page.locator("nav");
    await expect(nav.getByText("Game Builder")).toBeVisible();
    await expect(nav.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("hero heading renders 'Describe a game'", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Describe a game/i }),
    ).toBeVisible();
  });

  test("Powered by pill is visible", async ({ page }) => {
    await expect(
      page.getByText("Powered by Gemini + Phaser.js"),
    ).toBeVisible();
  });

  test("Google and GitHub auth buttons are present", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Continue with Google/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Continue with GitHub/i }),
    ).toBeVisible();
  });

  test("4 example game cards render", async ({ page }) => {
    const titles = [
      "Neon Platformer",
      "Space Blaster",
      "Dungeon Crawler",
      "Gem Match",
    ];

    for (const title of titles) {
      await expect(page.getByText(title)).toBeVisible();
    }
  });

  test("footer shows Game Builder branding", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer.getByText("Game Builder")).toBeVisible();
    await expect(footer.getByText("by harikp.com")).toBeVisible();
  });
});
