import { expect, test, type Page } from "@playwright/test";

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

test("renders nonblank moving PR demo canvas on desktop and mobile", async ({ page }, testInfo) => {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/?demo=pr");
    await expect(page.getByText("PR demo mode")).toBeVisible();
    await page.addStyleTag({ content: ".hud { display: none !important; }" });
    await page.waitForTimeout(2_500);

    const first = await getCanvasSignal(page, testInfo.outputPath(`${viewport.name}-planet-demo-a.png`));
    await page.waitForTimeout(650);
    const second = await getCanvasSignal(page, testInfo.outputPath(`${viewport.name}-planet-demo-b.png`));

    expect(first.width).toBe(viewport.width);
    expect(first.height).toBe(viewport.height);
    expect(first.litPixels).toBeGreaterThan(1_500);
    expect(first.variance).toBeGreaterThan(80);
    expect(Math.abs(second.signature - first.signature)).toBeGreaterThan(0.5);
  }
});

test("starts near a visible beetle in beetle debug mode", async ({ page }) => {
  await page.goto("/?debug=beetle&test=collision");
  await expect(page.getByText("beetle debug")).toBeVisible();
  await page.waitForTimeout(500);

  const debugState = await page.evaluate(() => {
    if (!window.__centauriDebug) throw new Error("Missing Centauri debug state");
    return {
      player: window.__centauriDebug.getPlayer(),
      beetles: window.__centauriDebug.getBeetleState(),
    };
  });

  expect(debugState.player.x).toBeCloseTo(4.8, 1);
  expect(debugState.player.z).toBeCloseTo(14.2, 1);
  expect(debugState.beetles.total).toBe(8);
  expect(debugState.beetles.visible).toBeGreaterThan(0);
});

async function getCanvasSignal(page: Page, screenshotPath: string): Promise<{
  width: number;
  height: number;
  litPixels: number;
  variance: number;
  signature: number;
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
    let signature = 0;

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (data[i + 3] > 0 && brightness > 4) litPixels += 1;
      sum += brightness;
      sumSquares += brightness * brightness;
      signature += brightness * ((i / 4) % 17);
    }

    const pixels = data.length / 4;
    const mean = sum / pixels;
    return {
      width: image.width,
      height: image.height,
      litPixels,
      variance: sumSquares / pixels - mean * mean,
      signature: signature / pixels,
    };
  }, `data:image/png;base64,${screenshot.toString("base64")}`);
}
