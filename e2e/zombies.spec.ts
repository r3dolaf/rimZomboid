import { expect, test, type Page } from '@playwright/test';

interface Debug {
  world: {
    zombieLevel: string;
    zombies: unknown[];
    nextZombieId: number;
    survivors: { id: number; pos: { x: number; y: number }; stance: string }[];
  };
}

const world = (page: Page) =>
  page.evaluate(() => (window as unknown as { rimzomboid: Debug }).rimzomboid.world);

test('portada: opción Zombis; un zombi junto a un colono se ve en el HUD; postura desde el panel', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?debug=1');
  await expect(page.getByTestId('zombies-normal')).toHaveClass(/selected/);
  await page.getByTestId('zombies-many').click();
  await page.getByTestId('start-seed').fill('77');
  await page.getByTestId('start-go').click();
  await expect(page).toHaveURL(/zombis=muchos/);
  expect((await world(page)).zombieLevel).toBe('many');
  await page.locator('[data-speed="0"]').click();

  // Sin zombis cerca (H4f: al empezar pueden estar a 12 casillas, a la vista), un zombi junto al
  // primer colono se ve al momento.
  await page.evaluate(() => {
    const w = (window as unknown as { rimzomboid: Debug }).rimzomboid.world;
    w.zombies = [];
  });
  await expect(page.getByTestId('hud-zombies')).toHaveText('Zombis a la vista: 0');
  await page.evaluate(() => {
    const w = (window as unknown as { rimzomboid: Debug }).rimzomboid.world;
    const s = w.survivors[0]!;
    w.zombies.push({
      id: w.nextZombieId++,
      pos: { x: s.pos.x + 1, y: s.pos.y },
      path: [],
      health: 60,
      state: 'wander',
      targetId: null,
      goal: null,
      lastSeenAt: 0,
      cooldown: 0,
      waitUntil: 0,
      hordeId: null, // H4e
    });
  });
  await expect(page.getByTestId('hud-zombies')).toHaveText('Zombis a la vista: 1');

  // Panel de Trabajos: la postura del primero pasa a Huir.
  const id = (await world(page)).survivors[0]!.id;
  await page.keyboard.press('j');
  const select = page.getByTestId(`work-${id}-stance`);
  await select.selectOption('flee');
  await expect(select).toHaveValue('flee');
  await page.keyboard.press('Escape');
  await page.locator('[data-speed="1"]').click();
  await expect.poll(async () => (await world(page)).survivors[0]!.stance).toBe('flee');
  expect(errores).toEqual([]);
});
