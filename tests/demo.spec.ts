import { expect, test } from "@playwright/test";

test("records a deterministic Centauri flythrough", async ({ page }) => {
  await page.goto("/?demo=pr");
  await expect(page.getByText("Centauri Field Note 001")).toBeVisible();
  await expect(page.getByText("PR demo mode")).toBeVisible();
  await page.waitForTimeout(12_000);
});
