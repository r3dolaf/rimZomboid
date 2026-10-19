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
  cs[0]!.searched = true;
  cs[0]!.items = { food: 0, bandage: 0, knife: 0, bat: 0 };
  cs[1]!.designated = true;
  sel.set(h.id);
  panel.update();
  expect(el().hidden).toBe(false);
  expect(el().textContent).toContain(`Casa ${h.id}`);
  expect(el().textContent).toContain('Marcada para saquear');
  expect(el().textContent).toContain(`Registrados: 1 de ${cs.length}`);
  expect(el().textContent).toContain('Vacíos: 1');
  (root.querySelector('[data-testid="house-close"]') as HTMLElement).click();
  expect(sel.id).toBeNull();
});
