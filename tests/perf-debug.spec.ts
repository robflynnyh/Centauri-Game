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
    state.nature.rebuilds,
    state.nature.lastRebuildMs,
    state.nature.maxRebuildMs,
    state.nature.totalRebuildMs,
  ];

  for (const value of finiteValues) {
    expect(Number.isFinite(value)).toBe(true);
  }

  expect(state.sceneObjects).toBeGreaterThan(0);
  expect(state.terrain.rebuilds).toBeGreaterThan(0);
  expect(state.nature.rebuilds).toBeGreaterThan(0);
});
