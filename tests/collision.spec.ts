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

test("keeps fleeing water creatures clear of solid obstacles", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");
    debug.setPlayer(6.8, 8.2);
  });
  await page.waitForTimeout(1_800);

  const creatureState = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");
    return debug.getCreatureState();
  });

  expect(creatureState.total).toBe(5);
  expect(creatureState.activeHops).toBeGreaterThan(0);
  expect(creatureState.nearestObstacleClearance).toBeGreaterThan(0.1);
});

test("lets scared water creatures flee beyond the old water leash", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const observed = { maxDistanceFromWater: 0, minScaredHopDistance: Number.POSITIVE_INFINITY };
  for (let chaseStep = 0; chaseStep < 7; chaseStep += 1) {
    await page.evaluate(() => {
      const debug = window.__centauriDebug;
      if (!debug) throw new Error("Missing Centauri collision debug hook");
      const state = debug.getCreatureState();
      const frog = state.creatures.reduce((farthest, candidate) =>
        candidate.distanceFromWater > farthest.distanceFromWater ? candidate : farthest
      );
      const dx = frog.x - frog.anchorX;
      const dz = frog.z - frog.anchorZ;
      const distance = Math.hypot(dx, dz) || 1;
      debug.setPlayer(frog.x - (dx / distance) * 2.15, frog.z - (dz / distance) * 2.15);
    });
    await page.waitForTimeout(1_150);

    const state = await page.evaluate(() => {
      const debug = window.__centauriDebug;
      if (!debug) throw new Error("Missing Centauri collision debug hook");
      return debug.getCreatureState();
    });
    observed.maxDistanceFromWater = Math.max(observed.maxDistanceFromWater, state.maxDistanceFromWater);
    if (state.scaredHops > 0) observed.minScaredHopDistance = Math.min(observed.minScaredHopDistance, state.minScaredHopDistance);
  }

  expect(observed.maxDistanceFromWater).toBeGreaterThan(6.4);
  expect(observed.minScaredHopDistance).toBeGreaterThan(0.4);
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

test("clears shortcut-stale crouch keys so jump works after tab return", async ({ page }) => {
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
    return debug.getPlayer();
  });

  await page.keyboard.down("Control");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.keyboard.press("Space");
  await page.keyboard.up("Control");

  await page.waitForFunction(
    (startY) => {
      const debug = window.__centauriDebug;
      return Boolean(debug && debug.getPlayer().y > startY + 0.55 && !debug.getMovementState().grounded);
    },
    start.y
  );
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

test("moves celestial bodies over time at a fixed planet location", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");

    const angularDistance = (a: number, b: number): number => {
      const fullTurn = Math.PI * 2;
      return Math.abs((((a - b + Math.PI) % fullTurn) + fullTurn) % fullTurn - Math.PI);
    };

    debug.setPlayer(0, 24);
    const start = debug.setSkyElapsed(0);
    const later = debug.setSkyElapsed(48);
    const returned = debug.setSkyElapsed(0);

    return {
      start,
      later,
      returned,
      celestialYawDelta: angularDistance(later.celestialYaw, start.celestialYaw),
      celestialAltitudeDelta: Math.abs(later.celestialAltitude - start.celestialAltitude),
      ringAltitudeDelta: Math.abs(later.ringAltitude - start.ringAltitude),
      dayAmountDelta: Math.abs(later.dayAmount - start.dayAmount),
      spinPhaseDelta: angularDistance(later.planetSpinPhase, start.planetSpinPhase),
    };
  });

  expect(result.spinPhaseDelta).toBeCloseTo(Math.PI, 6);
  expect(result.celestialYawDelta).toBeGreaterThan(0.35);
  expect(result.celestialAltitudeDelta).toBeGreaterThan(0.16);
  expect(result.ringAltitudeDelta).toBeGreaterThan(0.16);
  expect(result.dayAmountDelta).toBeGreaterThan(0.25);
  expect(result.returned.celestialYaw).toBeCloseTo(result.start.celestialYaw, 7);
  expect(result.returned.celestialAltitude).toBeCloseTo(result.start.celestialAltitude, 7);
  expect(result.returned.ringTilt).toBeCloseTo(result.start.ringTilt, 7);
  expect(result.returned.ringAltitude).toBeCloseTo(result.start.ringAltitude, 7);
  expect(result.returned.dayAmount).toBeCloseTo(result.start.dayAmount, 7);
  expect(result.returned.sunDot).toBeCloseTo(result.start.sunDot, 7);
});

test("derives reversible sky and day-night variation from planet location at a fixed time", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");

    const planet = debug.getPlanetState();
    const sampleTime = 9;
    debug.setPlayer(0, 24);
    const start = debug.setSkyElapsed(sampleTime);
    debug.setPlayer(4400, -1600);
    const distant = debug.setSkyElapsed(sampleTime);
    debug.setPlayer(0, 24);
    const returned = debug.setSkyElapsed(sampleTime);
    const oppositePairs = [0, planet.circumference / 4].map((x) => {
      debug.setPlayer(x, 0);
      const near = debug.setSkyElapsed(sampleTime);
      debug.setPlayer(x + planet.circumference / 2, 0);
      const far = debug.setSkyElapsed(sampleTime);
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
    debug.setPlayer(-420, 360);
    const player = debug.getPlayer();
    const terrain = debug.getTerrainState();
    const nature = debug.getNatureState();
    const standingHeight = debug.getMovementState().cameraHeight;
    const sampledHeight = debug.terrainHeightAt(player.x, player.z);
    debug.setPlayer(-470, 390);
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
    return Boolean(state && state.nearestBiomePatchDistance > 150 && state.generatedSeaweedPatches > 12 && state.seaweedSamples.length > 0);
  });

  const wildernessState = await page.evaluate(() => window.__centauriDebug?.getNatureState());
  expect(wildernessState?.generatedSeaweedPatches).toBeGreaterThan(12);
  expect(wildernessState?.generatedSeaweedBlades).toBeGreaterThan(90);
  expect(wildernessState?.seaweedSamples.every((sample) => sample.nearestBiomeEdgeDistance >= 38)).toBe(true);
  expect(wildernessState?.seaweedSamples.every((sample) => sample.flatness <= 0.72)).toBe(true);
  expect(wildernessState?.seaweedSamples.every((sample) => sample.staticBend >= 0.08)).toBe(true);

  const seaweed = wildernessState?.seaweedSamples.find((sample) => sample.x > 20 && sample.x < 30 && sample.z > -620 && sample.z < -608);
  expect(seaweed).toBeTruthy();
  expect(seaweed?.bladeCount).toBeGreaterThanOrEqual(6);
  expect(seaweed?.staticBend).toBeGreaterThan(0.1);

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

test("culls far mist patches in normal debug walking views", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getMistState));

  const states = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri mist debug hook");

    const samples = [
      { x: 0, z: 24 },
      { x: 0, z: -74 },
      { x: 420, z: -360 },
    ];

    return samples.map((sample) => {
      debug.setPlayer(sample.x, sample.z);
      return debug.getMistState();
    });
  });

  expect(states.every((state) => state.visiblePatches > 0)).toBe(true);
  expect(states.every((state) => state.farDistance >= state.hardCullDistance)).toBe(true);
  expect(states.every((state) => state.farVisiblePatches === 0)).toBe(true);
  expect(states.every((state) => state.farMaxAlpha === 0)).toBe(true);
});

test("keeps nearby mist patch identity stable across chunk boundaries", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getMistState));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri mist debug hook");

    debug.setPlayer(86, 24);
    const before = debug.getMistState();
    debug.setPlayer(98, 24);
    const after = debug.getMistState();
    const beforeByKey = new Map(before.visibleSamples.map((sample) => [sample.key, sample]));
    const retained: { key: string; shift: number }[] = [];
    after.visibleSamples.forEach((afterSample) => {
      const beforeSample = beforeByKey.get(afterSample.key);
      if (!beforeSample) return;

      retained.push({
        key: afterSample.key,
        shift: Math.hypot(afterSample.x - beforeSample.x, afterSample.z - beforeSample.z),
      });
    });

    return {
      beforeVisible: before.visiblePatches,
      afterVisible: after.visiblePatches,
      retained,
    };
  });

  expect(result.beforeVisible).toBeGreaterThan(0);
  expect(result.afterVisible).toBeGreaterThan(0);
  expect(result.retained.length).toBeGreaterThan(0);
  expect(result.retained.every((sample) => sample.shift < 0.001)).toBe(true);
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
  await expect(page.getByText("Field Note 001")).toBeVisible();
  await expect(page.getByText(/Unknown planet/)).toBeVisible();
  await expect(page.getByText(/recovered/)).toHaveCount(0);

  const source = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri temple debug hook");
    const temple = debug.getTempleState();
    const notes = debug.getFieldNotesState();
    return {
      noteX: temple.noteX,
      noteZ: temple.noteZ,
      discoveredCount: notes.discoveredCount,
      currentIndex: notes.current.index,
    };
  });

  expect(source.discoveredCount).toBe(0);
  expect(source.currentIndex).toBe(1);

  await page.evaluate(({ noteX, noteZ }) => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri temple debug hook");
    debug.setPlayer(noteX, noteZ);
  }, source);

  await page.waitForFunction(() => window.__centauriDebug?.getFieldNotesState().discoveredCount === 1);
  await expect(page.getByText("Field Note 002")).toBeVisible();
  await expect(page.getByText(/Gate in the violet stone/)).toBeVisible();
  await expect(page.getByText(/Unknown planet/)).toHaveCount(0);
  await expect(page.getByText(/recovered/)).toHaveCount(0);

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
      firstCurrentIndex: first.current.index,
      secondCount: second.discoveredCount,
      secondDiscoveredAt: second.discovered[0]?.discoveredAt,
    };
  }, source);

  expect(discovered.firstCount).toBe(1);
  expect(discovered.firstId).toBe("temple-gate");
  expect(Number.isFinite(discovered.firstDiscoveredAt)).toBe(true);
  expect(discovered.firstCurrentIndex).toBe(2);
  expect(discovered.secondCount).toBe(1);
  expect(discovered.secondDiscoveredAt).toBe(discovered.firstDiscoveredAt);

  await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri temple debug hook");
    const dome = debug.getDomeState();
    debug.setPlayer(dome.noteX, dome.noteZ);
  });
  await page.waitForFunction(() => window.__centauriDebug?.getFieldNotesState().discoveredCount === 2);
  const afterDome = await page.evaluate(() => window.__centauriDebug?.getFieldNotesState());

  expect(afterDome?.discoveredCount).toBe(2);
  expect(afterDome?.discovered[0]?.id).toBe("temple-gate");
  expect(afterDome?.discovered[0]?.index).toBe(2);
  expect(afterDome?.discovered[1]?.id).toBe("dome-chronoglass");
  expect(afterDome?.discovered[1]?.index).toBe(3);
  expect(afterDome?.current.index).toBe(3);
});

test("creates one large glass dome with a passable entrance and blocking shell", async ({ page }) => {
  await page.goto("/?debug=dome");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));
  await expect(page.getByText("dome debug")).toBeVisible();

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri dome debug hook");
    const dome = debug.getDomeState();
    const planet = debug.getPlanetState();
    const player = debug.getPlayer();
    const shellCount = debug.obstacles.filter((obstacle) => obstacle.kind === "dome-shell").length;
    const circumferenceSeconds = (Math.PI * 2 * dome.radius) / planet.assumedWalkSpeed;
    const sideX = dome.x + dome.entranceDirectionZ * (dome.radius + 2.5);
    const sideZ = dome.z - dome.entranceDirectionX * (dome.radius + 2.5);

    return {
      shellCount,
      radius: dome.radius,
      circumferenceSeconds,
      approachDistance: Math.hypot(player.x - dome.x, player.z - dome.z),
      playerStartsClear: !debug.isBlockedAt(player.x, player.z),
      centerClear: !debug.isBlockedAt(dome.x, dome.z),
      entranceClear: !debug.isBlockedAt(dome.entranceX, dome.entranceZ),
      sideBlocked: debug.isBlockedAt(sideX, sideZ),
      onLand: debug.terrainHeightAt(dome.x, dome.z) > 0.25,
      viewYaw: debug.getViewState().yaw,
      expectedViewYaw: Math.atan2(-dome.entranceDirectionX, -dome.entranceDirectionZ),
    };
  });

  expect(result.shellCount).toBe(1);
  expect(result.radius).toBeGreaterThan(58);
  expect(result.radius).toBeLessThan(64);
  expect(result.circumferenceSeconds).toBeGreaterThan(57);
  expect(result.circumferenceSeconds).toBeLessThan(63);
  expect(result.approachDistance).toBeGreaterThan(result.radius);
  expect(result.playerStartsClear).toBe(true);
  expect(result.centerClear).toBe(true);
  expect(result.entranceClear).toBe(true);
  expect(result.sideBlocked).toBe(true);
  expect(result.onLand).toBe(true);
  expect(result.viewYaw).toBeCloseTo(result.expectedViewYaw, 5);
});

test("allows entering the glass dome only through its entrance", async ({ page }) => {
  await page.goto("/?debug=dome");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri dome debug hook");
    const dome = debug.getDomeState();
    const entranceStartX = dome.x + dome.entranceDirectionX * (dome.radius + 9);
    const entranceStartZ = dome.z + dome.entranceDirectionZ * (dome.radius + 9);
    debug.setPlayer(entranceStartX, entranceStartZ);
    const throughEntrance = debug.attemptMove(-dome.entranceDirectionX * 19, -dome.entranceDirectionZ * 19);
    const afterEntrance = debug.getDomeState();

    const sideX = dome.x + dome.entranceDirectionZ * (dome.radius + 4);
    const sideZ = dome.z - dome.entranceDirectionX * (dome.radius + 4);
    debug.setPlayer(sideX, sideZ);
    const blockedSide = debug.attemptMove(-dome.entranceDirectionZ * 3, dome.entranceDirectionX * 3);
    const sideTravel = Math.hypot(blockedSide.x - sideX, blockedSide.z - sideZ);

    return {
      entranceTravel: Math.hypot(throughEntrance.x - entranceStartX, throughEntrance.z - entranceStartZ),
      insideAfterEntrance: afterEntrance.inside,
      entranceClearance: afterEntrance.entranceClearance,
      sideTravel,
      sideStillOutside: !debug.getDomeState().inside,
    };
  });

  expect(result.entranceTravel).toBeGreaterThan(14);
  expect(result.insideAfterEntrance).toBe(true);
  expect(result.entranceClearance).toBeGreaterThan(0);
  expect(result.sideTravel).toBeLessThan(1.2);
  expect(result.sideStillOutside).toBe(true);
});

test("blends the sky time multiplier up inside the dome and back down outside", async ({ page }) => {
  await page.goto("/?debug=dome");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const positions = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri dome debug hook");
    const dome = debug.getDomeState();
    return {
      insideX: dome.x + dome.entranceDirectionX * (dome.radius - 12),
      insideZ: dome.z + dome.entranceDirectionZ * (dome.radius - 12),
      outsideX: dome.approachX,
      outsideZ: dome.approachZ,
    };
  });

  await page.evaluate(({ insideX, insideZ }) => window.__centauriDebug?.setPlayer(insideX, insideZ), positions);
  await page.waitForFunction(() => (window.__centauriDebug?.getDomeState().timeMultiplier ?? 1) > 3.4);
  const inside = await page.evaluate(() => window.__centauriDebug?.getDomeState());

  await page.evaluate(({ outsideX, outsideZ }) => window.__centauriDebug?.setPlayer(outsideX, outsideZ), positions);
  await page.waitForFunction(() => (window.__centauriDebug?.getDomeState().timeMultiplier ?? 4) < 1.25);
  const outside = await page.evaluate(() => window.__centauriDebug?.getDomeState());

  expect(inside?.inside).toBe(true);
  expect(inside?.targetTimeMultiplier).toBe(4);
  expect(inside?.timeMultiplier).toBeGreaterThan(3.4);
  expect(outside?.inside).toBe(false);
  expect(outside?.targetTimeMultiplier).toBe(1);
  expect(outside?.timeMultiplier).toBeLessThan(1.25);
});

test("uses one flat effective terrain surface inside the glass dome", async ({ page }) => {
  await page.goto("/?debug=dome");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri dome debug hook");
    const dome = debug.getDomeState();
    const perp = { x: dome.entranceDirectionZ, z: -dome.entranceDirectionX };
    const offsets = [
      { x: 0, z: 0 },
      { x: dome.entranceDirectionX * dome.interiorRadius * 0.48, z: dome.entranceDirectionZ * dome.interiorRadius * 0.48 },
      { x: -dome.entranceDirectionX * dome.interiorRadius * 0.36, z: -dome.entranceDirectionZ * dome.interiorRadius * 0.36 },
      { x: perp.x * dome.interiorRadius * 0.42, z: perp.z * dome.interiorRadius * 0.42 },
      { x: -perp.x * dome.interiorRadius * 0.42, z: -perp.z * dome.interiorRadius * 0.42 },
    ];
    const heights = offsets.map((offset) => debug.terrainHeightAt(dome.x + offset.x, dome.z + offset.z));
    const remoteHeight = debug.terrainHeightAt(dome.approachX, dome.approachZ);
    const standPoint = offsets[1];
    debug.setPlayer(dome.x + standPoint.x, dome.z + standPoint.z);
    const player = debug.getPlayer();
    const movement = debug.getMovementState();
    const standingHeight = debug.terrainHeightAt(player.x, player.z) + movement.cameraHeight;

    return {
      floorHeight: dome.floorHeight,
      heights,
      maxHeightDelta: Math.max(...heights) - Math.min(...heights),
      differsFromOutside: Math.abs(remoteHeight - dome.floorHeight),
      playerHeightDelta: Math.abs(player.y - standingHeight),
      inside: debug.getDomeState().inside,
    };
  });

  expect(result.maxHeightDelta).toBeLessThan(0.001);
  expect(result.heights.every((height) => Math.abs(height - result.floorHeight) < 0.001)).toBe(true);
  expect(result.differsFromOutside).toBeGreaterThan(0.5);
  expect(result.playerHeightDelta).toBeLessThan(0.001);
  expect(result.inside).toBe(true);
});

test("grounds the glass dome rim with a full circumference terrain collar", async ({ page }) => {
  await page.goto("/?debug=dome");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri dome debug hook");
    const dome = debug.getDomeState();
    const sectors = [
      { x: dome.entranceDirectionZ, z: -dome.entranceDirectionX },
      { x: -dome.entranceDirectionX, z: -dome.entranceDirectionZ },
      { x: -dome.entranceDirectionZ, z: dome.entranceDirectionX },
    ];
    const sectorSamples = sectors.map((direction) => {
      const distances: number[] = [];
      for (let distance = dome.groundingOuterRadius; distance >= dome.interiorRadius + 0.5; distance -= 1) {
        distances.push(distance);
      }
      const rimHeights = distances.map((distance) => debug.terrainHeightAt(dome.x + direction.x * distance, dome.z + direction.z * distance));
      const adjacentJumps = rimHeights.slice(1).map((height, index) => Math.abs(height - rimHeights[index]));
      return {
        rimHeights,
        maxJump: Math.max(...adjacentJumps),
        innerFloorDelta: Math.abs(rimHeights[rimHeights.length - 1] - dome.floorHeight),
      };
    });

    return {
      radius: dome.radius,
      groundingBandWidth: dome.groundingBandWidth,
      groundingFlatRadius: dome.groundingFlatRadius,
      groundingOuterRadius: dome.groundingOuterRadius,
      sectorSamples,
    };
  });

  expect(result.groundingBandWidth).toBeGreaterThan(8);
  expect(result.groundingFlatRadius).toBeGreaterThan(result.radius);
  expect(result.groundingFlatRadius).toBeLessThan(result.groundingOuterRadius);
  expect(result.groundingOuterRadius).toBeCloseTo(result.radius + result.groundingBandWidth, 5);
  expect(result.sectorSamples.every((sample) => sample.maxJump < 1.2)).toBe(true);
  expect(result.sectorSamples.every((sample) => sample.innerFloorDelta < 0.18)).toBe(true);
});

test("keeps the glass dome entrance sill flush with the effective ramp", async ({ page }) => {
  await page.goto("/?debug=dome");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri dome debug hook");
    const dome = debug.getDomeState();
    const perp = { x: dome.entranceDirectionZ, z: -dome.entranceDirectionX };
    const offsets = [-dome.entranceHalfWidth * 0.72, 0, dome.entranceHalfWidth * 0.72];
    const samples = offsets.map((offset) => {
      const x = dome.x + dome.entranceDirectionX * dome.radius + perp.x * offset;
      const z = dome.z + dome.entranceDirectionZ * dome.radius + perp.z * offset;
      const terrainHeight = debug.terrainHeightAt(x, z);
      return {
        terrainDelta: Math.abs(terrainHeight - dome.floorHeight),
        raisedSillDelta: dome.floorHeight + dome.entranceSillTopHeight - terrainHeight,
      };
    });

    return {
      entranceSillTopHeight: dome.entranceSillTopHeight,
      samples,
    };
  });

  expect(result.entranceSillTopHeight).toBeLessThan(0.01);
  expect(result.samples.every((sample) => sample.terrainDelta < 0.001)).toBe(true);
  expect(result.samples.every((sample) => Math.abs(sample.raisedSillDelta) < 0.01)).toBe(true);
});

test("keeps visual ring and collar gaps clear of the glass dome doorway", async ({ page }) => {
  await page.goto("/?debug=dome");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri dome debug hook");
    const dome = debug.getDomeState();

    return {
      entranceHalfWidth: dome.entranceHalfWidth,
      visualEntranceGapHalfWidth: dome.visualEntranceGapHalfWidth,
      visualRingGapHalfWidth: dome.visualRingGapHalfWidth,
      baseCollarGapHalfWidth: dome.baseCollarGapHalfWidth,
    };
  });

  expect(result.visualEntranceGapHalfWidth).toBeGreaterThan(result.entranceHalfWidth + 1);
  expect(result.visualRingGapHalfWidth).toBeGreaterThan(result.entranceHalfWidth + 1);
  expect(result.baseCollarGapHalfWidth).toBeGreaterThan(result.entranceHalfWidth + 1);
});

test("ramps the glass dome entrance floor without sharp height pops", async ({ page }) => {
  await page.goto("/?debug=dome");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri dome debug hook");
    const dome = debug.getDomeState();
    const samples: number[] = [];
    for (let offset = dome.radius + 10; offset >= dome.interiorRadius - 12; offset -= 1) {
      const x = dome.x + dome.entranceDirectionX * offset;
      const z = dome.z + dome.entranceDirectionZ * offset;
      samples.push(debug.terrainHeightAt(x, z));
    }
    const adjacentTerrainJumps = samples.slice(1).map((height, index) => Math.abs(height - samples[index]));

    const startX = dome.x + dome.entranceDirectionX * (dome.radius + 10);
    const startZ = dome.z + dome.entranceDirectionZ * (dome.radius + 10);
    debug.setPlayer(startX, startZ);
    const playerHeights: number[] = [debug.getPlayer().y];
    for (let i = 0; i < 32; i += 1) {
      debug.attemptMove(-dome.entranceDirectionX, -dome.entranceDirectionZ);
      playerHeights.push(debug.getPlayer().y);
    }
    const adjacentPlayerJumps = playerHeights.slice(1).map((height, index) => Math.abs(height - playerHeights[index]));

    return {
      startHeight: samples[0],
      endHeight: samples[samples.length - 1],
      floorHeight: dome.floorHeight,
      maxTerrainJump: Math.max(...adjacentTerrainJumps),
      maxPlayerJump: Math.max(...adjacentPlayerJumps),
      insideAfterWalk: debug.getDomeState().inside,
    };
  });

  expect(Math.abs(result.endHeight - result.floorHeight)).toBeLessThan(0.001);
  expect(result.endHeight - result.startHeight).toBeGreaterThan(1.5);
  expect(result.maxTerrainJump).toBeLessThan(0.95);
  expect(result.maxPlayerJump).toBeLessThan(0.85);
  expect(result.insideAfterWalk).toBe(true);
});

test("discovers the dome field note as the next collected note from the entrance marker", async ({ page }) => {
  await page.goto("/?debug=dome");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));
  await expect(page.getByText("Field Note 001")).toBeVisible();

  const source = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri dome debug hook");
    const dome = debug.getDomeState();
    const notes = debug.getFieldNotesState();
    return {
      noteX: dome.noteX,
      noteZ: dome.noteZ,
      noteRadius: dome.noteRadius,
      discoveredCount: notes.discoveredCount,
      total: notes.total,
    };
  });

  expect(source.discoveredCount).toBe(0);
  expect(source.total).toBe(5);
  expect(source.noteRadius).toBeGreaterThan(6);

  await page.evaluate(({ noteX, noteZ }) => window.__centauriDebug?.setPlayer(noteX, noteZ), source);
  await page.waitForFunction(() => window.__centauriDebug?.getFieldNotesState().discoveredCount === 1);
  await expect(page.getByText("Field Note 002")).toBeVisible();
  await expect(page.getByText(/Glass weather over bare ground/)).toBeVisible();
  await expect(page.getByText(/recovered/)).toHaveCount(0);

  const firstDiscovered = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri dome debug hook");
    return debug.getFieldNotesState();
  });
  expect(firstDiscovered.discovered[0]?.id).toBe("dome-chronoglass");
  expect(firstDiscovered.discovered[0]?.index).toBe(2);
  expect(firstDiscovered.current.index).toBe(2);

  await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri dome debug hook");
    const temple = debug.getTempleState();
    debug.setPlayer(temple.noteX, temple.noteZ);
  });
  await page.waitForFunction(() => window.__centauriDebug?.getFieldNotesState().discoveredCount === 2);
  const secondDiscovered = await page.evaluate(() => window.__centauriDebug?.getFieldNotesState());

  expect(secondDiscovered?.discoveredCount).toBe(2);
  expect(secondDiscovered?.discovered[0]?.id).toBe("dome-chronoglass");
  expect(secondDiscovered?.discovered[0]?.index).toBe(2);
  expect(secondDiscovered?.discovered[1]?.id).toBe("temple-gate");
  expect(secondDiscovered?.discovered[1]?.index).toBe(3);
  expect(secondDiscovered?.current.index).toBe(3);
});

test("discovers the observatory as the next collection-order field note", async ({ page }) => {
  await page.goto("/?debug=observatory&test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));
  await expect(page.getByText("observatory debug")).toBeVisible();
  await expect(page.getByText("Field Note 001")).toBeVisible();

  const source = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri observatory debug hook");
    const observatory = debug.getObservatoryState();
    const temple = debug.getTempleState();
    const player = debug.getPlayer();
    const notes = debug.getFieldNotesState();
    return {
      observatory,
      templeNoteX: temple.noteX,
      templeNoteZ: temple.noteZ,
      playerClear: !debug.isBlockedAt(player.x, player.z),
      observatoryBlocked: debug.isBlockedAt(observatory.x, observatory.z),
      platformBlocked: observatory.platformSamples.map((sample) => debug.isBlockedAt(sample.x, sample.z)),
      platformStanding: observatory.platformSurfaceSamples.map((sample) => {
        debug.setPlayer(sample.x, sample.z);
        const playerOnDeck = debug.getPlayer();
        return {
          surfaceY: sample.surfaceY,
          deckAboveTerrain: sample.surfaceY - sample.terrainY,
          cameraOffsetFromSurface: playerOnDeck.y - sample.surfaceY,
          debugSurfaceY: debug.surfaceHeightAt(sample.x, sample.z),
        };
      }),
      blockerBlocked: observatory.blockerSamples.map((sample) => ({
        name: sample.name,
        blocked: debug.isBlockedAt(sample.x, sample.z),
      })),
      observatoryIsOnLand: debug.terrainHeightAt(observatory.x, observatory.z) > 0.25,
      discoveredCount: notes.discoveredCount,
      total: notes.total,
    };
  });

  expect(source.observatory.obstacleCount).toBe(1);
  expect(source.observatory.noteRadius).toBeGreaterThan(6);
  expect(source.observatory.telescopeInteractionRadius).toBeGreaterThan(5);
  expect(source.playerClear).toBe(true);
  expect(source.observatoryBlocked).toBe(true);
  expect(source.platformBlocked.every((blocked) => !blocked)).toBe(true);
  expect(source.platformStanding.every((sample) => sample.deckAboveTerrain > 0.2)).toBe(true);
  expect(source.platformStanding.every((sample) => sample.cameraOffsetFromSurface > 1.5 && sample.cameraOffsetFromSurface < 1.8)).toBe(true);
  expect(source.platformStanding.every((sample) => Math.abs(sample.debugSurfaceY - sample.surfaceY) < 0.001)).toBe(true);
  expect(source.blockerBlocked.every((sample) => sample.blocked)).toBe(true);
  expect(source.observatoryIsOnLand).toBe(true);
  expect(source.discoveredCount).toBe(0);
  expect(source.total).toBe(5);

  await page.evaluate(({ observatory }) => window.__centauriDebug?.setPlayer(observatory.noteX, observatory.noteZ), source);
  await page.waitForFunction(() => window.__centauriDebug?.getFieldNotesState().discoveredCount === 1);
  await expect(page.getByText("Field Note 002")).toBeVisible();
  await expect(page.getByText(/little telescope on a quiet rim/)).toBeVisible();

  const afterObservatory = await page.evaluate(() => window.__centauriDebug?.getFieldNotesState());
  expect(afterObservatory?.discovered[0]?.id).toBe("observatory-sightline");
  expect(afterObservatory?.discovered[0]?.index).toBe(2);
  expect(afterObservatory?.current.index).toBe(2);

  await page.evaluate(({ templeNoteX, templeNoteZ }) => window.__centauriDebug?.setPlayer(templeNoteX, templeNoteZ), source);
  await page.waitForFunction(() => window.__centauriDebug?.getFieldNotesState().discoveredCount === 2);
  const afterTemple = await page.evaluate(() => window.__centauriDebug?.getFieldNotesState());

  expect(afterTemple?.discoveredCount).toBe(2);
  expect(afterTemple?.discovered[0]?.id).toBe("observatory-sightline");
  expect(afterTemple?.discovered[0]?.index).toBe(2);
  expect(afterTemple?.discovered[1]?.id).toBe("temple-gate");
  expect(afterTemple?.discovered[1]?.index).toBe(3);
  expect(afterTemple?.current.index).toBe(3);
});

test("radio debug starts near exactly three grounded dishes with precise base collision", async ({ page }) => {
  await page.goto("/?debug=radio&test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getRadioTelescopeArrayState));
  await expect(page.getByText("radio telescope debug")).toBeVisible();

  const state = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri radio debug hook");
    const radio = debug.getRadioTelescopeArrayState();
    const player = debug.getPlayer();
    const yawDeltas: number[] = [];
    for (let i = 0; i < radio.dishes.length; i += 1) {
      for (let j = i + 1; j < radio.dishes.length; j += 1) {
        const delta = Math.atan2(Math.sin(radio.dishes[i].yaw - radio.dishes[j].yaw), Math.cos(radio.dishes[i].yaw - radio.dishes[j].yaw));
        yawDeltas.push(Math.abs(delta));
      }
    }
    return {
      radio,
      playerClear: !debug.isBlockedAt(player.x, player.z),
      centerBlocked: debug.isBlockedAt(radio.x, radio.z),
      noteBlocked: debug.isBlockedAt(radio.noteX, radio.noteZ),
      playerDistanceFromApproach: Math.hypot(player.x - radio.approachX, player.z - radio.approachZ),
      yawDeltas,
      pitchSpread: Math.max(...radio.dishes.map((dish) => dish.pitch)) - Math.min(...radio.dishes.map((dish) => dish.pitch)),
      notes: debug.getFieldNotesState(),
    };
  });

  expect(state.radio.dishCount).toBe(3);
  expect(state.radio.dishes).toHaveLength(3);
  expect(state.radio.baseSamples).toHaveLength(3);
  expect(state.radio.obstacleCount).toBe(1);
  expect(state.radio.noteRadius).toBeGreaterThan(8);
  expect(state.playerClear).toBe(true);
  expect(state.centerBlocked).toBe(false);
  expect(state.noteBlocked).toBe(false);
  expect(state.radio.baseSamples.every((sample) => sample.blocked)).toBe(true);
  expect(state.playerDistanceFromApproach).toBeLessThan(0.1);
  expect(Math.min(...state.yawDeltas)).toBeGreaterThan(0.75);
  expect(state.pitchSpread).toBeGreaterThan(0.3);
  expect(state.radio.terrainFlatness.samples.length).toBeGreaterThanOrEqual(19);
  expect(state.radio.terrainFlatness.minHeight).toBeGreaterThan(0.25);
  expect(state.radio.terrainFlatness.heightVariation).toBeLessThan(2.8);
  expect(state.notes.total).toBe(5);
  expect(state.notes.discoveredCount).toBe(0);
});

test("discovers the radio telescope array as the next collection-order field note", async ({ page }) => {
  await page.goto("/?debug=radio-telescope&test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getRadioTelescopeArrayState));
  await expect(page.getByText("radio telescope debug")).toBeVisible();
  await expect(page.getByText("Field Note 001")).toBeVisible();

  const source = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri radio debug hook");
    const radio = debug.getRadioTelescopeArrayState();
    const temple = debug.getTempleState();
    return {
      radio,
      templeNoteX: temple.noteX,
      templeNoteZ: temple.noteZ,
    };
  });

  await page.evaluate(({ radio }) => window.__centauriDebug?.setPlayer(radio.noteX, radio.noteZ), source);
  await page.waitForFunction(() => window.__centauriDebug?.getFieldNotesState().discoveredCount === 1);
  await expect(page.getByText("Field Note 002")).toBeVisible();
  await expect(page.getByText(/Three pale dishes listen/)).toBeVisible();

  const afterRadio = await page.evaluate(() => window.__centauriDebug?.getFieldNotesState());
  expect(afterRadio?.discovered[0]?.id).toBe("radio-array-listening");
  expect(afterRadio?.discovered[0]?.index).toBe(2);
  expect(afterRadio?.current.index).toBe(2);

  await page.evaluate(({ templeNoteX, templeNoteZ }) => window.__centauriDebug?.setPlayer(templeNoteX, templeNoteZ), source);
  await page.waitForFunction(() => window.__centauriDebug?.getFieldNotesState().discoveredCount === 2);
  const afterTemple = await page.evaluate(() => window.__centauriDebug?.getFieldNotesState());

  expect(afterTemple?.discoveredCount).toBe(2);
  expect(afterTemple?.discovered[0]?.id).toBe("radio-array-listening");
  expect(afterTemple?.discovered[0]?.index).toBe(2);
  expect(afterTemple?.discovered[1]?.id).toBe("temple-gate");
  expect(afterTemple?.discovered[1]?.index).toBe(3);
  expect(afterTemple?.current.index).toBe(3);
});

test("enters and exits telescope mode without moving the player body", async ({ page }) => {
  await page.goto("/?debug=telescope&test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));
  await expect(page.getByText("telescope debug")).toBeVisible();
  await expect(page.locator(".hud__look")).toHaveText("E telescope");

  const spawn = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri telescope debug hook");
    const observatory = debug.getObservatoryState();
    const before = debug.getPlayer();
    const awayX = before.x - observatory.x;
    const awayZ = before.z - observatory.z;
    const awayLength = Math.hypot(awayX, awayZ) || 1;
    const moved = debug.attemptMove((awayX / awayLength) * 2, (awayZ / awayLength) * 2);
    const travel = Math.hypot(moved.x - before.x, moved.z - before.z);
    debug.setPlayer(observatory.telescopeUseX, observatory.telescopeUseZ);
    return {
      observatory,
      useBlocked: debug.isBlockedAt(observatory.telescopeUseX, observatory.telescopeUseZ),
      viewBlocked: debug.isBlockedAt(observatory.telescopeViewX, observatory.telescopeViewZ),
      travel,
    };
  });

  expect(spawn.observatory.nearby).toBe(true);
  expect(spawn.useBlocked).toBe(false);
  expect(spawn.viewBlocked).toBe(false);
  expect(spawn.travel).toBeGreaterThan(1.4);

  const entered = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri telescope debug hook");
    const before = debug.getPlayer();
    const observatory = debug.enterTelescope();
    return { before, observatory };
  });

  expect(entered.observatory.telescopeActive).toBe(true);
  expect(entered.observatory.observatoryVisible).toBe(false);
  expect(entered.observatory.cameraFov).toBeLessThan(40);
  expect(entered.observatory.nearby).toBe(true);
  await expect(page.getByText(/telescope: E or Esc to exit/)).toBeVisible();

  await page.keyboard.down("w");
  await page.waitForTimeout(250);
  const locked = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri telescope debug hook");
    return { player: debug.getPlayer(), view: debug.getViewState() };
  });

  expect(Math.hypot(locked.player.x - entered.before.x, locked.player.z - entered.before.z)).toBeLessThan(0.01);
  expect(locked.view.telescopeActive).toBe(true);

  const panned = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri telescope debug hook");
    const before = debug.getViewState();
    const observatory = debug.panTelescope(0.4, 0.18);
    const after = debug.getViewState();
    return { before, after, observatory, player: debug.getPlayer() };
  });

  expect(Math.abs(panned.after.yaw - panned.before.yaw)).toBeGreaterThan(0.1);
  expect(Math.abs(panned.after.pitch - panned.before.pitch)).toBeGreaterThan(0.05);
  expect(Math.hypot(panned.player.x - entered.before.x, panned.player.z - entered.before.z)).toBeLessThan(0.01);

  const exited = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri telescope debug hook");
    const observatory = debug.exitTelescope();
    return { observatory, player: debug.getPlayer() };
  });
  await page.keyboard.up("w");

  expect(exited.observatory.telescopeActive).toBe(false);
  expect(exited.observatory.observatoryVisible).toBe(true);
  expect(exited.observatory.cameraFov).toBeCloseTo(68, 1);
  await expect(page.locator(".hud__look")).toHaveText("E telescope");

  const afterExitMove = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri telescope debug hook");
    const observatory = debug.getObservatoryState();
    const before = debug.getPlayer();
    const awayX = before.x - observatory.x;
    const awayZ = before.z - observatory.z;
    const awayLength = Math.hypot(awayX, awayZ) || 1;
    const moved = debug.attemptMove((awayX / awayLength) * 2, (awayZ / awayLength) * 2);
    return Math.hypot(moved.x - before.x, moved.z - before.z);
  });
  expect(afterExitMove).toBeGreaterThan(1.4);

  await page.keyboard.press("Space");
  await page.waitForFunction(
    (startY) => {
      const debug = window.__centauriDebug;
      return Boolean(debug && debug.getPlayer().y > startY + 0.55 && !debug.getMovementState().grounded);
    },
    exited.player.y
  );
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
