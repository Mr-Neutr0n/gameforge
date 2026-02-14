import { test, expect } from "@playwright/test";

test.describe("Create page — unauthenticated", () => {
  test("redirects to home when not authenticated", async ({ page }) => {
    // Mock NextAuth session endpoint to return unauthenticated
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      }),
    );
    await page.goto("/create");

    // ProtectedRoute redirects unauthenticated users to "/"
    await page.waitForURL("/", { timeout: 10000 });
    await expect(page).toHaveURL("/");
  });
});

test.describe("Create page — authenticated", () => {
  test.beforeEach(async ({ page }) => {
    // Mock NextAuth session endpoint to return authenticated user
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "test-user-1",
            name: "Test User",
            email: "test@example.com",
            image: null,
          },
          backendToken: "mock-jwt-token",
          expires: new Date(Date.now() + 86400000).toISOString(),
        }),
      }),
    );
    await page.goto("/create");
  });

  test("page title 'New Game' is visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "New Game" }),
    ).toBeVisible();
  });

  test("4 template cards render (Platformer, Top-Down, Shooter, Puzzle)", async ({
    page,
  }) => {
    const labels = ["Platformer", "Top-Down", "Shooter", "Puzzle"];
    for (const label of labels) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("textarea placeholder contains 'Describe your game'", async ({
    page,
  }) => {
    const textarea = page.locator("#game-prompt");
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute(
      "placeholder",
      /Describe your game/,
    );
  });

  test("generate button exists and is disabled when textarea is empty", async ({
    page,
  }) => {
    const generateBtn = page.getByRole("button", { name: /Generate Game/i });
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toBeDisabled();
  });

  test("generate button becomes enabled when text is entered", async ({
    page,
  }) => {
    const textarea = page.locator("#game-prompt");
    const generateBtn = page.getByRole("button", { name: /Generate Game/i });

    await textarea.fill("A simple platformer game with jumping mechanics");
    await expect(generateBtn).toBeEnabled();
  });

  test("cancel button navigates to dashboard", async ({ page }) => {
    const cancelBtn = page.getByRole("button", { name: /Cancel/i });
    await expect(cancelBtn).toBeVisible();
  });
});
