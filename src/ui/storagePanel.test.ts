// @vitest-environment jsdom
// H5 §10: el panel de Almacén, con todos los materiales y cuántos hay.
import { expect, test } from 'vitest';
import { ITEM_KINDS } from '../sim/items';
import { createWorld } from '../sim/world';
import { createFlag } from './flag';
import { mountStoragePanel } from './storagePanel';

test('cerrado al empezar; abierto, todos los materiales con su cantidad, al día', () => {
  const root = document.createElement('div');
  const w = createWorld(2);
  const open = createFlag();
  const panel = mountStoragePanel(root, { world: w, open });
  const el = () => root.querySelector('[data-testid="storage-panel"]') as HTMLElement;
  panel.update();
  expect(el().hidden).toBe(true);
  open.set(true);
  w.storage.items.painkillers = 4;
  w.storage.items.cloth = 0;
  panel.update();
  expect(el().hidden).toBe(false);
  expect(el().textContent).toContain('Almacén');
  for (const k of ITEM_KINDS)
    expect(root.querySelector(`[data-testid="storage-${k}"]`)).not.toBeNull();
  expect(root.querySelector('[data-testid="storage-painkillers"]')?.textContent).toBe(
    'Analgésicos4',
  );
  expect(root.querySelector('[data-testid="storage-food"]')?.textContent).toBe(
    `Latas${w.storage.items.food}`,
  );
  w.storage.items.painkillers = 3;
  panel.update();
  expect(root.querySelector('[data-testid="storage-painkillers"]')?.textContent).toBe(
    'Analgésicos3',
  );
  (root.querySelector('[data-testid="storage-close"]') as HTMLButtonElement).click();
  expect(open.value).toBe(false);
  panel.update();
  expect(el().hidden).toBe(true);
});

test('arriba, el botón Almacén lo abre y lo cierra', async () => {
  const { mountHud } = await import('./hud');
  const { createTimeController } = await import('../game/timeController');
  const { createTool } = await import('./tool');
  const root = document.createElement('div');
  const open = createFlag();
  mountHud(root, {
    seed: 1,
    time: createTimeController(),
    tool: createTool(),
    toggleStorage: open.toggle,
  });
  const b = root.querySelector('[data-testid="hud-storage"]') as HTMLButtonElement;
  expect(b.textContent).toBe('Almacén');
  b.click();
  expect(open.value).toBe(true);
});
