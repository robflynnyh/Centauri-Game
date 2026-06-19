import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("records a deterministic Centauri flythrough", async ({ page }, testInfo) => {
  await page.goto("/?demo=pr");
  await expect(page.getByText("Centauri Field Note 001")).toBeVisible();
  await expect(page.getByText("PR demo mode")).toBeVisible();
  await page.waitForTimeout(12_000);
  const video = page.video();

  if (video) {
    const outputPath = "docs/demo/pr-demo.webm";
    await mkdir("docs/demo", { recursive: true });
    const saveVideo = video.saveAs(outputPath);
    await page.close();
    await saveVideo;
    await testInfo.attach("pr-demo", { path: outputPath, contentType: "video/webm" });
  } else {
    await page.close();
  }
});
