import { expect, test } from "@playwright/test";

test("perf debug values are present and finite", async ({ page }) => {
  await page.goto("/?test=perf");
  await expect(page.getByText("perf debug")).toBeVisible();
  await page.waitForFunction(() => {
    const state = window.__centauriDebug?.getPerfState();
    return Boolean(state && state.frameSamples >= 2);
  });

  const state = await page.evaluate(() => {
    const perf = window.__centauriDebug?.getPerfState();
    if (!perf) throw new Error("Missing Centauri perf debug state");
    return perf;
  });

  const finiteValues = [
    state.frameMs,
    state.fps,
    state.frameSamples,
    state.drawCalls,
    state.triangles,
    state.geometries,
    state.textures,
    state.sceneObjects,
    state.terrain.rebuilds,
    state.terrain.lastRebuildMs,
    state.terrain.maxRebuildMs,
    state.terrain.totalRebuildMs,
    state.terrain.cachedChunks,
    state.terrain.visibleChunks,
    state.terrain.lastCreatedChunks,
    state.terrain.lastDisposedChunks,
    state.nature.rebuilds,
    state.nature.lastRebuildMs,
    state.nature.maxRebuildMs,
    state.nature.totalRebuildMs,
    state.ocean.rebuilds,
    state.ocean.lastRebuildMs,
    state.ocean.maxRebuildMs,
    state.ocean.totalRebuildMs,
    state.ocean.cachedChunks,
    state.ocean.visibleChunks,
    state.ocean.lastCreatedChunks,
    state.ocean.lastDisposedChunks,
  ];

  for (const value of finiteValues) {
    expect(Number.isFinite(value)).toBe(true);
  }

  expect(state.sceneObjects).toBeGreaterThan(0);
  expect(state.terrain.rebuilds).toBeGreaterThan(0);
  expect(state.nature.rebuilds).toBeGreaterThan(0);
  expect(state.ocean.rebuilds).toBeGreaterThan(0);
  expect(state.terrain.cachedChunks).toBe(state.terrain.visibleChunks);
  expect(state.ocean.cachedChunks).toBeGreaterThanOrEqual(state.ocean.visibleChunks);
});

test("chunk-boundary moves update terrain and ocean incrementally", async ({ page }) => {
  await page.goto("/?test=perf");
  await expect(page.getByText("perf debug")).toBeVisible();
  await page.waitForFunction(() => {
    const state = window.__centauriDebug?.getPerfState();
    return Boolean(state && state.frameSamples >= 2);
  });

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri perf debug state");
    const before = debug.getPerfState();
    const terrainState = debug.getTerrainState();
    debug.setPlayer(terrainState.chunkSize + 4, 24);
    const after = debug.getPerfState();
    return { before, after, chunkWindowSize: terrainState.chunkCount };
  });

  expect(result.after.terrain.rebuilds).toBeGreaterThan(result.before.terrain.rebuilds);
  expect(result.after.ocean.rebuilds).toBeGreaterThan(result.before.ocean.rebuilds);
  expect(result.after.terrain.lastCreatedChunks).toBeLessThan(result.chunkWindowSize);
  expect(result.after.terrain.lastDisposedChunks).toBeLessThan(result.chunkWindowSize);
  expect(result.after.ocean.lastCreatedChunks).toBeLessThan(result.chunkWindowSize);
  expect(result.after.ocean.lastDisposedChunks).toBeLessThan(result.chunkWindowSize);
  expect(result.after.terrain.cachedChunks).toBe(result.chunkWindowSize);
  expect(result.after.ocean.cachedChunks).toBe(result.chunkWindowSize);
});
