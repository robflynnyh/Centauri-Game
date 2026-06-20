import { expect, test } from "@playwright/test";
import { mkdir, rename } from "node:fs/promises";

test("records a deterministic Centauri flythrough", async ({ browser }, testInfo) => {
  await mkdir("docs/demo", { recursive: true });
  const context = await browser.newContext({
    recordVideo: { dir: "docs/demo", size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await page.goto("/?demo=pr");
  await expect(page.getByText("Centauri Field Note 001")).toBeVisible();
  await expect(page.getByText("PR demo mode")).toBeVisible();
  await page.waitForTimeout(20_000);
  const video = page.video();
  await page.close();
  await context.close();

  if (video) {
    const outputPath = "docs/demo/pr-demo.webm";
    await rename(await video.path(), outputPath);
    await testInfo.attach("pr-demo", { path: outputPath, contentType: "video/webm" });
  }
});
