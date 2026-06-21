import { expect, test, type Page } from "@playwright/test";

test.use({ video: "off" });

type SleepState = {
  amount: number;
  drainSeconds: number;
  drainMultiplier: number;
  sleeping: boolean;
  blackout: boolean;
  eyelidAmount: number;
  eyelidPhase: "open" | "closing" | "closed" | "opening";
  message: string;
};

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

test("uses exertion-specific drain rates for idle, crouch, walk, and airborne movement", async ({ page }) => {
  await page.goto("/?test=sleep");
  await waitForSleepDebug(page);

  const delta = 0.2;
  const idle = await drainFromFull(page, delta, {
    wantsSleep: false,
    moving: false,
    grounded: true,
    movementAmount: 0,
  });
  const crouching = await drainFromFull(page, delta, {
    wantsSleep: false,
    moving: true,
    grounded: true,
    movementAmount: 0.7,
    crouching: true,
  });
  const walking = await drainFromFull(page, delta, {
    wantsSleep: false,
    moving: true,
    grounded: true,
    movementAmount: 1,
  });
  const airborne = await drainFromFull(page, delta, {
    wantsSleep: false,
    moving: true,
    grounded: false,
    movementAmount: 1,
    airborne: true,
  });

  expect(idle.drainMultiplier).toBeCloseTo(0.6);
  expect(crouching.drainMultiplier).toBeCloseTo(0.8);
  expect(walking.drainMultiplier).toBeCloseTo(1.25);
  expect(airborne.drainMultiplier).toBeCloseTo(2.1);
  expect(idle.drained).toBeLessThan(crouching.drained);
  expect(crouching.drained).toBeLessThan(walking.drained);
  expect(airborne.drained).toBeGreaterThan(walking.drained);
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

test("animates voluntary sleep eyelids closed and open", async ({ page }) => {
  await page.goto("/?test=sleep");
  await waitForSleepDebug(page);
  await setSleepAmount(page, 0.35);
  const eyelids = page.locator(".eyelids");

  const closing = await advanceSleep(page, 0.1, { wantsSleep: true, moving: false, grounded: true });

  expect(closing.sleeping).toBe(true);
  expect(closing.eyelidPhase).toBe("closing");
  expect(closing.eyelidAmount).toBeGreaterThan(0.25);
  expect(closing.eyelidAmount).toBeLessThan(1);
  await expect(eyelids).toHaveAttribute("data-phase", "closing");

  const closed = await advanceSleep(page, 0.1, { wantsSleep: true, moving: false, grounded: true });

  expect(closed.eyelidPhase).toBe("closed");
  expect(closed.eyelidAmount).toBe(1);
  await expect(eyelids).toHaveAttribute("data-phase", "closed");

  const opening = await advanceSleep(page, 0.07, { wantsSleep: false, moving: false, grounded: true });

  expect(opening.sleeping).toBe(false);
  expect(opening.eyelidPhase).toBe("opening");
  expect(opening.eyelidAmount).toBeGreaterThan(0);
  expect(opening.eyelidAmount).toBeLessThan(1);
  await expect(eyelids).toHaveAttribute("data-phase", "opening");

  const open = await advanceSleep(page, 0.2, { wantsSleep: false, moving: false, grounded: true });

  expect(open.eyelidPhase).toBe("open");
  expect(open.eyelidAmount).toBe(0);
  await expect(eyelids).toHaveAttribute("data-phase", "open");
});

test("fades to a recoverable blackout when the sleep meter reaches zero", async ({ page }) => {
  await page.goto("/?test=sleep");
  await waitForSleepDebug(page);
  await setSleepAmount(page, 0.1);

  const blackout = await advanceSleep(page, 0.34, { wantsSleep: false, moving: false, grounded: true });
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

async function setSleepAmount(page: Page, amount: number): Promise<SleepState> {
  return page.evaluate((value) => {
    const debug = window.__centauriDebug;
    if (!debug?.setSleepAmount) throw new Error("Missing Centauri sleep reset debug hook");
    return debug.setSleepAmount(value);
  }, amount);
}

async function advanceSleep(
  page: Page,
  delta: number,
  input: Partial<{
    wantsSleep: boolean;
    moving: boolean;
    grounded: boolean;
    movementAmount: number;
    crouching: boolean;
    airborne: boolean;
  }>
): Promise<SleepState> {
  return page.evaluate(
    ({ deltaSeconds, updateInput }) => {
      const debug = window.__centauriDebug;
      if (!debug?.advanceSleep) throw new Error("Missing Centauri sleep advance debug hook");
      return debug.advanceSleep(deltaSeconds, updateInput);
    },
    { deltaSeconds: delta, updateInput: input }
  );
}

async function drainFromFull(
  page: Page,
  delta: number,
  input: Partial<{
    wantsSleep: boolean;
    moving: boolean;
    grounded: boolean;
    movementAmount: number;
    crouching: boolean;
    airborne: boolean;
  }>
): Promise<{ drained: number; drainMultiplier: number }> {
  const before = await setSleepAmount(page, 1);
  const after = await advanceSleep(page, delta, input);
  return { drained: before.amount - after.amount, drainMultiplier: after.drainMultiplier };
}

async function getPlayer(page: Page): Promise<{ x: number; z: number }> {
  return page.evaluate(() => {
    const player = window.__centauriDebug?.getPlayer();
    if (!player) throw new Error("Missing Centauri player debug state");
    return { x: player.x, z: player.z };
  });
}
