import { expect, test } from "@playwright/test";

test.use({
  video: "off",
  viewport: { width: 1280, height: 720 },
});

test("captures a deterministic Centauri PR screenshot", async ({ page }) => {
  await page.goto("/?demo=pr");
  await expect(page.getByText("Centauri Field Note 001")).toBeVisible();
  await expect(page.getByText("PR demo mode")).toBeVisible();
  await page.waitForTimeout(7_000);
  await page.screenshot({ path: "docs/demo/pr-preview.png", fullPage: false });
});
