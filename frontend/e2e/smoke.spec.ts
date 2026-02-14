import { test, expect } from "@playwright/test";

test("smoke: Playwright is configured correctly", async ({ page }) => {
  // This test just confirms Playwright can launch and navigate
  await page.goto("/");
  await expect(page).toHaveTitle(/.*/);
});
