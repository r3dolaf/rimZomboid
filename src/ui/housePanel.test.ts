// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { createWorld } from '../sim/world';
import { mountHousePanel } from './housePanel';
import { createSelection } from './selection';

test('muestra la casa seleccionada con sus contenedores y se cierra con la ✕', () => {
  const root = document.createElement('div');
  const w = createWorld(2);
  const sel = createSelection();
  const panel = mountHousePanel(root, { world: w, selection: sel });
  const el = () => root.querySelector('[data-testid="house-panel"]') as HTMLElement;
  panel.update();
  expect(el().hidden).toBe(true);
  const h = w.houses[0]!;
  const cs = w.containers.filter((c) => c.houseId === h.id);
  for (const c of cs) w.seen[c.pos.y * w.grid.width + c.pos.x] = 1;
  cs[0]!.searched = true;
  cs[0]!.items = { food: 0, bandage: 0, knife: 0, bat: 0, axe: 0, wood: 0 };
  cs[1]!.designated = true;
  sel.set(h.id);
  panel.update();
  expect(el().hidden).toBe(false);
  expect(el().textContent).toContain(`Casa ${h.id}`);
  expect(el().textContent).toContain('Marcada para saquear');
  expect(el().textContent).toContain(`Registrados: 1 de ${cs.length} vistos`);
  expect(el().textContent).toContain('Vacíos: 1');
  (root.querySelector('[data-testid="house-close"]') as HTMLElement).click();
  expect(sel.id).toBeNull();
});

test('sin ningún contenedor visto, dice que está sin explorar y no cuenta nada', () => {
  const root = document.createElement('div');
  const w = createWorld(2);
  const sel = createSelection();
  const panel = mountHousePanel(root, { world: w, selection: sel });
  const h = w.houses[0]!;
  for (const c of w.containers.filter((c) => c.houseId === h.id))
    w.seen[c.pos.y * w.grid.width + c.pos.x] = 0;
  sel.set(h.id);
  panel.update();
  const text = root.querySelector('[data-testid="house-panel"]')!.textContent!;
  expect(text).toContain('Sin explorar por dentro');
  expect(text).not.toContain('Registrados');
});
