// Con todos durmiendo, el tiempo va solo a x6; elegir una velocidad lo quita esa noche.
import { expect, test, type Page } from '@playwright/test';

interface Debug {
  world: {
    tick: number;
    survivors: { needs: { sleep: number }; action: { type: string; inBed?: boolean } }[];
  };
}

const tick = (page: Page) =>
  page.evaluate(() => (window as unknown as { rimzomboid: Debug }).rimzomboid.world.tick);

test('todos durmiendo: «x6 (durmiendo)» y el tiempo corre más; pulsar x1 lo quita', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/?seed=5&debug=1');
  const badge = page.getByTestId('hud-sleep-speed');
  await expect(badge).toBeHidden();
  await page.evaluate(() => {
    for (const s of (window as unknown as { rimzomboid: Debug }).rimzomboid.world.survivors) {
      s.needs.sleep = 0; // rendidos: solo les despierta un golpe
      s.action = { type: 'sleep', inBed: false };
    }
  });
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('x6 (durmiendo)');
  await page.waitForTimeout(1000); // (al cargar, los primeros fotogramas van lentos)
  // Lo que avanza en 2 s a x6 y luego a x1: se compara entre sí, porque con varios navegadores a
  // la vez los fotogramas van lentos y los ticks por segundo cambian.
  const during = async () => {
    const t0 = await tick(page);
    await page.waitForTimeout(2000);
    return (await tick(page)) - t0;
  };
  const fast = await during();
  await page.locator('[data-speed="1"]').click();
  await expect(badge).toBeHidden();
  await expect(page.locator('[data-speed="1"]')).toHaveClass(/active/);
  const slow = await during();
  expect(fast).toBeGreaterThan(3 * slow); // unas 6 veces más
  expect(errores).toEqual([]);
});
