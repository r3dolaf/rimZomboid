import { expect, test } from '@playwright/test';

// H6b: jugar, guardar, recargar la portada y «Continuar»: la misma partida (en pausa); y un archivo
// que no es una partida no se carga.

interface Debug {
  world: { tick: number; survivors: { name: string }[] };
}

const state = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const w = (window as unknown as { rimzomboid: Debug }).rimzomboid.world;
    return { tick: w.tick, names: w.survivors.map((s) => s.name) };
  });

test('guardar, volver a la portada y «Continuar»: la misma partida', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/?seed=5&debug=1');
  await page.locator('[data-speed="3"]').click();
  await page.waitForTimeout(1500);
  await page.locator('[data-speed="0"]').click();
  await page.getByTestId('hud-game').click();
  await page.getByTestId('game-save').click();
  await expect(page.getByTestId('game-status')).toHaveText('Partida guardada');
  const before = await state(page);

  // Recargar la página (F5) sigue la partida guardada, no empieza otra encima.
  await page.reload();
  await expect.poll(() => state(page)).toEqual(before);

  await page.goto('/?debug=1');
  await expect(page.getByTestId('start-continue')).toHaveText(/^Continuar \(día \d+\)$/);
  await page.getByTestId('start-continue').click();
  await expect.poll(() => state(page)).toEqual(before);
  // Empieza en pausa: el tiempo no corre.
  await page.waitForTimeout(500);
  expect((await state(page)).tick).toBe(before.tick);

  // Importar algo que no es una partida: se dice y no pasa nada.
  await page.getByTestId('hud-game').click();
  await page.getByTestId('game-import').setInputFiles({
    name: 'nada.json',
    mimeType: 'application/json',
    buffer: Buffer.from('hola'),
  });
  await expect(page.getByTestId('game-status')).toHaveText(
    'Ese archivo no es una partida de rimZomboid',
  );
  expect(errores).toEqual([]);
});
