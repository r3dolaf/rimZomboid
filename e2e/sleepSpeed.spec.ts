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
  const t0 = await tick(page);
  await page.waitForTimeout(2000);
  expect((await tick(page)) - t0).toBeGreaterThan(40); // a x6, unos 120; a x1, 20 como mucho
  await page.locator('[data-speed="1"]').click();
  await expect(badge).toBeHidden();
  await expect(page.locator('[data-speed="1"]')).toHaveClass(/active/);
  expect(errores).toEqual([]);
});
