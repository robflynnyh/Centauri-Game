import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("records a deterministic Centauri flythrough", async ({ page }, testInfo) => {
  await page.goto("/?demo=pr");
  await expect(page.getByText("Field Note 001")).toBeVisible();
  await expect(page.getByText("PR demo mode")).toBeVisible();
  await page.waitForTimeout(16_500);
  const video = page.video();
  await page.close();

  if (video) {
    const outputPath = "docs/demo/pr-demo.webm";
    await mkdir("docs/demo", { recursive: true });
    await video.saveAs(outputPath);
    await testInfo.attach("pr-demo", { path: outputPath, contentType: "video/webm" });
  }
});
