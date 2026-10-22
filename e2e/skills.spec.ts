import { expect, test } from '@playwright/test';

interface Debug {
  world: {
    survivors: { id: number; skills: Record<string, { level: number; xp: number }> }[];
  };
}

test('ficha: pestaña Habilidades con sus niveles; panel de Trabajos como matriz con el mejor en negrita', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.goto('/?seed=4242&debug=1');
  await page.locator('[data-speed="0"]').click();
  const first = await page.evaluate(() => {
    const s = (window as unknown as { rimzomboid: Debug }).rimzomboid.world.survivors[0]!;
    return { id: s.id, build: s.skills.build!.level };
  });

  // Ficha: General por defecto; en Habilidades, una fila por habilidad con su nivel.
  await page.locator(`[data-testid="card-${first.id}"]`).click();
  const sheet = page.getByTestId('sheet');
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('sheet-pane-general')).toBeVisible();
  await page.getByTestId('sheet-tab-skills').click();
  await expect(page.getByTestId('sheet-pane-skills')).toBeVisible();
  await expect(page.getByTestId('sheet-pane-general')).toBeHidden();
  await expect(sheet.locator('[data-testid^="sheet-skill-"]')).toHaveCount(7); // H4d: también Fabricar
  await expect(page.getByTestId('sheet-skill-build').locator('.level')).toHaveText(
    String(first.build),
  );

  // Panel: el nivel de Construir al lado de la casilla; el mejor de la columna, en negrita.
  await page.keyboard.press('Escape');
  await page.keyboard.press('j');
  const level = page.getByTestId(`work-${first.id}-build-level`);
  await expect(level).toHaveText(String(first.build));
  await page.evaluate((id) => {
    const w = (window as unknown as { rimzomboid: Debug }).rimzomboid.world;
    w.survivors.find((s) => s.id === id)!.skills.build!.level = 10;
  }, first.id);
  await page.locator('[data-speed="1"]').click();
  await expect(level).toHaveText('10');
  await expect(level).toHaveClass(/best/);
  expect(errores).toEqual([]);
});
