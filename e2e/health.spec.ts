// H5: heridas y muerte en el navegador — pestaña Salud, cama de hospital, aviso de fiebre,
// filtros del registro, panel de Almacén y la pantalla final.
import { expect, test, type Page } from '@playwright/test';

interface Person {
  id: number;
  pos: { x: number; y: number };
  wounds: unknown[];
  dying: string | null;
  painkillerWanted: boolean;
}
interface Debug {
  world: {
    tick: number;
    nextWoundId: number;
    survivors: Person[];
    beds: { id: number; pos: { x: number; y: number }; medical?: boolean }[];
    storage: { items: Record<string, number> };
  };
  tileToScreen(x: number, y: number): { x: number; y: number };
  forceEvent(id: string): boolean;
}

const debug = (page: Page) =>
  page.evaluate(() => {
    const { world } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    return world;
  });

function watchErrors(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  return errores;
}

test('pestaña Salud con sus heridas y Dar analgésico; una cama se hace de hospital', async ({
  page,
}) => {
  const errores = watchErrors(page);
  await page.goto('/?seed=5&debug=1');
  await page.locator('[data-speed="0"]').click();
  const id = await page.evaluate(() => {
    const { world: w } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    const s = w.survivors[0]!;
    s.wounds.push({
      id: w.nextWoundId++,
      part: 'leftLeg',
      kind: 'cut',
      size: 6,
      damage: 6,
      at: w.tick,
      bleeding: true,
      cleanUntil: 0,
    });
    w.storage.items.painkillers = 2;
    return s.id;
  });
  await page.getByTestId(`card-${id}`).click();
  await page.getByTestId('sheet-tab-health').click();
  const pane = page.getByTestId('sheet-pane-health');
  await expect(pane).toBeVisible();
  await expect(pane).toContainText('Pierna izquierda');
  await expect(pane).toContainText('Corte, sangra');
  await expect(page.getByTestId(`card-${id}`).getByTestId('health-icons')).toHaveText('🩸');
  await page.getByTestId('sheet-painkiller').click();
  await page.locator('[data-speed="1"]').click();
  await expect.poll(async () => (await debug(page)).survivors[0]!.painkillerWanted).toBe(true);
  await page.locator('[data-speed="0"]').click();
  await page.getByTestId('sheet-tab-general').click();
  await page.getByTestId('sheet-close').click();

  // La cama: un clic la abre (sin nadie encima) y se marca de hospital.
  const bed = await page.evaluate(() => {
    const { world: w, tileToScreen } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    const b = w.beds[0]!;
    for (const s of w.survivors)
      if (Math.abs(s.pos.x - b.pos.x - 0.5) < 2 && Math.abs(s.pos.y - b.pos.y - 0.5) < 2)
        s.pos = { x: s.pos.x + 3, y: s.pos.y };
    return { id: b.id, ...tileToScreen(b.pos.x, b.pos.y) };
  });
  await page.waitForTimeout(100);
  await page.mouse.click(bed.x, bed.y);
  const panel = page.getByTestId('bed-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Cama de');
  await page.getByTestId('bed-medical').check();
  await page.locator('[data-speed="1"]').click();
  await expect
    .poll(async () => (await debug(page)).beds.find((b) => b.id === bed.id)?.medical)
    .toBe(true);
  await expect(panel.locator('h2')).toHaveText('Cama de hospital');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  expect(errores).toEqual([]);
});

test('aviso de fiebre con tres opciones; filtros del registro; panel de Almacén', async ({
  page,
}) => {
  const errores = watchErrors(page);
  await page.goto('/?seed=6&debug=1');
  await page.locator('[data-speed="0"]').click();
  await page.evaluate(() =>
    (window as unknown as { rimzomboid: Debug }).rimzomboid.forceEvent('flu'),
  );
  const fever = page.getByTestId('decision-fever');
  await expect(fever).toBeVisible();
  await expect(fever).toContainText('tiene fiebre. ¿Qué hacéis?');
  await expect(fever.locator('button')).toHaveText([
    'Que descanse',
    'Que se vaya',
    'Acabar con su sufrimiento',
  ]);
  await fever.getByTestId('decision-option-0').click();
  await expect(fever).toBeHidden();
  await page.locator('[data-speed="1"]').click();
  const log = page.getByTestId('log');
  await expect(log).toContainText('guarda reposo');
  await page.locator('[data-speed="0"]').click();

  // Filtros: sin Salud, lo de la fiebre no se ve; se recuerda al recargar.
  await page.getByTestId('log-filter-health').click();
  await expect(log.locator('li:visible', { hasText: 'guarda reposo' })).toHaveCount(0);
  await page.reload();
  // (El registro está vacío al empezar y no se ve, pero el filtro sigue apagado.)
  await expect(page.getByTestId('log-filter-health')).toHaveClass(/off/);

  // Almacén: arriba, con todos los materiales.
  await page.getByTestId('hud-storage').click();
  const storage = page.getByTestId('storage-panel');
  await expect(storage).toBeVisible();
  await expect(storage).toContainText('Analgésicos');
  await expect(storage).toContainText('Latas');
  await page.keyboard.press('Escape');
  await expect(storage).toBeHidden();
  expect(errores).toEqual([]);
});

test('si mueren todos, la pantalla final con el resumen; Volver a la portada', async ({ page }) => {
  const errores = watchErrors(page);
  await page.goto('/?seed=7&debug=1');
  await page.evaluate(() => {
    const { world: w } = (window as unknown as { rimzomboid: Debug }).rimzomboid;
    for (const s of w.survivors) s.dying = 'blood';
  });
  const end = page.getByTestId('end-screen');
  await expect(end).toBeVisible();
  await expect(end).toContainText('La colonia ha caído');
  await expect(end).toContainText('Sobrevivisteis 1 día');
  await expect(end).toContainText('desangrándose');
  await expect(page.locator('[data-speed="0"]')).toHaveClass(/active/);
  await page.getByTestId('end-title').click();
  await expect(page.getByTestId('start')).toBeVisible();
  expect(errores).toEqual([]);
});
