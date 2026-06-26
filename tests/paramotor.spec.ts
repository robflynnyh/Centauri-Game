import { expect, test } from "@playwright/test";

test.use({
  video: "off",
  viewport: { width: 1280, height: 720 },
});

test("paramotor debug route mounts, climbs, descends, and lands back to walking", async ({ page }) => {
  await page.goto("/?debug=paramotor&test=collision");
  await expect(page.getByText("paramotor debug")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getParamotorState));

  const start = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing paramotor debug state");
    return { player: debug.getPlayer(), paramotor: debug.getParamotorState() };
  });

  expect(start.paramotor.distanceFromSpawn).toBeGreaterThan(36);
  expect(start.paramotor.distanceFromSpawn).toBeLessThan(126);
  expect(start.paramotor.hillSlope).toBeGreaterThan(0.07);
  expect(start.paramotor.distanceToPlayer).toBeLessThan(start.paramotor.interactionRadius);
  expect(start.paramotor.canMount).toBe(true);
  expect(start.paramotor.mounted).toBe(false);

  await page.focus("canvas");
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__centauriDebug?.getParamotorState().mounted === true);

  const mounted = await page.evaluate(() => window.__centauriDebug?.getParamotorState());
  expect(mounted?.airborne).toBe(false);
  expect(mounted?.gas).toBeGreaterThan(0.9);

  await page.keyboard.down("w");
  await page.waitForFunction(
    () => {
      const state = window.__centauriDebug?.getParamotorState();
      return Boolean(state && state.airborne && state.speed > 4.2 && state.altitudeAboveGround > 0.45);
    },
    undefined,
    { timeout: 8_000 }
  );
  const climbed = await page.evaluate(() => window.__centauriDebug?.getParamotorState());
  expect(climbed?.throttle).toBeGreaterThan(0.25);
  expect(climbed?.gas).toBeLessThan(1);
  expect(climbed?.altitudeAboveGround).toBeGreaterThan(0.45);

  await page.keyboard.up("w");
  await page.keyboard.down("Shift");
  await page.keyboard.down("s");
  await page.waitForFunction(
    () => {
      const state = window.__centauriDebug?.getParamotorState();
      return Boolean(state && state.mounted && state.airborne && state.throttle < 0.18 && state.verticalSpeed < -0.2);
    },
    undefined,
    { timeout: 7_000 }
  );
  const descending = await page.evaluate(() => window.__centauriDebug?.getParamotorState());
  await page.waitForTimeout(1_200);
  const laterDescent = await page.evaluate(() => window.__centauriDebug?.getParamotorState());
  expect(Number.isFinite(descending?.altitudeAboveGround)).toBe(true);
  expect(Number.isFinite(laterDescent?.altitudeAboveGround)).toBe(true);
  expect(laterDescent?.altitudeAboveGround ?? 0).toBeLessThan((descending?.altitudeAboveGround ?? 0) + 0.6);

  await page.waitForFunction(
    () => {
      const debug = window.__centauriDebug;
      const state = debug?.getParamotorState();
      const movement = debug?.getMovementState();
      return Boolean(state && movement && !state.mounted && movement.grounded);
    },
    undefined,
    { timeout: 16_000 }
  );

  await page.keyboard.up("s");
  await page.keyboard.up("Shift");

  const landed = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing paramotor debug state");
    return { paramotor: debug.getParamotorState(), movement: debug.getMovementState() };
  });
  expect(landed.paramotor.mounted).toBe(false);
  expect(landed.movement.grounded).toBe(true);
  expect(landed.paramotor.altitudeAboveGround).toBeLessThan(0.2);
});

test("paramotor flight normalizes coordinates across the spherical planet seam", async ({ page }) => {
  await page.goto("/?debug=paramotor&test=collision");
  await expect(page.getByText("paramotor debug")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getParamotorState));

  const planet = await page.evaluate(() => window.__centauriDebug?.getPlanetState());
  if (!planet) throw new Error("Missing planet debug state");

  await page.evaluate((circumference) => {
    window.__centauriDebug?.setParamotorFlightForTest({
      x: circumference * 0.5 - 0.4,
      z: 0,
      yaw: -Math.PI / 2,
      speed: 18,
      throttle: 0.72,
      altitudeAboveGround: 16,
      gas: 0.9,
    });
  }, planet.circumference);

  await page.waitForTimeout(1_000);
  const after = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing paramotor debug state");
    return {
      player: debug.getPlayer(),
      paramotor: debug.getParamotorState(),
      planet: debug.getPlanetState(),
    };
  });

  expect(after.paramotor.mounted).toBe(true);
  expect(after.paramotor.airborne).toBe(true);
  expect(after.paramotor.altitudeAboveGround).toBeGreaterThan(5);
  expect(after.player.x).toBeLessThan(-after.planet.circumference * 0.5 + 40);
  expect(Math.abs(after.player.z)).toBeLessThan(3);
  expect(Number.isFinite(after.planet.radialDistance)).toBe(true);
});
