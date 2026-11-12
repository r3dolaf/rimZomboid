import { expect, test } from '@playwright/test';

// C3: conseguir un logro (aviso y en Partida) y la pantalla final con su crónica: copiarla y
// guardar la imagen, sin errores.

interface Debug {
  world: {
    tick: number;
    common: {
      stats: { kills: number };
      over: { tick: number } | null;
      chronicle?: Record<string, unknown>[];
    };
  };
}

test('un logro (aviso y en Partida) y la crónica en la pantalla final: copiar y guardar la imagen', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=12&debug=1');
  await page.locator('[data-speed="0"]').click();
  await page.evaluate(() => {
    (window as unknown as { rimzomboid: Debug }).rimzomboid.world.common.stats.kills = 100;
  });
  await expect(page.getByTestId('achievement-hundred')).toHaveText('🏆 Logro: Cien zombis');
  await page.getByTestId('hud-game').click();
  await expect(page.getByTestId('game-achievements')).toContainText('🏆 Logros 1/20');
  await expect(page.getByTestId('achievement-row-hundred')).toHaveClass(/done/);

  // La colonia cae: la crónica, con lo que se ha apuntado.
  await page.evaluate(() => {
    const w = (window as unknown as { rimzomboid: Debug }).rimzomboid.world;
    (w.common.chronicle ??= []).push({
      tick: w.tick,
      kind: 'died',
      name: 'Ana',
      cause: 'infection',
    });
    w.common.over = { tick: w.tick };
  });
  const end = page.getByTestId('end-screen');
  await expect(end).toBeVisible();
  await expect(page.getByTestId('end-chronicle')).toContainText(
    'Día 1 · Ana ha muerto por una infección',
  );
  await expect(end).toContainText('🏆 Cien zombis');
  await page.getByTestId('end-copy').click();
  await expect(page.getByTestId('end-share-status')).not.toHaveText('');
  const download = page.waitForEvent('download');
  await page.getByTestId('end-image').click();
  expect((await download).suggestedFilename()).toBe('rimzomboid-1.png');
  expect(errores).toEqual([]);
});
