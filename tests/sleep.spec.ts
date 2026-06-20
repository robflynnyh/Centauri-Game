import { expect, test, type Page } from "@playwright/test";

test.use({ video: "off" });

test("drains the sleep meter with accelerated debug timing", async ({ page }) => {
  await page.goto("/?test=sleep");
  await waitForSleepDebug(page);
  await expect(page.locator(".hud__sleep")).toBeVisible();

  const initial = await setSleepAmount(page, 1);
  const drained = await advanceSleep(page, 0.42, { wantsSleep: false, moving: false, grounded: true });

  expect(initial.drainSeconds).toBeCloseTo(1.6);
  expect(initial.amount).toBeGreaterThan(0.9);
  expect(drained.amount).toBeLessThan(initial.amount - 0.12);
  expect(drained.blackout).toBe(false);
});

test("refills only after the player holds still to sleep", async ({ page }) => {
  await page.goto("/?test=sleep");
  await waitForSleepDebug(page);
  const before = await setSleepAmount(page, 0.25);

  const whileMoving = await advanceSleep(page, 0.22, { wantsSleep: true, moving: true, grounded: true });

  expect(whileMoving.sleeping).toBe(false);
  expect(whileMoving.message).toBe("stand still");
  expect(whileMoving.amount).toBeLessThan(before.amount);

  const sleeping = await advanceSleep(page, 0.12, { wantsSleep: true, moving: false, grounded: true });

  expect(sleeping.sleeping).toBe(true);
  expect(sleeping.amount).toBeGreaterThan(whileMoving.amount);

  const refilled = await advanceSleep(page, 0.28, { wantsSleep: true, moving: false, grounded: true });

  expect(refilled.amount).toBeGreaterThan(0.82);
  expect(refilled.blackout).toBe(false);
});

test("fades to a recoverable blackout when the sleep meter reaches zero", async ({ page }) => {
  await page.goto("/?test=sleep");
  await waitForSleepDebug(page);
  await setSleepAmount(page, 0.1);

  const blackout = await advanceSleep(page, 0.25, { wantsSleep: false, moving: false, grounded: true });
  const beforeMove = await getPlayer(page);
  await expect(page.locator(".blackout")).toHaveClass(/blackout--visible/);

  await page.keyboard.down("KeyW");
  await page.waitForTimeout(160);
  await page.keyboard.up("KeyW");
  const afterMove = await getPlayer(page);

  expect(blackout.blackout).toBe(true);
  expect(blackout.amount).toBeLessThan(0.1);
  expect(Math.hypot(afterMove.x - beforeMove.x, afterMove.z - beforeMove.z)).toBeLessThan(0.001);

  const recovered = await advanceSleep(page, 1.1, { wantsSleep: false, moving: false, grounded: true });

  expect(recovered.blackout).toBe(false);
  expect(recovered.amount).toBeGreaterThan(0.95);
  await expect(page.locator(".blackout")).not.toHaveClass(/blackout--visible/);
});

async function waitForSleepDebug(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getSleepState));
}

async function setSleepAmount(page: Page, amount: number): Promise<{
  amount: number;
  drainSeconds: number;
  sleeping: boolean;
  blackout: boolean;
  message: string;
}> {
  return page.evaluate((value) => {
    const debug = window.__centauriDebug;
    if (!debug?.setSleepAmount) throw new Error("Missing Centauri sleep reset debug hook");
    return debug.setSleepAmount(value);
  }, amount);
}

async function advanceSleep(
  page: Page,
  delta: number,
  input: { wantsSleep: boolean; moving: boolean; grounded: boolean }
): Promise<{
  amount: number;
  drainSeconds: number;
  sleeping: boolean;
  blackout: boolean;
  message: string;
}> {
  return page.evaluate(
    ({ deltaSeconds, updateInput }) => {
      const debug = window.__centauriDebug;
      if (!debug?.advanceSleep) throw new Error("Missing Centauri sleep advance debug hook");
      return debug.advanceSleep(deltaSeconds, updateInput);
    },
    { deltaSeconds: delta, updateInput: input }
  );
}

async function getPlayer(page: Page): Promise<{ x: number; z: number }> {
  return page.evaluate(() => {
    const player = window.__centauriDebug?.getPlayer();
    if (!player) throw new Error("Missing Centauri player debug state");
    return { x: player.x, z: player.z };
  });
}
