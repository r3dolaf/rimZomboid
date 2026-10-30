// H5b: la ropa en el navegador — pestaña Ropa, panel Atuendos, Almacén con ropa y el barreño.
import { expect, test, type Page } from '@playwright/test';

interface Debug {
  world: {
    common: {
      nextPieceId: number;
      pieceLog: { made: number; gone: number };
      outfits: { id: number; name: string }[];
    };
    survivors: { id: number; outfitId: number; worn: { kind: string }[] }[];
    storage: { items: { pieces: unknown[] } };
  };
}

function watchErrors(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  return errores;
}

const world = (page: Page) =>
  page.evaluate(() => (window as unknown as { rimzomboid: Debug }).rimzomboid.world);

test('pestaña Ropa con lo que lleva; el atuendo se cambia desde la ficha', async ({ page }) => {
  const errores = watchErrors(page);
  await page.goto('/?seed=5&debug=1');
  await page.locator('[data-speed="0"]').click();
  const id = (await world(page)).survivors[0]!.id;
  await page.getByTestId(`card-${id}`).click();
  await page.getByTestId('sheet-tab-clothes').click();
  const pane = page.getByTestId('sheet-pane-clothes');
  await expect(pane).toBeVisible();
  await expect(pane.getByTestId('clothes-torso')).toContainText('Camiseta');
  await expect(pane).toContainText('Favorita:');
  await pane.getByTestId('sheet-outfit').selectOption({ label: 'Saqueo' });
  await page.locator('[data-speed="1"]').click();
  await expect.poll(async () => (await world(page)).survivors[0]!.outfitId).toBe(2);
  await page.locator('[data-speed="0"]').click();
  await page.getByTestId('sheet-tab-general').click();
  await page.getByTestId('sheet-close').click();
  expect(errores).toEqual([]);
});

test('panel Atuendos: crear uno, renombrarlo y quitarle una prenda', async ({ page }) => {
  const errores = watchErrors(page);
  await page.goto('/?seed=6&debug=1');
  await page.locator('[data-speed="0"]').click();
  await page.getByTestId('hud-outfits').click();
  const panel = page.getByTestId('outfits-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-testid^="outfit-tab-"]')).toHaveText([
    'Cualquiera',
    'Saqueo',
    'Base',
  ]);
  await panel.getByTestId('outfit-add').click();
  await expect(panel.locator('[data-testid^="outfit-tab-"]')).toHaveCount(4);
  await panel.getByTestId('outfit-name').fill('Noche');
  await panel.getByTestId('outfit-name').press('Enter');
  await panel.getByTestId('outfit-garment-cap').uncheck();
  await page.locator('[data-speed="1"]').click();
  await expect
    .poll(async () => (await world(page)).common.outfits.map((o) => o.name))
    .toEqual(['Cualquiera', 'Saqueo', 'Base', 'Noche']);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  expect(errores).toEqual([]);
});

test('Almacén con Materiales y Ropa; el barreño en el menú de Construir', async ({ page }) => {
  const errores = watchErrors(page);
  await page.goto('/?seed=7&debug=1');
  await page.locator('[data-speed="0"]').click();
  await page.evaluate(() => {
    const { world: w } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    w.storage.items.pieces.push({
      id: w.common.nextPieceId++,
      kind: 'leatherJacket',
      holes: ['leftArm'],
      patches: {},
      pads: {},
      dirtHours: 0,
      bloody: false,
      from: null,
    });
    w.common.pieceLog.made++;
  });
  await page.getByTestId('hud-storage').click();
  const storage = page.getByTestId('storage-panel');
  await expect(storage).toContainText('Materiales');
  await expect(storage.getByTestId('storage-clothes')).toContainText(
    'Chaqueta de cuero (rota por el brazo izquierdo)',
  );
  await page.keyboard.press('Escape');
  await page.getByTestId('hud-build-tool').click();
  await expect(page.getByTestId('build-tub')).toContainText('Barreño — 4 tablas'); // H5c1
  expect(errores).toEqual([]);
});
