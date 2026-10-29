// H5b2: las bolsas en el navegador — pestaña Bolsas, listas, «Llevar siempre», Almacén y Atuendos.
import { expect, test, type Page } from '@playwright/test';

interface DebugBag {
  id: number;
  kind: string;
  items: Record<string, unknown> & { pieces: unknown[] };
  list: Record<string, number>;
}
interface Debug {
  world: {
    nextPieceId: number;
    pieceLog: { made: number; gone: number };
    survivors: {
      id: number;
      bags: Record<'waist' | 'back' | 'hand', DebugBag | null>;
      bagsPinned: string[];
      keep: Record<string, number>;
    }[];
    storage: { items: { pieces: unknown[] } };
    outfits: { bags: string[]; handBag: boolean }[];
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

/** Una bolsa vacía nueva (como `newBag`), puesta o guardada. */
async function giveBag(page: Page, kind: string, where: 'back' | 'storage'): Promise<number> {
  return page.evaluate(
    ([kind, where]) => {
      const { world: w } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
      const items: DebugBag['items'] = { pieces: [] };
      for (const k of [
        'food',
        'bandage',
        'knife',
        'bat',
        'axe',
        'wood',
        'cloth',
        'curtains',
        'thread',
        'needle',
        'crowbar',
        'machete',
        'painkillers',
        'denim',
        'leather',
        'bucket',
        'waterBucket',
        'waterBottle',
        'hatchet',
      ])
        items[k] = 0;
      const bag: DebugBag = { id: w.nextPieceId++, kind: kind!, items, list: {} };
      w.pieceLog.made++;
      if (where === 'back') w.survivors[0]!.bags.back = bag;
      else w.storage.items.pieces.push(bag);
      return bag.id;
    },
    [kind, where] as const,
  );
}

test('pestaña Bolsas: la mochila puesta, fijarla, su lista y «Llevar siempre»', async ({
  page,
}) => {
  const errores = watchErrors(page);
  await page.goto('/?seed=5&debug=1');
  await page.locator('[data-speed="0"]').click();
  const id = await giveBag(page, 'hikingPack', 'back');
  const sid = (await world(page)).survivors[0]!.id;
  await page.getByTestId(`card-${sid}`).click();
  await page.getByTestId('sheet-tab-bags').click();
  const pane = page.getByTestId('sheet-pane-bags');
  await expect(pane.getByTestId('bags-back')).toContainText('Mochila de excursión');
  await expect(pane.getByTestId('bags-back')).toContainText('0 / 12 kg');
  await pane.getByTestId('bag-pin-back').click();
  await expect(pane.getByTestId('bag-pin-back')).toHaveText('Fijada');
  await pane.getByTestId(`bag-${id}-add`).selectOption('food');
  await pane.getByTestId(`bag-${id}-plus-food`).click();
  await expect(pane.getByTestId(`bag-${id}-list`)).toContainText('2 latas');
  await pane.getByTestId('keep-plus-bandage').click();
  await expect(pane.getByTestId('keep-list')).toContainText('3 vendas');
  await page.locator('[data-speed="1"]').click();
  await expect.poll(async () => (await world(page)).survivors[0]!.bagsPinned).toEqual(['back']);
  const s = (await world(page)).survivors[0]!;
  expect(s.bags.back?.list).toEqual({ food: 2 });
  expect(s.keep).toEqual({ bandage: 3 });
  await page.locator('[data-speed="0"]').click();
  await page.getByTestId('sheet-tab-general').click();
  await page.getByTestId('sheet-close').click();
  expect(errores).toEqual([]);
});

test('bolsas guardadas en el Almacén y casillas de bolsas en Atuendos', async ({ page }) => {
  const errores = watchErrors(page);
  await page.goto('/?seed=6&debug=1');
  await page.locator('[data-speed="0"]').click();
  const id = await giveBag(page, 'duffel', 'storage');
  await page.getByTestId('hud-storage').click();
  const bags = page.getByTestId('storage-bags');
  await expect(bags).toContainText('Bolsa de deporte');
  await bags.getByTestId(`bag-${id}-add`).selectOption('bandage');
  await expect(bags.getByTestId(`bag-${id}-list`)).toContainText('1 venda');
  await page.keyboard.press('Escape');
  await page.getByTestId('hud-outfits').click();
  const panel = page.getByTestId('outfits-panel');
  await panel.getByTestId('outfit-tab-3').click(); // Base
  await expect(panel.getByTestId('outfit-handbag')).not.toBeChecked();
  await panel.getByTestId('outfit-bag-hikingPack').uncheck();
  await page.locator('[data-speed="1"]').click();
  await expect.poll(async () => (await world(page)).outfits[2]!.bags).not.toContain('hikingPack');
  await page.keyboard.press('Escape');
  expect(errores).toEqual([]);
});
