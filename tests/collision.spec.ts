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
      noteDistance: Math.hypot(player.x - temple.noteX, player.z - temple.noteZ),
      noteRadius: temple.noteRadius,
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
  expect(result.noteDistance).toBeGreaterThan(result.noteRadius);
  expect(result.playerStartsClear).toBe(true);
  expect(result.templeIsBlocked).toBe(true);
  expect(result.templeIsOnLand).toBe(true);
});

test("discovers the temple field note once from the temple glyph source", async ({ page }) => {
  await page.goto("/?debug=temple");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));
  await expect(page.locator(".hud__title .hud__notes")).toBeVisible();
  await expect(page.locator(".hud > .hud__notes")).toHaveCount(0);
  await expect(page.getByText("000 / 001 recovered")).toBeVisible();

  const source = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri temple debug hook");
    const temple = debug.getTempleState();
    const notes = debug.getFieldNotesState();
    return {
      noteX: temple.noteX,
      noteZ: temple.noteZ,
      discoveredCount: notes.discoveredCount,
    };
  });

  expect(source.discoveredCount).toBe(0);

  await page.evaluate(({ noteX, noteZ }) => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri temple debug hook");
    debug.setPlayer(noteX, noteZ);
  }, source);

  await page.waitForFunction(() => window.__centauriDebug?.getFieldNotesState().discoveredCount === 1);
  await expect(page.getByText("001 / 001 recovered")).toBeVisible();
  await expect(page.getByText(/Gate in the violet stone/)).toBeVisible();

  const discovered = await page.evaluate(({ noteX, noteZ }) => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri temple debug hook");
    const first = debug.getFieldNotesState();
    debug.setPlayer(noteX, noteZ);
    const second = debug.getFieldNotesState();
    return {
      firstCount: first.discoveredCount,
      firstId: first.discovered[0]?.id,
      firstDiscoveredAt: first.discovered[0]?.discoveredAt,
      secondCount: second.discoveredCount,
      secondDiscoveredAt: second.discovered[0]?.discoveredAt,
    };
  }, source);

  expect(discovered.firstCount).toBe(1);
  expect(discovered.firstId).toBe("temple-gate");
  expect(Number.isFinite(discovered.firstDiscoveredAt)).toBe(true);
  expect(discovered.secondCount).toBe(1);
  expect(discovered.secondDiscoveredAt).toBe(discovered.firstDiscoveredAt);
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
