import { expect, test, type Page } from '@playwright/test';

// D1: un colono con pistola y balas, en modo combate, dispara a los zombis que tiene cerca (gasta
// balas y se dibuja y suena el disparo) sin errores.

interface Debug {
  world: {
    zombies: { health: number }[];
    nextZombieId: number;
    grid: { width: number; tiles: number[] };
    survivors: {
      id: number;
      pos: { x: number; y: number };
      drafted: boolean;
      carrying: Record<string, number>;
      shot?: { tick: number };
    }[];
  };
}

const world = (page: Page) =>
  page.evaluate(() => (window as unknown as { rimzomboid: Debug }).rimzomboid.world);

test('con pistola y balas, en modo combate, dispara a los zombis de al lado', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=77&debug=1');
  await page.locator('[data-speed="0"]').click();
  await page.evaluate(() => {
    const w = (window as unknown as { rimzomboid: Debug }).rimzomboid.world;
    w.zombies = [];
    const s = w.survivors[0]!;
    s.carrying.pistol = 1;
    s.carrying.ammo = 30;
    s.drafted = true;
    // Dos zombis a una casilla (en la base, en el mismo cuarto que él).
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
    ])
      w.zombies.push({
        id: w.nextZombieId++,
        pos: { x: s.pos.x + dx!, y: s.pos.y + dy! },
        path: [],
        health: 60,
        state: 'wander',
        targetId: null,
        goal: null,
        lastSeenAt: 0,
        cooldown: 0,
        waitUntil: 0,
        hordeId: null,
        worn: [],
        bags: [],
      } as never);
  });
  await page.locator('[data-speed="1"]').click();
  await expect
    .poll(async () => (await world(page)).survivors[0]!.carrying.ammo, { timeout: 20_000 })
    .toBeLessThan(30);
  expect((await world(page)).survivors[0]!.shot).toBeDefined();
  await page.waitForTimeout(1500);
  expect(errores).toEqual([]);
});
