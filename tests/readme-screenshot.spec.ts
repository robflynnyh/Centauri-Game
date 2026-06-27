import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";

const readmeScreenshotPath = "docs/readme/tree-biome-screenshot.png";

test.use({
  video: "off",
  viewport: { width: 1280, height: 720 },
});

test("captures a stable Centauri tree-biome README screenshot", async ({ page }) => {
  await page.goto("/?test=collision");
  await expect(page.getByText("Field Note 001")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  await page.evaluate(() => window.__centauriDebug?.setSkyElapsed(5));
  await page.waitForFunction(() => {
    const nature = window.__centauriDebug?.getNatureState();
    const sky = window.__centauriDebug?.getSkyState();
    return Boolean(nature && sky && nature.nearestBiomePatchDistance < 25 && sky.dayAmount > 0.8);
  });

  await page.addStyleTag({
    content: ".hud, .eyelids, .blackout, .underwater, .telescope-scope { display: none !important; }",
  });
  await page.waitForTimeout(1_000);

  fs.mkdirSync("docs/readme", { recursive: true });
  const signal = await captureCanvasSignal(page, readmeScreenshotPath);

  expect(signal.width).toBe(1280);
  expect(signal.height).toBe(720);
  expect(signal.litPixels).toBeGreaterThan(2_000);
  expect(signal.meanBrightness).toBeGreaterThan(35);
  expect(signal.variance).toBeGreaterThan(500);
});

async function captureCanvasSignal(
  page: Page,
  screenshotPath: string
): Promise<{
  width: number;
  height: number;
  litPixels: number;
  meanBrightness: number;
  variance: number;
}> {
  const screenshot = await page.locator("canvas").screenshot({ path: screenshotPath });
  return page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();

    const sampleWidth = 96;
    const sampleHeight = 54;
    const sampler = document.createElement("canvas");
    sampler.width = sampleWidth;
    sampler.height = sampleHeight;
    const context = sampler.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Missing 2D sampling context");

    context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
    const data = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    let litPixels = 0;
    let sum = 0;
    let sumSquares = 0;

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (data[i + 3] > 0 && brightness > 4) litPixels += 1;
      sum += brightness;
      sumSquares += brightness * brightness;
    }

    const pixels = data.length / 4;
    const mean = sum / pixels;
    return {
      width: image.width,
      height: image.height,
      litPixels,
      meanBrightness: mean,
      variance: sumSquares / pixels - mean * mean,
    };
  }, `data:image/png;base64,${screenshot.toString("base64")}`);
}
