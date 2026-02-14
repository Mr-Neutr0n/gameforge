import { test, expect, type Page } from "@playwright/test";

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

const GAME_ID = "abcd1234-5678-9abc-def0-123456789abc";

const MOCK_GAME_EMPTY = {
  id: GAME_ID,
  user_id: "test-user-1",
  title: null,
  description: null,
  prompt: "Make a platformer game with jumping",
  game_code: null,
  thumbnail_url: null,
  is_public: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  conversations: [],
  audit_results: [],
};

const MOCK_GAME_WITH_CODE = {
  id: GAME_ID,
  user_id: "test-user-1",
  title: "Neon Platformer",
  description: "A retro neon-themed platformer",
  prompt: "Make a platformer game with jumping",
  game_code: `const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  scene: { preload: function(){}, create: function(){}, update: function(){} }
};
const game = new Phaser.Game(config);`,
  thumbnail_url: null,
  is_public: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  conversations: [
    {
      id: "conv-1",
      game_id: GAME_ID,
      role: "user",
      content: "Make a platformer game with jumping",
      step_type: "user",
      created_at: new Date().toISOString(),
    },
    {
      id: "conv-2",
      game_id: GAME_ID,
      role: "agent",
      content: '{"plan":"Create a basic platformer with player, platforms, and jump mechanics"}',
      step_type: "plan",
      created_at: new Date().toISOString(),
    },
  ],
  audit_results: [],
};

function mockAuth(page: Page) {
  return page.route("**/api/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SESSION),
    }),
  );
}

function mockGameAPI(page: Page, gameData: typeof MOCK_GAME_EMPTY) {
  return page.route(`**/api/games/${GAME_ID}`, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(gameData),
      });
    }
    // PATCH — return the same game data
    if (route.request().method() === "PATCH") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(gameData),
      });
    }
    return route.continue();
  });
}

function mockAuditsAPI(page: Page) {
  return page.route(`**/api/games/${GAME_ID}/audits`, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }
    return route.continue();
  });
}

function mockGenerateAPI(page: Page) {
  // Mock the generate endpoint to prevent auto-generation from actually firing
  return page.route(`**/api/games/${GAME_ID}/generate`, (route) => {
    // Return an empty SSE stream that immediately completes
    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "data: [DONE]\n\n",
    });
  });
}

test.describe("Workspace — unauthenticated", () => {
  test("redirects to home when not authenticated", async ({ page }) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      }),
    );
    await page.goto(`/workspace/${GAME_ID}`);
    await page.waitForURL("/", { timeout: 10000 });
    await expect(page).toHaveURL("/");
  });
});

test.describe("Workspace — empty state (no game code)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockGameAPI(page, MOCK_GAME_EMPTY);
    await mockGenerateAPI(page);
    await page.goto(`/workspace/${GAME_ID}`);
  });

  test("shows 'Game' header text", async ({ page }) => {
    const header = page.locator("h3", { hasText: "Game" });
    await expect(header.first()).toBeVisible();
  });

  test("shows 'Ready to generate' text", async ({ page }) => {
    await expect(page.getByText("Ready to generate")).toBeVisible();
  });

  test("shows 'Your game will appear here' subtext", async ({ page }) => {
    await expect(
      page.getByText("Your game will appear here"),
    ).toBeVisible();
  });

  test("shows Generate button when game has a prompt", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Generate/i }),
    ).toBeVisible();
  });

  test("activity sidebar has 'Activity' heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Activity" }),
    ).toBeVisible();
  });

  test("sidebar shows truncated game ID", async ({ page }) => {
    // Game ID first 8 chars: abcd1234
    await expect(page.getByText("abcd1234")).toBeVisible();
  });
});

test.describe("Workspace — with game code", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockGameAPI(page, MOCK_GAME_WITH_CODE);
    await mockAuditsAPI(page);
    await page.goto(`/workspace/${GAME_ID}`);
  });

  test("shows game title in toolbar", async ({ page }) => {
    await expect(page.getByText("Neon Platformer")).toBeVisible();
  });

  test("shows iframe container with 'Game Preview' title", async ({ page }) => {
    const iframe = page.locator('iframe[title="Game Preview"]');
    await expect(iframe).toBeVisible();
  });

  test("shows 'Game' header with Running status", async ({ page }) => {
    const header = page.locator("h3", { hasText: "Game" });
    await expect(header.first()).toBeVisible();
    await expect(page.getByText("Running")).toBeVisible();
  });

  test("toolbar shows Save button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Save/i }),
    ).toBeVisible();
  });

  test("toolbar shows Details button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Details", exact: true }),
    ).toBeVisible();
  });

  test("shows Quality panel heading", async ({ page }) => {
    await expect(page.getByText("Quality", { exact: true })).toBeVisible();
  });

  test("shows Re-run button for audits", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Re-run/i }),
    ).toBeVisible();
  });

  test("activity sidebar has 'Activity' heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Activity" }),
    ).toBeVisible();
  });

  test("shows visibility badge", async ({ page }) => {
    // MOCK_GAME_WITH_CODE is public
    await expect(page.getByText("Public")).toBeVisible();
  });
});
