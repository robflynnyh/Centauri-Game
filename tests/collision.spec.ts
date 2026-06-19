import { expect, test } from "@playwright/test";

test("blocks first-person movement at solid world objects", async ({ page }) => {
  await page.goto("/?test=collision");
  await page.waitForFunction(() => Boolean(window.__centauriDebug));

  const result = await page.evaluate(() => {
    const debug = window.__centauriDebug;
    if (!debug) throw new Error("Missing Centauri collision debug hook");

    const tree = debug.obstacles.find((obstacle) => obstacle.kind === "tree");
    const rock = debug.obstacles.find((obstacle) => obstacle.kind === "rock");
    if (!tree || !rock) throw new Error("Missing expected tree or rock collider");

    const startZ = tree.z + tree.radius + 0.85;
    debug.setPlayer(tree.x, startZ);
    const blocked = debug.attemptMove(0, -1.5);
    const waterPassable = !debug.isBlockedAt(5.5, 7.5);

    return {
      colliderCount: debug.obstacles.length,
      treeBlocked: Math.abs(blocked.z - startZ) < 0.001,
      rockBlocked: debug.isBlockedAt(rock.x, rock.z),
      waterPassable,
    };
  });

  expect(result.colliderCount).toBeGreaterThan(30);
  expect(result.treeBlocked).toBe(true);
  expect(result.rockBlocked).toBe(true);
  expect(result.waterPassable).toBe(true);
});
