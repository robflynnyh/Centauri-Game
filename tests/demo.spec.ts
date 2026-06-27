import { expect, test } from "@playwright/test";

test("records a deterministic Centauri flythrough", async ({ page }, testInfo) => {
  await page.goto("/?demo=pr");
  await expect(page.getByText("Field Note 001")).toBeVisible();
  await expect(page.getByText("PR demo mode")).toBeVisible();
  await page.waitForTimeout(25_000);
  const video = page.video();
  await page.close();

  if (video) {
    await testInfo.attach("pr-demo", { path: await video.path(), contentType: "video/webm" });
  }
});
