import { expect, test, type Page } from "@playwright/test";

test.use({
  video: "off",
  viewport: { width: 1280, height: 720 },
});

test.describe.configure({ mode: "serial" });

test("captures a deterministic Centauri PR screenshot", async ({ page }) => {
  await page.goto("/?debug=observatory&test=collision");
  await expect(page.getByText("Field Note 001")).toBeVisible();
  await expect(page.getByText("observatory debug")).toBeVisible();
  await page.addStyleTag({ content: ".hud__title, .hud__sleep { display: none !important; }" });
  await page.waitForTimeout(1_200);
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
    await page.addStyleTag({ content: ".hud, .eyelids { display: none !important; }" });
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

test("telescope mode renders a nonblack scoped canvas", async ({ page }, testInfo) => {
  await page.goto("/?debug=telescope&test=collision");
  await expect(page.getByText("telescope debug")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const viewState = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri telescope debug hook");
    const observatory = debug.enterTelescope();
    return {
      observatory,
      viewBlocked: debug.isBlockedAt(observatory.telescopeViewX, observatory.telescopeViewZ),
    };
  });
  await page.waitForTimeout(500);

  expect(viewState.observatory.telescopeActive).toBe(true);
  expect(viewState.observatory.cameraFov).toBeLessThan(40);
  expect(viewState.viewBlocked).toBe(false);

  await page.addStyleTag({ content: ".hud, .telescope-scope { display: none !important; }" });
  const signal = await getCanvasSignal(page, testInfo.outputPath("telescope-scoped-canvas.png"));
  expect(signal.litPixels).toBeGreaterThan(3_000);
  expect(signal.meanBrightness).toBeGreaterThan(22);
  expect(signal.variance).toBeGreaterThan(8);
});

test("PR demo traverses day, twilight, and night sky regions", async ({ page }) => {
  await page.goto("/?demo=pr&test=collision");
  await expect(page.getByText("PR demo mode")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const daySide = await (await page.waitForFunction(() => {
    const state = window.__centauriDebug?.getSkyState();
    return state && state.dayAmount > 0.75 && Math.abs(state.latitude) > 0.1 ? state : false;
  })).jsonValue();
  const twilightEdge = await (await page.waitForFunction(() => {
    const state = window.__centauriDebug?.getSkyState();
    return state && state.twilightAmount > 0.45 && Math.abs(state.latitude) > 0.04 ? state : false;
  })).jsonValue();
  const nightSide = await (await page.waitForFunction(() => {
    const state = window.__centauriDebug?.getSkyState();
    return state && state.dayAmount < 0.25 && Math.abs(state.latitude) > 0.1 ? state : false;
  })).jsonValue();

  expect(daySide?.dayAmount).toBeGreaterThan(0.75);
  expect(twilightEdge?.twilightAmount).toBeGreaterThan(0.45);
  expect(nightSide?.dayAmount).toBeLessThan(0.25);
  expect((daySide?.dayAmount ?? 0) - (nightSide?.dayAmount ?? 0)).toBeGreaterThan(0.6);
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
  expect(Number.isFinite(debugState.beetles.nearestObstacleClearance)).toBe(true);
  expect(debugState.beetles.nearestObstacleClearance).toBeGreaterThan(0.2);
});

test("starts near mountain birds and triggers clear fleeing", async ({ page }) => {
  await page.goto("/?debug=birds&test=collision");
  await expect(page.getByText("birds debug")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getBirdState));
  await page.waitForTimeout(500);

  const settledState = await page.evaluate(() => {
    if (!window.__centauriDebug) throw new Error("Missing Centauri debug state");
    return {
      player: window.__centauriDebug.getPlayer(),
      birds: window.__centauriDebug.getBirdState(),
      lowlandHeight: window.__centauriDebug.terrainHeightAt(0, 24),
    };
  });

  expect(settledState.birds.total).toBeGreaterThanOrEqual(3);
  expect(settledState.birds.visible).toBeGreaterThan(0);
  expect(settledState.birds.minAnchorHeight).toBeGreaterThan(settledState.lowlandHeight + 7);
  expect(settledState.birds.minAnchorSuitability).toBeGreaterThan(0.55);
  expect(Number.isFinite(settledState.birds.nearestTerrainClearance)).toBe(true);
  expect(settledState.birds.nearestTerrainClearance).toBeGreaterThan(6);
  expect(settledState.player.x).toBeCloseTo(settledState.birds.nearestAnchor.x + 22, 0);
  expect(settledState.player.z).toBeCloseTo(settledState.birds.nearestAnchor.z + 8, 0);
  expect(settledState.birds.total).toBeGreaterThan(24);
  expect(Math.hypot(settledState.birds.distantAnchor.x - settledState.birds.nearestAnchor.x, settledState.birds.distantAnchor.z - settledState.birds.nearestAnchor.z)).toBeGreaterThan(720);

  await page.evaluate(({ x, z }) => window.__centauriDebug?.setPlayer(x + 22, z + 8), settledState.birds.distantAnchor);
  await page.waitForTimeout(500);
  const distantState = await page.evaluate(() => {
    if (!window.__centauriDebug) throw new Error("Missing Centauri debug state");
    const birds = window.__centauriDebug.getBirdState();
    return {
      birds,
      distantHeight: window.__centauriDebug.terrainHeightAt(birds.nearestAnchor.x, birds.nearestAnchor.z),
      lowlandHeight: window.__centauriDebug.terrainHeightAt(0, 24),
    };
  });

  expect(distantState.birds.visible).toBeGreaterThan(0);
  expect(distantState.distantHeight).toBeGreaterThan(distantState.lowlandHeight + 7);

  await page.evaluate(() => {
    const anchor = window.__centauriDebug?.getBirdState().nearestAnchor;
    if (!anchor) throw new Error("Missing bird anchor");
    window.__centauriDebug?.setPlayer(anchor.x + 1.5, anchor.z + 1.5);
  });
  await page.waitForFunction(() => (window.__centauriDebug?.getBirdState().fleeing ?? 0) > 0);
  const fleeState = await page.evaluate(() => window.__centauriDebug?.getBirdState());

  expect(fleeState?.fleeing).toBeGreaterThan(0);
  expect(fleeState?.nearestTerrainClearance).toBeGreaterThan(6);

  await page.evaluate(() => {
    const anchor = window.__centauriDebug?.getBirdState().nearestAnchor;
    if (!anchor) throw new Error("Missing bird anchor");
    window.__centauriDebug?.setPlayer(anchor.x - 5.5, anchor.z + 2.5);
  });
  await page.waitForTimeout(160);
  const afterStrafeState = await page.evaluate(() => window.__centauriDebug?.getBirdState());

  await page.waitForTimeout(650);
  const afterStopState = await page.evaluate(() => window.__centauriDebug?.getBirdState());
  const postStopMotion = Math.hypot(
    (afterStopState?.nearestPosition.x ?? 0) - (afterStrafeState?.nearestPosition.x ?? 0),
    (afterStopState?.nearestPosition.z ?? 0) - (afterStrafeState?.nearestPosition.z ?? 0)
  );

  expect(afterStopState?.fleeing).toBeGreaterThan(0);
  expect(postStopMotion).toBeGreaterThan(0.2);
  expect(afterStopState?.maxFrameDisplacement).toBeLessThan(2.5);
});

test("isolation debug state rises outside populated biome patches", async ({ page }) => {
  await page.goto("/?test=isolation");
  await expect(page.getByText("isolation debug")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getVisionState));

  await page.waitForFunction(() => {
    const state = window.__centauriDebug?.getVisionState();
    return Boolean(state && state.nearestBiomePatchDistance > 150 && state.isolationAmount > 0.65);
  });
  const farState = await page.evaluate(() => window.__centauriDebug?.getVisionState());

  await page.evaluate(() => window.__centauriDebug?.setPlayer(8, 18));
  await page.waitForFunction(() => {
    const state = window.__centauriDebug?.getVisionState();
    return Boolean(state && state.nearestBiomePatchDistance < 24 && state.isolationAmount < 0.18);
  });
  const nearState = await page.evaluate(() => window.__centauriDebug?.getVisionState());

  expect(farState?.nearestBiomePatchDistance).toBeGreaterThan(150);
  expect(farState?.isolationAmount).toBeGreaterThan(0.65);
  expect(nearState?.nearestBiomePatchDistance).toBeLessThan(24);
  expect(nearState?.isolationAmount).toBeLessThan(0.18);
  expect((farState?.isolationAmount ?? 0) - (nearState?.isolationAmount ?? 0)).toBeGreaterThan(0.45);
});

test("normal exploration can reach visible isolation in deterministic wilderness", async ({ page }) => {
  await page.goto("/?test=collision");
  await expect(page.getByText("exploration mode")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getVisionState));

  const spawnState = await page.evaluate(() => ({
    player: window.__centauriDebug?.getPlayer(),
    vision: window.__centauriDebug?.getVisionState(),
  }));
  expect(spawnState.player?.x).toBeCloseTo(0, 1);
  expect(spawnState.player?.z).toBeCloseTo(24, 1);
  expect(spawnState.vision?.nearestBiomePatchDistance).toBeLessThan(30);
  expect(spawnState.vision?.targetIsolationAmount).toBe(0);

  await page.evaluate(() => window.__centauriDebug?.setPlayer(360, 360));
  await page.waitForFunction(() => {
    const state = window.__centauriDebug?.getVisionState();
    return Boolean(state && state.nearestBiomePatchDistance > 100 && state.targetIsolationAmount > 0.5 && state.isolationAmount > 0.45);
  });

  const wildernessState = await page.evaluate(() => ({
    player: window.__centauriDebug?.getPlayer(),
    vision: window.__centauriDebug?.getVisionState(),
  }));
  expect(wildernessState.player?.x).toBeCloseTo(360, 1);
  expect(wildernessState.player?.z).toBeCloseTo(360, 1);
  expect(wildernessState.vision?.nearestBiomePatchDistance).toBeGreaterThan(100);
  expect(wildernessState.vision?.targetIsolationAmount).toBeGreaterThan(0.5);
  expect(wildernessState.vision?.isolationAmount).toBeGreaterThan(0.45);
});

test("isolation postprocess visibly changes the rendered frame", async ({ page }, testInfo) => {
  await page.goto("/?test=isolation");
  await expect(page.getByText("isolation debug")).toBeVisible();
  await page.waitForFunction(() => {
    const state = window.__centauriDebug?.getVisionState();
    return Boolean(state && state.nearestBiomePatchDistance > 150);
  });
  await page.waitForTimeout(1_000);
  const warmup = await getCanvasSignal(page, testInfo.outputPath("isolation-warmup.png"));
  expect(warmup.variance).toBeGreaterThan(20);

  await page.evaluate(() => window.__centauriDebug?.setIsolationOverride(0));
  await page.waitForFunction(() => (window.__centauriDebug?.getVisionState().isolationAmount ?? 1) < 0.02);
  await page.waitForTimeout(250);
  const isolationOff = await page.locator("canvas").screenshot({ path: testInfo.outputPath("isolation-off.png") });

  await page.evaluate(() => window.__centauriDebug?.setIsolationOverride(1));
  await page.waitForFunction(() => (window.__centauriDebug?.getVisionState().isolationAmount ?? 0) > 0.98);
  await page.waitForTimeout(250);
  const isolationOn = await page.locator("canvas").screenshot({ path: testInfo.outputPath("isolation-on.png") });

  const difference = await getImageDifference(page, isolationOff, isolationOn);
  expect(difference.meanAbsoluteDifference).toBeGreaterThan(2.5);
  expect(difference.changedPixels).toBeGreaterThan(1_000);
  expect(difference.maxPixelDifference).toBeGreaterThan(24);
});

async function getCanvasSignal(page: Page, screenshotPath: string): Promise<{
  width: number;
  height: number;
  litPixels: number;
  meanBrightness: number;
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
      meanBrightness: mean,
      variance: sumSquares / pixels - mean * mean,
      signature: signature / pixels,
    };
  }, `data:image/png;base64,${screenshot.toString("base64")}`);
}

async function getImageDifference(
  page: Page,
  before: Buffer,
  after: Buffer
): Promise<{
  meanAbsoluteDifference: number;
  changedPixels: number;
  maxPixelDifference: number;
}> {
  return page.evaluate(
    async ({ beforeSource, afterSource }) => {
      const loadImage = async (source: string): Promise<HTMLImageElement> => {
        const image = new Image();
        image.src = source;
        await image.decode();
        return image;
      };

      const beforeImage = await loadImage(beforeSource);
      const afterImage = await loadImage(afterSource);
      const sampleWidth = 160;
      const sampleHeight = 90;
      const sampler = document.createElement("canvas");
      sampler.width = sampleWidth;
      sampler.height = sampleHeight;
      const context = sampler.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Missing 2D sampling context");

      context.drawImage(beforeImage, 0, 0, sampleWidth, sampleHeight);
      const beforeData = new Uint8ClampedArray(context.getImageData(0, 0, sampleWidth, sampleHeight).data);
      context.clearRect(0, 0, sampleWidth, sampleHeight);
      context.drawImage(afterImage, 0, 0, sampleWidth, sampleHeight);
      const afterData = context.getImageData(0, 0, sampleWidth, sampleHeight).data;

      let sum = 0;
      let changedPixels = 0;
      let maxPixelDifference = 0;

      for (let i = 0; i < beforeData.length; i += 4) {
        const redDifference = Math.abs(afterData[i] - beforeData[i]);
        const greenDifference = Math.abs(afterData[i + 1] - beforeData[i + 1]);
        const blueDifference = Math.abs(afterData[i + 2] - beforeData[i + 2]);
        const pixelDifference = (redDifference + greenDifference + blueDifference) / 3;
        sum += pixelDifference;
        if (pixelDifference > 8) changedPixels += 1;
        maxPixelDifference = Math.max(maxPixelDifference, pixelDifference);
      }

      const pixels = beforeData.length / 4;
      return {
        meanAbsoluteDifference: sum / pixels,
        changedPixels,
        maxPixelDifference,
      };
    },
    {
      beforeSource: `data:image/png;base64,${before.toString("base64")}`,
      afterSource: `data:image/png;base64,${after.toString("base64")}`,
    }
  );
}
