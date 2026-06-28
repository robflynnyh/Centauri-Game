import { expect, test, type Page } from "@playwright/test";

test.use({
  video: "off",
  viewport: { width: 1280, height: 720 },
});

test.describe.configure({ mode: "serial" });

test("captures a deterministic Centauri PR screenshot with the crashed ship", async ({ page }) => {
  await page.goto("/?debug=ship&test=collision");
  await expect(page.getByText("Field Note 001")).toBeVisible();
  await expect(page.getByText("ship debug")).toBeVisible();
  await page.addStyleTag({ content: ".hud, .eyelids { display: none !important; }" });
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getCrashedShipState));
  await page.waitForFunction(() => (window.__centauriDebug?.getCrashedShipState().smoke.samples.some((sample) => sample.opacity > 0.08) ?? false));
  await page.waitForTimeout(1_000);
  const screenshot = await page.screenshot({ path: "docs/demo/pr-preview.png", fullPage: false });
  const signal = await getScreenshotSignal(page, screenshot);
  expect(signal.litPixels).toBeGreaterThan(2_500);
  expect(signal.meanBrightness).toBeGreaterThan(20);
  expect(signal.variance).toBeGreaterThan(12);
});

test("statue debug renders a visible talking stone landmark", async ({ page }, testInfo) => {
  await page.goto("/?debug=statue&test=collision");
  await expect(page.getByText("statue debug")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getTalkingStatueState));
  await page.waitForFunction(() => (window.__centauriDebug?.getTalkingStatueState().wakeAmount ?? 0) > 0.2);
  await page.addStyleTag({ content: ".hud, .eyelids { display: none !important; }" });
  await page.waitForTimeout(400);

  const signal = await getCanvasSignal(page, testInfo.outputPath("statue-debug-canvas.png"));
  expect(signal.litPixels).toBeGreaterThan(2_500);
  expect(signal.meanBrightness).toBeGreaterThan(20);
  expect(signal.variance).toBeGreaterThan(12);
});

test("ocean debug exposes three large irregular deep oceans", async ({ page }) => {
  await page.goto("/?debug=ocean&test=collision");
  await expect(page.getByText("ocean debug")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getOceanDebugState));

  const state = await page.evaluate(() => window.__centauriDebug?.getOceanDebugState());
  expect(state?.oceanCount).toBe(3);
  expect(state?.movementSpeedMultiplierInOcean).toBeCloseTo(0.5, 2);
  expect(state?.regions).toHaveLength(3);

  const purpleOcean = state?.regions.find((ocean) => ocean.id === "amethyst");
  expect(purpleOcean?.name).toBe("Amethyst Abyss");
  expect(purpleOcean?.palette).toEqual({
    deep: "#3c177c",
    mid: "#8e3ed2",
    shore: "#e0a7ff",
  });

  for (const ocean of state?.regions ?? []) {
    expect(ocean.estimatedShorelineCircumference).toBeGreaterThan(1_650);
    expect(ocean.estimatedShorelineCircumference).toBeLessThan(2_250);
    expect(ocean.maxShorelineRadius - ocean.minShorelineRadius).toBeGreaterThan(42);
    expect(ocean.maxTerrainDepthBelowSurface).toBeGreaterThan(16);

    const deepState = await page.evaluate(
      ({ x, z }) => window.__centauriDebug?.getOceanStateAt(x, z),
      ocean.deepSample
    );
    const outsideState = await page.evaluate(
      ({ x, z }) => window.__centauriDebug?.getOceanStateAt(x, z),
      ocean.outsideShoreSample
    );

    expect(deepState?.isInOcean).toBe(true);
    expect(deepState?.terrainDepthBelowSurface).toBeGreaterThan(16);
    expect(deepState?.movementSpeedMultiplier).toBeCloseTo(0.5, 2);
    expect(outsideState?.isInOcean).toBe(false);

    for (const sample of ocean.shorelineSamples) {
      const shorelineState = await page.evaluate(
        ({ inside, outside }) => {
          const insideState = window.__centauriDebug?.getOceanStateAt(inside.x, inside.z);
          const outsideState = window.__centauriDebug?.getOceanStateAt(outside.x, outside.z);
          return {
            insideState,
            outsideState,
            insideTerrainHeight: window.__centauriDebug?.terrainHeightAt(inside.x, inside.z),
            outsideTerrainHeight: window.__centauriDebug?.terrainHeightAt(outside.x, outside.z),
          };
        },
        sample
      );

      expect(shorelineState.insideState?.isInOcean).toBe(true);
      expect(shorelineState.insideTerrainHeight).toBeGreaterThan((shorelineState.insideState?.waterSurfaceHeight ?? 0) - 5);
      expect(shorelineState.outsideState?.signedShoreDistance).toBeGreaterThan(-2);
      expect(shorelineState.outsideTerrainHeight).toBeGreaterThan((shorelineState.outsideState?.waterSurfaceHeight ?? 0) - 0.35);
    }
  }

  await page.goto("/?debug=purple-ocean&test=collision");
  await expect(page.getByText("purple ocean debug")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getOceanState));

  const purpleDebugState = await page.evaluate(() => window.__centauriDebug?.getOceanState());
  expect(purpleDebugState?.nearestRegionId).toBe("amethyst");
});

test("walking through ocean water is about twice as slow", async ({ page }) => {
  await page.goto("/?debug=ocean&test=collision");
  await expect(page.getByText("ocean debug")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getOceanDebugState));

  const ocean = await page.evaluate(() => window.__centauriDebug?.getOceanDebugState().regions[0]);
  const outside = { x: 1200, z: 500 };
  const inside = ocean.deepSample;

  const outsideState = await page.evaluate(
    ({ x, z }) => window.__centauriDebug?.getOceanStateAt(x, z),
    outside
  );
  const outsideDistance = await walkForwardFor(page, outside, 3_200);
  const insideDistance = await walkForwardFor(page, inside, 3_200);
  const insideState = await page.evaluate(() => window.__centauriDebug?.getOceanState());

  expect(outsideState?.isInOcean).toBe(false);
  expect(insideState?.isInOcean).toBe(true);
  expect(insideState?.movementSpeedMultiplier).toBeCloseTo(0.5, 2);
  expect(outsideDistance).toBeGreaterThan(14);
  expect(insideDistance).toBeGreaterThan(7);
  expect(insideDistance / outsideDistance).toBeGreaterThan(0.45);
  expect(insideDistance / outsideDistance).toBeLessThan(0.62);
});

for (const diamondDebug of [
  { route: "diamond", biomeId: "primary", gravityMultiplier: 0.5 },
  { route: "diamond2", biomeId: "cyan", gravityMultiplier: 0.25 },
  { route: "diamond3", biomeId: "rose", gravityMultiplier: 0.125 },
]) {
  test(`${diamondDebug.route} debug starts inside its prismatic low-gravity biome`, async ({ page }) => {
    await page.goto(`/?debug=${diamondDebug.route}&test=collision`);
    await expect(page.getByText(`${diamondDebug.route} debug`)).toBeVisible();
    await page.waitForFunction(() => Boolean(window.__centauriDebug?.getDiamondBiomeState));
    await page.waitForTimeout(600);

    const state = await page.evaluate(() => {
      const debug = window.__centauriDebug;
      if (!debug) throw new Error("Missing Centauri diamond debug hook");
      return {
        player: debug.getPlayer(),
        movement: debug.getMovementState(),
        diamond: debug.getDiamondBiomeState(),
        terrainHeight: debug.terrainHeightAt(debug.getPlayer().x, debug.getPlayer().z),
      };
    });

    expect(state.diamond.biomeCount).toBe(3);
    expect(state.diamond.biomeId).toBe(diamondDebug.biomeId);
    expect(state.diamond.debugName).toBe(diamondDebug.route);
    expect(state.diamond.isInside).toBe(true);
    expect(state.diamond.activeAmount).toBeGreaterThan(0.25);
    expect(state.diamond.gravityMultiplier).toBeCloseTo(diamondDebug.gravityMultiplier, 3);
    expect(state.movement.gravityMultiplier).toBeCloseTo(diamondDebug.gravityMultiplier, 3);
    expect(state.diamond.renderedFragmentCount).toBeGreaterThan(80);
    expect(state.diamond.renderedChunkCount).toBeGreaterThan(4);
    expect(Math.hypot(state.player.x - state.diamond.debugSpawn.x, state.player.z - state.diamond.debugSpawn.z)).toBeLessThan(0.5);
    expect(Number.isFinite(state.terrainHeight)).toBe(true);
  });
}

test("diamond prism vision and gravity fade out beyond the biome", async ({ page }) => {
  await page.goto("/?debug=diamond&test=collision");
  await expect(page.getByText("diamond debug")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getDiamondBiomeState));

  const diamond = await page.evaluate(() => window.__centauriDebug?.getDiamondBiomeState());
  if (!diamond) throw new Error("Missing diamond debug state");

  await page.evaluate(({ x, z }) => window.__centauriDebug?.setPlayer(x, z), diamond.outsideSample);
  await page.waitForFunction(() => {
    const vision = window.__centauriDebug?.getVisionState();
    const state = window.__centauriDebug?.getDiamondBiomeState();
    return Boolean(vision && state && !state.isInside && vision.targetPrismAmount === 0 && vision.prismAmount < 0.08);
  });
  const outside = await page.evaluate(() => ({
    biome: window.__centauriDebug?.getDiamondBiomeState(),
    vision: window.__centauriDebug?.getVisionState(),
    gravity: (() => {
      const debug = window.__centauriDebug;
      if (!debug) return Number.NaN;
      const sample = debug.getDiamondBiomeState().outsideSample;
      return debug.gravityMultiplierAt(sample.x, sample.z);
    })(),
  }));

  await page.evaluate(({ x, z }) => window.__centauriDebug?.setPlayer(x, z), diamond.debugSpawn);
  await page.waitForFunction(() => {
    const vision = window.__centauriDebug?.getVisionState();
    const state = window.__centauriDebug?.getDiamondBiomeState();
    return Boolean(vision && state && state.isInside && vision.targetPrismAmount > 0.25 && vision.prismAmount > 0.2);
  });
  const inside = await page.evaluate(() => ({
    biome: window.__centauriDebug?.getDiamondBiomeState(),
    vision: window.__centauriDebug?.getVisionState(),
    gravity: (() => {
      const debug = window.__centauriDebug;
      if (!debug) return Number.NaN;
      const sample = debug.getDiamondBiomeState().debugSpawn;
      return debug.gravityMultiplierAt(sample.x, sample.z);
    })(),
  }));

  expect(outside.biome?.isInside).toBe(false);
  expect(outside.gravity).toBeCloseTo(1, 2);
  expect(Number.isFinite(outside.vision?.prismAmount)).toBe(true);
  expect(outside.vision?.prismAmount).toBeLessThan(0.08);
  expect(inside.biome?.isInside).toBe(true);
  expect(inside.gravity).toBeCloseTo(0.5, 2);
  expect(Number.isFinite(inside.vision?.prismAmount)).toBe(true);
  expect(inside.vision?.prismAmount).toBeGreaterThan(0.2);
  expect((inside.vision?.prismAmount ?? 0) - (outside.vision?.prismAmount ?? 0)).toBeGreaterThan(0.15);
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
  expect(viewState.observatory.observatoryVisible).toBe(false);
  expect(viewState.observatory.cameraFov).toBeLessThan(40);
  expect(viewState.viewBlocked).toBe(false);

  await page.addStyleTag({ content: ".hud, .telescope-scope { display: none !important; }" });
  const signal = await getCanvasSignal(page, testInfo.outputPath("telescope-scoped-canvas.png"));
  expect(signal.litPixels).toBeGreaterThan(3_000);
  expect(signal.meanBrightness).toBeGreaterThan(22);
  expect(signal.variance).toBeGreaterThan(8);
});

test("radio telescope debug renders a readable three-dish array canvas", async ({ page }, testInfo) => {
  await page.goto("/?debug=radio&test=collision");
  await expect(page.getByText("radio telescope debug")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getRadioTelescopeArrayState));

  const state = await page.evaluate(() => window.__centauriDebug?.getRadioTelescopeArrayState());
  expect(state?.dishCount).toBe(3);
  expect(state?.terrainFlatness.heightVariation).toBeLessThan(2.8);

  await page.addStyleTag({ content: ".hud, .eyelids { display: none !important; }" });
  await page.waitForFunction(() => {
    const sky = window.__centauriDebug?.getSkyState();
    return Boolean(sky && sky.twilightAmount > 0.5 && sky.dayAmount < 0.7);
  });
  await page.waitForTimeout(1_200);
  const signal = await getCanvasSignal(page, testInfo.outputPath("radio-telescope-debug-canvas.png"));
  expect(signal.litPixels).toBeGreaterThan(3_000);
  expect(signal.meanBrightness).toBeGreaterThan(35);
  expect(signal.variance).toBeGreaterThan(80);
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

test("PR demo exposes patterned star clusters only in night sky", async ({ page }) => {
  await page.goto("/?demo=pr&test=collision");
  await expect(page.getByText("PR demo mode")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const daySide = await page.evaluate(() => window.__centauriDebug?.setSkyElapsed(2));
  const nightSide = await page.evaluate(() => window.__centauriDebug?.setSkyElapsed(10));

  expect(daySide?.dayAmount).toBeGreaterThan(0.75);
  expect(daySide?.patternedStarClusters).toBeGreaterThanOrEqual(30);
  expect(daySide?.patternedStarCloudBands).toBeGreaterThanOrEqual(12);
  expect(daySide?.patternedStarGlints).toBeGreaterThanOrEqual(55);
  expect(daySide?.patternedStars).toBeGreaterThanOrEqual(520);
  expect(daySide?.patternedStarNorthernFeatures).toBeGreaterThanOrEqual(220);
  expect(daySide?.patternedStarSouthernFeatures).toBeGreaterThanOrEqual(220);
  expect(daySide?.patternedStarMinLatitude).toBeLessThan(-0.8);
  expect(daySide?.patternedStarMaxLatitude).toBeGreaterThan(0.8);
  expect(daySide?.starVisibility).toBeLessThan(0.22);
  expect(nightSide?.dayAmount).toBeLessThan(0.25);
  expect(nightSide?.starVisibility).toBeGreaterThan(0.55);
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

test("starts at one massive mountain with a clear bendy summit path", async ({ page }) => {
  await page.goto("/?debug=mountain&test=collision");
  await expect(page.getByText("mountain debug")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getMassiveMountainState));
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri mountain debug hook");

    const mountain = debug.getMassiveMountainState();
    const player = debug.getPlayer();
    const lowlandHeight = debug.terrainHeightAt(0, 24);
    const normalMountainRise = mountain.normalMountainPeakHeight - lowlandHeight;
    const massiveMountainRise = mountain.peak.height - lowlandHeight;
    const sampleStates = mountain.pathSamples.map((sample) => ({
      ...sample,
      blocked: debug.isBlockedAt(sample.x, sample.z),
      slope: debug.terrainSlopeAt(sample.x, sample.z),
      slipperiness: debug.terrainSlipperinessAt(sample.x, sample.z),
      actualHeight: debug.terrainHeightAt(sample.x, sample.z),
    }));
    const steepFaceStates = mountain.steepFaceSamples.map((sample) => ({
      ...sample,
      blocked: debug.isBlockedAt(sample.x, sample.z),
      slope: debug.terrainSlopeAt(sample.x, sample.z),
      slipperiness: debug.terrainSlipperinessAt(sample.x, sample.z),
    }));
    const pathClimbChecks = sampleStates.slice(1, 7).map((sample, index) => {
      const start = sampleStates[index];
      debug.setPlayer(start.x, start.z);
      const before = debug.getPlayer();
      const segmentDistance = Math.hypot(sample.x - start.x, sample.z - start.z);
      const after = debug.attemptMove(sample.x - start.x, sample.z - start.z);
      return {
        progressDistance: Math.hypot(after.x - before.x, after.z - before.z),
        segmentDistance,
      };
    });
    const steepSlipChecks = steepFaceStates.slice(0, 4).map((sample) => {
      debug.setPlayer(sample.x, sample.z);
      const beforePlayer = debug.getPlayer();
      const beforeHeight = debug.terrainHeightAt(sample.x, sample.z);
      const uphillX = -sample.downhillX * 8;
      const uphillZ = -sample.downhillZ * 8;
      const after = debug.attemptMove(uphillX, uphillZ);
      const afterHeight = debug.terrainHeightAt(after.x, after.z);
      return {
        heightGain: afterHeight - beforeHeight,
        playerYGain: after.y - beforePlayer.y,
        uphillTravel: -((after.x - sample.x) * sample.downhillX + (after.z - sample.z) * sample.downhillZ),
      };
    });
    const pathSteps = sampleStates.slice(1).map((sample, index) => {
      const previous = sampleStates[index];
      const distance = Math.hypot(sample.x - previous.x, sample.z - previous.z);
      const heightDelta = sample.actualHeight - previous.actualHeight;
      return {
        distance,
        heightDelta,
        slope: Math.abs(heightDelta) / Math.max(distance, 0.001),
      };
    });
    const pathLength = sampleStates.slice(1).reduce((length, sample, index) => {
      const previous = sampleStates[index];
      return length + Math.hypot(sample.x - previous.x, sample.z - previous.z);
    }, 0);
    const straightDistance = Math.hypot(mountain.peak.x - mountain.base.x, mountain.peak.z - mountain.base.z);
    const turns = sampleStates.slice(2).filter((sample, index) => {
      const a = sampleStates[index];
      const b = sampleStates[index + 1];
      const ab = Math.atan2(b.z - a.z, b.x - a.x);
      const bc = Math.atan2(sample.z - b.z, sample.x - b.x);
      const turn = Math.abs((((bc - ab + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
      return turn > 0.35;
    }).length;
    debug.setPlayer(mountain.center.x, mountain.center.z);
    const summitNature = debug.getNatureState();
    const lowlandSlope = debug.terrainSlopeAt(0, 24);
    const lowlandSlipperiness = debug.terrainSlipperinessAt(0, 24);

    return {
      playerStartsAtBase: Math.hypot(player.x - mountain.base.x, player.z - mountain.base.z) < 0.5,
      playerStartsClear: !debug.isBlockedAt(player.x, player.z),
      oneReservedSummit: mountain.reservedZones.filter((zone) => Math.hypot(zone.x - mountain.center.x, zone.z - mountain.center.z) < 0.001).length,
      peakAroundThreeTimesNormal: massiveMountainRise > normalMountainRise * 2.7,
      peakAbovePathBase: mountain.peak.height > mountain.base.height + 52,
      pathHasEnoughSamples: sampleStates.length >= 10,
      pathIsClear: sampleStates.every((sample) => !sample.blocked),
      pathIsSubtlySlippery: sampleStates.every((sample) => sample.slipperiness < 0.2),
      pathSlipDoesNotMaskSteepSpikes: sampleStates.every((sample) => sample.slope < 0.55 || sample.slipperiness > 0.02),
      pathClimbsReliably: pathClimbChecks.every((check) => check.progressDistance > check.segmentDistance * 0.92),
      pathHeightsMatchTerrain: sampleStates.every((sample) => Math.abs(sample.actualHeight - sample.height) < 0.001),
      pathClimbsToPeak: sampleStates[sampleStates.length - 1].actualHeight > sampleStates[0].actualHeight + 52,
      pathHeightIsContinuous: pathSteps.every((step) => Math.abs(step.heightDelta) < 1.35 && step.slope < 0.56),
      pathIsBendy: pathLength > straightDistance * 1.18 && turns >= 3,
      generalSlopeQuerySeparatesTerrain: lowlandSlope < 0.44 && lowlandSlipperiness === 0 && steepFaceStates.every((sample) => sample.slope > lowlandSlope + 0.3),
      steepFacesAreSlippery: steepFaceStates.length >= 3 && steepFaceStates.every((sample) => !sample.blocked && sample.slipperiness > 0.25 && sample.slope > 0.44),
      steepUphillAttemptsSlip:
        steepSlipChecks.length >= 3 &&
        steepSlipChecks.every((check) => check.heightGain < 2.8 && check.playerYGain < 2.8 && (check.uphillTravel < 2.2 || check.heightGain < 0.8)),
      summitBiomeCleared: summitNature.nearestBiomePatchDistance > 120 && summitNature.generatedObstacles < 90,
    };
  });

  expect(result.playerStartsAtBase).toBe(true);
  expect(result.playerStartsClear).toBe(true);
  expect(result.oneReservedSummit).toBe(1);
  expect(result.peakAroundThreeTimesNormal).toBe(true);
  expect(result.peakAbovePathBase).toBe(true);
  expect(result.pathHasEnoughSamples).toBe(true);
  expect(result.pathIsClear).toBe(true);
  expect(result.pathIsSubtlySlippery).toBe(true);
  expect(result.pathSlipDoesNotMaskSteepSpikes).toBe(true);
  expect(result.pathClimbsReliably).toBe(true);
  expect(result.pathHeightsMatchTerrain).toBe(true);
  expect(result.pathClimbsToPeak).toBe(true);
  expect(result.pathHeightIsContinuous).toBe(true);
  expect(result.pathIsBendy).toBe(true);
  expect(result.generalSlopeQuerySeparatesTerrain).toBe(true);
  expect(result.steepFacesAreSlippery).toBe(true);
  expect(result.steepUphillAttemptsSlip).toBe(true);
  expect(result.summitBiomeCleared).toBe(true);
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
  expect(difference.changedPixels).toBeGreaterThan(700);
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
  return getScreenshotSignal(page, screenshot);
}

async function getScreenshotSignal(page: Page, screenshot: Buffer): Promise<{
  width: number;
  height: number;
  litPixels: number;
  meanBrightness: number;
  variance: number;
  signature: number;
}> {
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

async function walkForwardFor(page: Page, position: { x: number; z: number }, milliseconds: number): Promise<number> {
  await page.evaluate(({ x, z }) => window.__centauriDebug?.setPlayer(x, z), position);
  await page.focus("canvas");
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => window.__centauriDebug?.getPlayer());
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => window.__centauriDebug?.getPlayer());

  if (!before || !after) throw new Error("Missing player debug state");
  return Math.hypot(after.x - before.x, after.z - before.z);
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
