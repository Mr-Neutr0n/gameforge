import { test, expect } from "@playwright/test";

const MOCK_SESSION = {
  user: {
    id: "test-user-1",
    name: "Test User",
    email: "test@example.com",
    image: null,
  },
  backendToken: "mock-jwt-token",
  expires: new Date(Date.now() + 86400000).toISOString(),
};

const MOCK_GAMES = [
  {
    id: "game-1",
    user_id: "test-user-1",
    title: "Neon Platformer",
    description: "A retro neon-themed platformer",
    prompt: "Make a neon platformer",
    game_code: "const config = { type: Phaser.AUTO };",
    thumbnail_url: null,
    is_public: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "game-2",
    user_id: "test-user-1",
    title: "Space Blaster",
    description: null,
    prompt: "Make a space shooter",
    game_code: null,
    thumbnail_url: null,
    is_public: false,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

function mockAuth(page: import("@playwright/test").Page) {
  return page.route("**/api/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SESSION),
    }),
  );
}

function mockGames(page: import("@playwright/test").Page, games: typeof MOCK_GAMES) {
  return page.route("**/api/games", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(games),
      });
    }
    return route.continue();
  });
}

test.describe("Dashboard — unauthenticated", () => {
  test("redirects to home when not authenticated", async ({ page }) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      }),
    );
    await page.goto("/dashboard");

    await page.waitForURL("/", { timeout: 10000 });
    await expect(page).toHaveURL("/");
  });
});

test.describe("Dashboard — empty state", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockGames(page, []);
    await page.goto("/dashboard");
  });

  test("shows 'No games yet' heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "No games yet" }),
    ).toBeVisible();
  });

  test("shows 'Create your first one.' subtext", async ({ page }) => {
    await expect(page.getByText("Create your first one.")).toBeVisible();
  });

  test("shows 'New Game' button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /New Game/i }),
    ).toBeVisible();
  });

  test("sidebar shows 'Dashboard' heading", async ({ page }) => {
    await expect(page.getByText("Dashboard")).toBeVisible();
    await expect(page.getByText("Your game library")).toBeVisible();
  });
});

test.describe("Dashboard — with games", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockGames(page, MOCK_GAMES);
    await page.goto("/dashboard");
  });

  test("shows 'My Games' heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "My Games" }),
    ).toBeVisible();
  });

  test("shows game count", async ({ page }) => {
    await expect(page.getByText("2 games")).toBeVisible();
  });

  test("renders game cards with titles", async ({ page }) => {
    await expect(page.getByText("Neon Platformer")).toBeVisible();
    await expect(page.getByText("Space Blaster")).toBeVisible();
  });

  test("shows Public badge for public game", async ({ page }) => {
    await expect(page.getByText("Public")).toBeVisible();
  });

  test("shows Private badge for private game", async ({ page }) => {
    await expect(page.getByText("Private")).toBeVisible();
  });

  test("shows date for games", async ({ page }) => {
    await expect(page.getByText("Today")).toBeVisible();
    await expect(page.getByText("2d ago")).toBeVisible();
  });

  test("header has 'New Game' button", async ({ page }) => {
    // The header "New Game" button (visible on desktop via hidden sm:inline)
    await expect(
      page.getByRole("button", { name: /New Game|New/i }),
    ).toBeVisible();
  });
});
