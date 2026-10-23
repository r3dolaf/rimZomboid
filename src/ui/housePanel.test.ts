// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { Tile } from '../sim/types';
import { createWorld } from '../sim/world';
import { buildingTitle } from './describe';
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
  cs[0]!.items = {
    food: 0,
    bandage: 0,
    knife: 0,
    bat: 0,
    axe: 0,
    wood: 0,
    cloth: 0,
    curtains: 0,
    thread: 0,
    needle: 0,
    crowbar: 0,
    machete: 0,
    painkillers: 0,
  };
  cs[1]!.designated = true;
  sel.set(h.id);
  panel.update();
  expect(el().hidden).toBe(false);
  expect(el().textContent).toContain(buildingTitle(w, h.id));
  expect(el().textContent).toContain('Se va a saquear');
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

test('con la puerta atrancada (y vista), lo dice: hace falta una palanca (H4d)', () => {
  const root = document.createElement('div');
  const w = createWorld(2);
  const sel = createSelection();
  const panel = mountHousePanel(root, { world: w, selection: sel });
  const h = w.houses[0]!;
  const door = h.door.y * w.grid.width + h.door.x;
  const text = () => root.querySelector('[data-testid="house-panel"]')!.textContent!;
  w.grid.tiles[door] = Tile.Door;
  w.seen[door] = 1;
  sel.set(h.id);
  panel.update();
  expect(text()).not.toContain('atrancada');
  w.grid.tiles[door] = Tile.LockedDoor;
  panel.update();
  expect(text()).toContain('Puerta atrancada: hace falta una palanca');
  w.seen[door] = 0; // sin verla, no se sabe
  panel.update();
  expect(text()).not.toContain('atrancada');
});
