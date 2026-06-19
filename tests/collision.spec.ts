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
