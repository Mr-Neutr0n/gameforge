import { test, expect, type Page } from "@playwright/test";

const GAME_ID = "abcd1234-5678-9abc-def0-123456789abc";

const MOCK_PUBLIC_GAME = {
  id: GAME_ID,
  title: "Space Blaster",
  description: "A retro space shooter with power-ups",
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
  created_at: "2025-12-15T10:30:00Z",
  creator_name: "TestCreator",
};

const MOCK_PUBLIC_GAME_NO_CODE = {
  id: GAME_ID,
  title: "Work In Progress",
  description: "Still generating",
  game_code: null,
  thumbnail_url: null,
  is_public: true,
  created_at: "2025-12-15T10:30:00Z",
  creator_name: "TestCreator",
};

const MOCK_AUDIT_SUMMARY = {
  overall_score: 92,
  has_audits: true,
  audits: {
    logic: { passed: true, score: 95 },
    ui: { passed: true, score: 90 },
    code: { passed: true, score: 91 },
  },
};

const MOCK_AUDIT_SUMMARY_LOW = {
  overall_score: 60,
  has_audits: true,
  audits: {
    logic: { passed: false, score: 50 },
    ui: { passed: true, score: 70 },
  },
};

function mockPublicGameAPI(
  page: Page,
  gameData: typeof MOCK_PUBLIC_GAME | typeof MOCK_PUBLIC_GAME_NO_CODE,
) {
  return page.route(`**/api/games/${GAME_ID}/public`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(gameData),
    }),
  );
}

function mockPublicGameAPI404(page: Page) {
  return page.route(`**/api/games/${GAME_ID}/public`, (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Game not found" }),
    }),
  );
}

function mockPublicAuditAPI(
  page: Page,
  auditData: typeof MOCK_AUDIT_SUMMARY | typeof MOCK_AUDIT_SUMMARY_LOW,
) {
  return page.route(`**/api/games/${GAME_ID}/audits/public`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(auditData),
    }),
  );
}

function mockPublicAuditAPI404(page: Page) {
  return page.route(`**/api/games/${GAME_ID}/audits/public`, (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({}),
    }),
  );
}

// --- Tests ---

test.describe("Share page — game not found (404)", () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicGameAPI404(page);
    await mockPublicAuditAPI404(page);
    await page.goto(`/game/${GAME_ID}`);
  });

  test("shows 'Game Not Found' heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Game Not Found" }),
    ).toBeVisible();
  });

  test("shows error description text", async ({ page }) => {
    // API returns { detail: "Game not found" }, which becomes the error message
    // Use exact match to target the <p> element, not the <h1> heading
    await expect(
      page.getByText("Game not found", { exact: true }),
    ).toBeVisible();
  });

  test("shows 'Go to Game Builder' link", async ({ page }) => {
    const link = page.getByRole("link", { name: "Go to Game Builder" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/");
  });
});

test.describe("Share page — game in progress (no code)", () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicGameAPI(page, MOCK_PUBLIC_GAME_NO_CODE);
    await mockPublicAuditAPI404(page);
    await page.goto(`/game/${GAME_ID}`);
  });

  test("shows 'Game In Progress' heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Game In Progress" }),
    ).toBeVisible();
  });

  test("shows 'still being generated' text", async ({ page }) => {
    await expect(
      page.getByText("This game is still being generated. Check back soon!"),
    ).toBeVisible();
  });

  test("shows 'Go to Game Builder' link", async ({ page }) => {
    const link = page.getByRole("link", { name: "Go to Game Builder" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/");
  });
});

test.describe("Share page — with game code", () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicGameAPI(page, MOCK_PUBLIC_GAME);
    await mockPublicAuditAPI(page, MOCK_AUDIT_SUMMARY);
    await page.goto(`/game/${GAME_ID}`);
  });

  test("shows game title", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Space Blaster" }),
    ).toBeVisible();
  });

  test("shows game description", async ({ page }) => {
    await expect(
      page.getByText("A retro space shooter with power-ups"),
    ).toBeVisible();
  });

  test("shows 'Game Builder' header link", async ({ page }) => {
    const link = page.getByRole("link", { name: /Game Builder/i }).first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/");
  });

  test("shows fullscreen button", async ({ page }) => {
    const btn = page.getByTitle("Fullscreen");
    await expect(btn).toBeVisible();
  });

  test("shows game iframe (Game Preview)", async ({ page }) => {
    const iframe = page.locator('iframe[title="Game Preview"]');
    await expect(iframe).toBeVisible();
  });

  test("shows creator name", async ({ page }) => {
    await expect(page.getByText("TestCreator")).toBeVisible();
  });

  test("shows formatted creation date", async ({ page }) => {
    // "2025-12-15T10:30:00Z" → "Dec 15, 2025"
    await expect(page.getByText("Dec 15, 2025")).toBeVisible();
  });

  test("shows 'Made with Game Builder' badge", async ({ page }) => {
    await expect(page.getByText("Made with Game Builder")).toBeVisible();
  });

  test("shows 'Create your own game with AI' subtitle", async ({ page }) => {
    await expect(
      page.getByText("Create your own game with AI"),
    ).toBeVisible();
  });

  test("shows 'Quality Verified' badge when score > 80", async ({ page }) => {
    await expect(page.getByText("Quality Verified")).toBeVisible();
    await expect(page.getByText("Score: 92/100")).toBeVisible();
  });
});

test.describe("Share page — with game code, low audit score", () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicGameAPI(page, MOCK_PUBLIC_GAME);
    await mockPublicAuditAPI(page, MOCK_AUDIT_SUMMARY_LOW);
    await page.goto(`/game/${GAME_ID}`);
  });

  test("does NOT show 'Quality Verified' badge when score <= 80", async ({
    page,
  }) => {
    // The game title should be visible (page loaded), but no quality badge
    await expect(
      page.getByRole("heading", { name: "Space Blaster" }),
    ).toBeVisible();
    await expect(page.getByText("Quality Verified")).not.toBeVisible();
  });
});

test.describe("Share page — fullscreen mode", () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicGameAPI(page, MOCK_PUBLIC_GAME);
    await mockPublicAuditAPI(page, MOCK_AUDIT_SUMMARY);
    await page.goto(`/game/${GAME_ID}`);
  });

  test("enters fullscreen on button click and shows exit button", async ({
    page,
  }) => {
    await page.getByTitle("Fullscreen").click();
    // In fullscreen, the exit button with title "Exit fullscreen (Esc)" should appear
    const exitBtn = page.getByTitle("Exit fullscreen (Esc)");
    await expect(exitBtn).toBeVisible();
  });

  test("exits fullscreen on Escape key", async ({ page }) => {
    await page.getByTitle("Fullscreen").click();
    await expect(page.getByTitle("Exit fullscreen (Esc)")).toBeVisible();
    await page.keyboard.press("Escape");
    // After escape, the normal Fullscreen button should be visible again
    await expect(page.getByTitle("Fullscreen")).toBeVisible();
  });
});
