import { expect, test, type Page } from "@playwright/test";

test.use({ video: "off" });

type MovementState = {
  grounded: boolean;
  crouching: boolean;
  running: boolean;
  canRun: boolean;
  cameraHeight: number;
  horizontalSpeed: number;
  targetSpeed: number;
};

type PlayerState = {
  x: number;
  z: number;
};

type StaminaState = {
  amount: number;
  running: boolean;
  canRun: boolean;
  exhausted: boolean;
};

test("Shift runs faster than walking without triggering crouch", async ({ page }) => {
  await page.goto("/?test=collision");
  await waitForMovementDebug(page);
  await resetPlayer(page);
  await setStaminaAmount(page, 1);

  const walking = await measureForwardTravel(page, ["KeyW"], 620);

  await resetPlayer(page);
  await setStaminaAmount(page, 1);
  const running = await measureForwardTravel(page, ["Shift", "KeyW"], 620);

  expect(running.movement.running).toBe(true);
  expect(running.movement.crouching).toBe(false);
  expect(running.movement.targetSpeed).toBeGreaterThan(walking.movement.targetSpeed * 1.25);
  expect(running.distance).toBeGreaterThan(walking.distance * 1.18);
});

test("Ctrl crouches and Shift alone leaves the player standing", async ({ page }) => {
  await page.goto("/?test=collision");
  await waitForMovementDebug(page);
  await resetPlayer(page);
  const standing = await getMovementState(page);

  await page.keyboard.down("Shift");
  await page.waitForTimeout(180);
  const shift = await getMovementState(page);
  await page.keyboard.up("Shift");

  await page.keyboard.down("Control");
  await page.waitForFunction(
    (standingHeight) => {
      const movement = window.__centauriDebug?.getMovementState();
      return Boolean(movement && movement.crouching && movement.cameraHeight < standingHeight - 0.35);
    },
    standing.cameraHeight
  );
  const ctrl = await getMovementState(page);
  await page.keyboard.up("Control");

  expect(shift.crouching).toBe(false);
  expect(shift.cameraHeight).toBeGreaterThan(standing.cameraHeight - 0.08);
  expect(ctrl.crouching).toBe(true);
});

test("stamina drains while running and refills faster when idle than walking", async ({ page }) => {
  await page.goto("/?test=collision");
  await waitForStaminaDebug(page);

  const beforeRun = await setStaminaAmount(page, 1);
  const afterRun = await advanceStamina(page, 1.2, {
    wantsRun: true,
    moving: true,
    grounded: true,
    running: true,
  });

  await setStaminaAmount(page, 0.25);
  const afterWalkRefill = await advanceStamina(page, 1.4, {
    wantsRun: false,
    moving: true,
    grounded: true,
    running: false,
  });

  await setStaminaAmount(page, 0.25);
  const afterIdleRefill = await advanceStamina(page, 1.4, {
    wantsRun: false,
    moving: false,
    grounded: true,
    running: false,
  });

  expect(afterRun.amount).toBeLessThan(beforeRun.amount - 0.18);
  expect(afterWalkRefill.amount).toBeGreaterThan(0.35);
  expect(afterIdleRefill.amount).toBeGreaterThan(afterWalkRefill.amount + 0.15);
});

test("empty stamina prevents continued full-speed sprinting until recovery", async ({ page }) => {
  await page.goto("/?test=collision");
  await waitForMovementDebug(page);
  await resetPlayer(page);
  await setStaminaAmount(page, 0);

  await page.keyboard.down("Shift");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(260);
  const exhausted = await getMovementState(page);
  await page.keyboard.up("KeyW");
  await page.keyboard.up("Shift");

  expect(exhausted.running).toBe(false);
  expect(exhausted.canRun).toBe(false);
  expect(exhausted.targetSpeed).toBeLessThan(7);

  await advanceStamina(page, 1.0, { wantsRun: false, moving: false, grounded: true, running: false });
  const recovered = await getStaminaState(page);

  expect(recovered.canRun).toBe(true);
  expect(recovered.exhausted).toBe(false);
});

async function waitForMovementDebug(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getMovementState));
}

async function waitForStaminaDebug(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.__centauriDebug?.getStaminaState));
}

async function resetPlayer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri debug hook");
    debug.setPlayer(0, 24);
  });
}

async function getPlayer(page: Page): Promise<PlayerState> {
  return page.evaluate(() => {
    const player = window.__centauriDebug?.getPlayer();
    if (!player) throw new Error("Missing Centauri player debug state");
    return { x: player.x, z: player.z };
  });
}

async function getMovementState(page: Page): Promise<MovementState> {
  return page.evaluate(() => {
    const movement = window.__centauriDebug?.getMovementState();
    if (!movement) throw new Error("Missing Centauri movement debug state");
    return movement;
  });
}

async function setStaminaAmount(page: Page, amount: number): Promise<StaminaState> {
  return page.evaluate((value) => {
    const debug = window.__centauriDebug;
    if (!debug?.setStaminaAmount) throw new Error("Missing Centauri stamina reset debug hook");
    return debug.setStaminaAmount(value);
  }, amount);
}

async function getStaminaState(page: Page): Promise<StaminaState> {
  return page.evaluate(() => {
    const state = window.__centauriDebug?.getStaminaState();
    if (!state) throw new Error("Missing Centauri stamina debug state");
    return state;
  });
}

async function advanceStamina(
  page: Page,
  delta: number,
  input: Partial<{
    wantsRun: boolean;
    moving: boolean;
    grounded: boolean;
    running: boolean;
  }>
): Promise<StaminaState> {
  return page.evaluate(
    ({ deltaSeconds, updateInput }) => {
      const debug = window.__centauriDebug;
      if (!debug?.advanceStamina) throw new Error("Missing Centauri stamina advance debug hook");
      return debug.advanceStamina(deltaSeconds, updateInput);
    },
    { deltaSeconds: delta, updateInput: input }
  );
}

async function measureForwardTravel(
  page: Page,
  keys: string[],
  durationMs: number
): Promise<{ distance: number; movement: MovementState }> {
  const before = await getPlayer(page);
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  const movement = await getMovementState(page);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
  await page.waitForTimeout(80);
  const after = await getPlayer(page);
  return {
    distance: Math.hypot(after.x - before.x, after.z - before.z),
    movement,
  };
}
