import { expect, test } from "@playwright/test";

test("blocks first-person movement at solid world objects", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");

    const tree = debug.obstacles.find((obstacle) => obstacle.kind === "tree");
    const rockBlocked = debug.obstacles.some((obstacle) => obstacle.kind === "rock" && debug.isBlockedAt(obstacle.x, obstacle.z));
    if (!tree || !rockBlocked) throw new Error("Missing expected tree or rock collider");

    const startZ = tree.z + tree.radius + 0.85;
    debug.setPlayer(tree.x, startZ);
    const blocked = debug.attemptMove(0, -1.5);
    const waterPassable = !debug.isBlockedAt(5.5, 7.5);
    const fieldHeight = debug.terrainHeightAt(0, -28);
    const mountainHeight = debug.terrainHeightAt(0, -74);
    debug.setPlayer(0, -74);
    const mountainPlayer = debug.getPlayer();
    const standingHeight = debug.getMovementState().cameraHeight;

    return {
      colliderCount: debug.obstacles.length,
      treeBlocked: Math.abs(blocked.z - startZ) < 0.001,
      rockBlocked,
      waterPassable,
      mountainIsTerrain: mountainHeight > fieldHeight + 7,
      mountainWalkable: !debug.isBlockedAt(0, -74),
      playerStandsOnMountain: Math.abs(mountainPlayer.y - (mountainHeight + standingHeight)) < 0.001,
    };
  });

  expect(result.colliderCount).toBeGreaterThan(150);
  expect(result.treeBlocked).toBe(true);
  expect(result.rockBlocked).toBe(true);
  expect(result.waterPassable).toBe(true);
  expect(result.mountainIsTerrain).toBe(true);
  expect(result.mountainWalkable).toBe(true);
  expect(result.playerStandsOnMountain).toBe(true);
});

test("supports grounded jump and visible crouch height changes", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");
    debug.setPlayer(0, 24);
  });

  const start = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");
    return { player: debug.getPlayer(), movement: debug.getMovementState() };
  });

  await page.keyboard.press("Space");
  await page.waitForFunction(
    (startY) => {
      const debug = window.__centauriDebug;
      return Boolean(debug && debug.getPlayer().y > startY + 0.55 && !debug.getMovementState().grounded);
    },
    start.player.y
  );

  await page.waitForFunction(() => {
    const debug = window.__centauriDebug;
    return Boolean(debug && debug.getMovementState().grounded);
  });

  await page.keyboard.down("Control");
  await page.waitForFunction(
    (standingHeight) => {
      const debug = window.__centauriDebug;
      return Boolean(debug && debug.getMovementState().cameraHeight < standingHeight - 0.45 && debug.getMovementState().crouching);
    },
    start.movement.cameraHeight
  );
  await page.keyboard.up("Control");
});

test("wraps straight walks around the spherical planet", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");

    const planet = debug.getPlanetState();
    debug.setPlayer(0, 0);
    const start = debug.getPlayer();
    const equatorEnd = debug.attemptMove(planet.circumference, 0);
    const afterEquator = debug.getPlayer();

    debug.setPlayer(0, 0);
    const meridianEnd = debug.attemptMove(0, planet.circumference);
    const afterMeridian = debug.getPlayer();
    const expectedRadius = planet.circumference / (Math.PI * 2);
    const expectedDuration = planet.circumference / planet.assumedWalkSpeed;

    return {
      radiusMath: Math.abs(planet.radius - expectedRadius),
      durationMath: Math.abs(expectedDuration - planet.targetCircumnavigationSeconds),
      equatorLocalDistance: Math.hypot(equatorEnd.x - start.x, equatorEnd.z - start.z),
      meridianLocalDistance: Math.hypot(meridianEnd.x - start.x, meridianEnd.z - start.z),
      equatorWorldDistance: Math.hypot(afterEquator.worldX - start.worldX, afterEquator.worldY - start.worldY, afterEquator.worldZ - start.worldZ),
      meridianWorldDistance: Math.hypot(afterMeridian.worldX - start.worldX, afterMeridian.worldY - start.worldY, afterMeridian.worldZ - start.worldZ),
      playerIsAbovePlanet: planet.radialDistance > planet.radius,
    };
  });

  expect(result.radiusMath).toBeLessThan(0.000001);
  expect(result.durationMath).toBeLessThan(0.000001);
  expect(result.equatorLocalDistance).toBeLessThan(0.001);
  expect(result.meridianLocalDistance).toBeLessThan(0.001);
  expect(result.equatorWorldDistance).toBeLessThan(0.001);
  expect(result.meridianWorldDistance).toBeLessThan(0.001);
  expect(result.playerIsAbovePlanet).toBe(true);
});

test("derives reversible sky and day-night variation from planet location", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");

    const planet = debug.getPlanetState();
    debug.setPlayer(0, 24);
    const start = debug.getSkyState();
    debug.setPlayer(4400, -1600);
    const distant = debug.getSkyState();
    debug.setPlayer(0, 24);
    const returned = debug.getSkyState();
    const oppositePairs = [0, planet.circumference / 4].map((x) => {
      debug.setPlayer(x, 0);
      const near = debug.getSkyState();
      debug.setPlayer(x + planet.circumference / 2, 0);
      const far = debug.getSkyState();
      return {
        near,
        far,
        dayDifference: Math.abs(near.dayAmount - far.dayAmount),
        sunDotSum: Math.abs(near.sunDot + far.sunDot),
      };
    });
    const strongestOppositePair = oppositePairs.reduce((best, pair) => (pair.dayDifference > best.dayDifference ? pair : best));

    return { start, distant, returned, strongestOppositePair };
  });

  expect(Math.abs(result.distant.celestialYaw - result.start.celestialYaw)).toBeGreaterThan(0.04);
  expect(Math.abs(result.distant.celestialAltitude - result.start.celestialAltitude)).toBeGreaterThan(0.08);
  expect(Math.abs(result.distant.ringAltitude - result.start.ringAltitude)).toBeGreaterThan(0.08);
  expect(Math.hypot(result.distant.localUpX - result.start.localUpX, result.distant.localUpY - result.start.localUpY, result.distant.localUpZ - result.start.localUpZ)).toBeGreaterThan(0.6);
  expect(Math.abs(result.distant.ringSpinOffset - result.start.ringSpinOffset)).toBeGreaterThan(0.08);
  expect(result.distant.dayHorizonHex).not.toBe(result.start.dayHorizonHex);
  expect(result.strongestOppositePair.dayDifference).toBeGreaterThan(0.6);
  expect(result.strongestOppositePair.sunDotSum).toBeLessThan(0.001);
  expect(result.returned.celestialYaw).toBeCloseTo(result.start.celestialYaw, 7);
  expect(result.returned.celestialAltitude).toBeCloseTo(result.start.celestialAltitude, 7);
  expect(result.returned.ringTilt).toBeCloseTo(result.start.ringTilt, 7);
  expect(result.returned.ringAltitude).toBeCloseTo(result.start.ringAltitude, 7);
  expect(result.returned.dayAmount).toBeCloseTo(result.start.dayAmount, 7);
  expect(result.returned.sunDot).toBeCloseTo(result.start.sunDot, 7);
  expect(result.returned.localUpX).toBeCloseTo(result.start.localUpX, 7);
  expect(result.returned.localUpY).toBeCloseTo(result.start.localUpY, 7);
  expect(result.returned.localUpZ).toBeCloseTo(result.start.localUpZ, 7);
  expect(result.returned.dayHorizonHex).toBe(result.start.dayHorizonHex);
  expect(result.returned.nightHorizonHex).toBe(result.start.nightHorizonHex);
});

test("keeps chunked spherical terrain under the player beyond the starting field", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");

    debug.setPlayer(0, 24);
    const spawnNature = debug.getNatureState();
    const spawnIsClear = !debug.isBlockedAt(0, 24);
    debug.setPlayer(420, -360);
    const player = debug.getPlayer();
    const terrain = debug.getTerrainState();
    const nature = debug.getNatureState();
    const standingHeight = debug.getMovementState().cameraHeight;
    const sampledHeight = debug.terrainHeightAt(player.x, player.z);
    debug.setPlayer(470, -390);
    const movedTerrain = debug.getTerrainState();
    const movedNature = debug.getNatureState();

    const isAlignedToCellGrid = (value: number, cellSize: number): boolean => {
      const cells = value / cellSize;
      return Math.abs(cells - Math.round(cells)) < 0.000001;
    };

    return {
      terrainWindowContainsPlayer: player.x > terrain.minX + terrain.chunkSize && player.x < terrain.maxX - terrain.chunkSize && player.z > terrain.minZ + terrain.chunkSize && player.z < terrain.maxZ - terrain.chunkSize,
      playerAltitudeMatchesTerrain: Math.abs(player.y - (sampledHeight + standingHeight)) < 0.001,
      outsideOldPlane: Math.hypot(player.x, player.z) > 220,
      terrainGridAligned:
        isAlignedToCellGrid(terrain.minX, terrain.cellSize) &&
        isAlignedToCellGrid(terrain.minZ, terrain.cellSize) &&
        isAlignedToCellGrid(terrain.maxX, terrain.cellSize) &&
        isAlignedToCellGrid(terrain.maxZ, terrain.cellSize) &&
        isAlignedToCellGrid(movedTerrain.minX, movedTerrain.cellSize) &&
        isAlignedToCellGrid(movedTerrain.minZ, movedTerrain.cellSize) &&
        isAlignedToCellGrid(movedTerrain.maxX, movedTerrain.cellSize) &&
        isAlignedToCellGrid(movedTerrain.maxZ, movedTerrain.cellSize),
      terrainMovedByWholeCells:
        isAlignedToCellGrid(movedTerrain.minX - terrain.minX, terrain.cellSize) &&
        isAlignedToCellGrid(movedTerrain.minZ - terrain.minZ, terrain.cellSize),
      hasChunkedSurface: terrain.chunkCount > 1,
      generatedNatureAwayFromStart:
        nature.generatedObjects > 380 &&
        nature.generatedObjects < 620 &&
        nature.generatedReactiveFlora > 160 &&
        nature.generatedObstacles > 90 &&
        nature.generatedBiomePatches >= 6 &&
        movedNature.generatedObjects > 380 &&
        movedNature.generatedObjects < 620 &&
        debug.obstacles.some((obstacle) => obstacle.dynamic),
      generatedSpawnNature:
        spawnNature.generatedObjects > 380 &&
        spawnNature.generatedObjects < 620 &&
        spawnNature.generatedReactiveFlora > 160 &&
        spawnNature.generatedObstacles > 90 &&
        spawnNature.generatedBiomePatches >= 6,
      spawnStartsInDenseBiome:
        spawnIsClear &&
        spawnNature.nearestBiomePatchDistance < 32 &&
        spawnNature.fullDetailBiomePatches > 0,
      complexDetailIsDistanceCapped:
        nature.complexDetailRadius < nature.complexFadeRadius &&
        nature.complexFadeRadius <= nature.chunkSize * 3.1,
      spawnAndRemoteDensitySimilar:
        nature.generatedObjects / spawnNature.generatedObjects > 0.72 &&
        nature.generatedObjects / spawnNature.generatedObjects < 1.38,
    };
  });

  expect(result.terrainWindowContainsPlayer).toBe(true);
  expect(result.playerAltitudeMatchesTerrain).toBe(true);
  expect(result.outsideOldPlane).toBe(true);
  expect(result.terrainGridAligned).toBe(true);
  expect(result.terrainMovedByWholeCells).toBe(true);
  expect(result.hasChunkedSurface).toBe(true);
  expect(result.generatedNatureAwayFromStart).toBe(true);
  expect(result.generatedSpawnNature).toBe(true);
  expect(result.spawnStartsInDenseBiome).toBe(true);
  expect(result.complexDetailIsDistanceCapped).toBe(true);
  expect(result.spawnAndRemoteDensitySimilar).toBe(true);
});

test("generates reactive seaweed only in sparse flat wilderness", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const spawnState = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri debug hook");
    debug.setPlayer(0, 24);
    return debug.getNatureState();
  });

  expect(spawnState.nearestBiomePatchDistance).toBeLessThan(32);
  expect(spawnState.nearestSeaweedDistance).toBeGreaterThan(50);
  expect(spawnState.seaweedSamples.every((sample) => sample.nearestBiomeEdgeDistance >= 38)).toBe(true);

  await page.evaluate(() => window.__centauriDebug?.setPlayer(-128, -464));
  await page.waitForFunction(() => {
    const state = window.__centauriDebug?.getNatureState();
    return Boolean(state && state.nearestBiomePatchDistance > 150 && state.generatedSeaweedPatches > 8 && state.seaweedSamples.length > 0);
  });

  const wildernessState = await page.evaluate(() => window.__centauriDebug?.getNatureState());
  expect(wildernessState?.generatedSeaweedPatches).toBeGreaterThan(8);
  expect(wildernessState?.generatedSeaweedBlades).toBeGreaterThan(50);
  expect(wildernessState?.seaweedSamples.every((sample) => sample.nearestBiomeEdgeDistance >= 38)).toBe(true);
  expect(wildernessState?.seaweedSamples.every((sample) => sample.flatness <= 0.72)).toBe(true);

  const seaweed = wildernessState?.seaweedSamples.find((sample) => sample.x > 20 && sample.x < 30 && sample.z > -620 && sample.z < -608);
  expect(seaweed).toBeTruthy();
  expect(seaweed?.bladeCount).toBeGreaterThanOrEqual(5);

  await page.evaluate((sample) => window.__centauriDebug?.setPlayer(sample.x + 22, sample.z), seaweed);
  await page.waitForFunction(() => {
    const state = window.__centauriDebug?.getNatureState();
    return Boolean(state && state.nearestSeaweedDistance > 16 && state.nearestSeaweedFreezeAmount < 0.08);
  });
  const farSeaweedState = await page.evaluate(() => window.__centauriDebug?.getNatureState());

  await page.evaluate((sample) => window.__centauriDebug?.setPlayer(sample.x + 1.5, sample.z + 1.5), seaweed);
  await page.waitForFunction(() => {
    const state = window.__centauriDebug?.getNatureState();
    return Boolean(state && state.nearestSeaweedDistance < 7 && state.nearestSeaweedFreezeAmount > 0.72);
  });
  const nearSeaweedState = await page.evaluate(() => window.__centauriDebug?.getNatureState());

  expect(farSeaweedState?.nearestSeaweedDistance).toBeGreaterThan(16);
  expect(farSeaweedState?.nearestSeaweedFreezeAmount).toBeLessThan(0.08);
  expect(nearSeaweedState?.nearestSeaweedDistance).toBeLessThan(7);
  expect(nearSeaweedState?.nearestSeaweedFreezeAmount).toBeGreaterThan(0.72);
});

test("starts temple debug route near the single temple landmark", async ({ page }) => {
  await page.goto("/?debug=temple");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri temple debug hook");

    const player = debug.getPlayer();
    const temple = debug.getTempleState();
    const templeObstacleCount = debug.obstacles.filter((obstacle) => obstacle.kind === "temple").length;
    const dx = player.x - temple.x;
    const dz = player.z - temple.z;
    const approachDistance = Math.hypot(dx, dz);

    return {
      templeObstacleCount,
      approachDistance,
      influenceRadius: temple.influenceRadius,
      fullInfluenceRadius: temple.fullInfluenceRadius,
      playerStartsClear: !debug.isBlockedAt(player.x, player.z),
      templeIsBlocked: debug.isBlockedAt(temple.x, temple.z),
      templeIsOnLand: debug.terrainHeightAt(temple.x, temple.z) > 0.25,
    };
  });

  expect(result.templeObstacleCount).toBe(1);
  expect(result.approachDistance).toBeLessThan(result.influenceRadius);
  expect(result.approachDistance).toBeGreaterThan(result.fullInfluenceRadius);
  expect(result.playerStartsClear).toBe(true);
  expect(result.templeIsBlocked).toBe(true);
  expect(result.templeIsOnLand).toBe(true);
});

test("uses pointer lock for continuous mouse-look and releases cleanly", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));
  await expect(page.getByText("click to lock")).toBeVisible();

  await page.mouse.move(400, 300);
  await page.mouse.click(400, 300);
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await expect(page.getByText("mouse locked")).toBeVisible();

  const start = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");
    return debug.getViewState();
  });

  await page.evaluate(() => {
    document.dispatchEvent(new MouseEvent("mousemove", { movementX: 120, movementY: 60 }));
  });
  const looked = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");
    return debug.getViewState();
  });

  expect(looked.mouseLookActive).toBe(true);
  expect(Math.abs(looked.yaw - start.yaw)).toBeGreaterThan(0.05);
  expect(Math.abs(looked.pitch - start.pitch)).toBeGreaterThan(0.02);

  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("Missing Centauri canvas");
    canvas.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForFunction(() => document.pointerLockElement === null);
  await expect(page.getByText("click to lock")).toBeVisible();
  const released = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");
    return debug.getViewState();
  });

  await page.mouse.move(680, 420, { steps: 2 });
  const afterReleasedMove = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");
    return debug.getViewState();
  });

  expect(afterReleasedMove.mouseLookActive).toBe(false);
  expect(afterReleasedMove.yaw).toBeCloseTo(released.yaw, 5);
  expect(afterReleasedMove.pitch).toBeCloseTo(released.pitch, 5);
});
