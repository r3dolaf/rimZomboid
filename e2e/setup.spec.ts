import { expect, test } from '@playwright/test';

// C2: comienzos y ajustes desde la portada: «Solo» con «Infección alta» llega a la partida (una
// tarjeta, la dirección y el panel Partida) y se conserva al recargar.
test('portada: Solo con Infección alta; la dirección lo lleva y al recargar sigue', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?debug=1');
  const start = page.getByTestId('start');
  await expect(start).toBeVisible();
  await expect(page.getByTestId('start-objective')).toContainText('radio');
  await page.getByTestId('scenario-solo').click();
  await page.getByTestId('start-custom').locator('summary').click();
  await page.getByTestId('setup-infection-high').click();
  await expect(page.getByTestId('start-custom').locator('summary')).toHaveText(
    'Ajustes a medida · 1 cambiado',
  );
  await page.getByTestId('start-seed').fill('77');
  await page.getByTestId('start-go').click();
  await expect(start).toBeHidden();
  await expect(page).toHaveURL(/comienzo=solo/);
  await expect(page).toHaveURL(/infeccion=alta/);
  await expect(page.locator('[data-testid^="card-"]')).toHaveCount(1);
  await page.getByTestId('hud-game').click();
  await expect(page.getByTestId('game-setup')).toHaveText('Comienzo: Solo · Infección: alta');
  // Al recargar (o compartir el enlace), la misma partida.
  await page.reload();
  await expect(page.locator('[data-testid^="card-"]')).toHaveCount(1);
  expect(errores).toEqual([]);
});
