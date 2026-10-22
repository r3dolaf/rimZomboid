// @vitest-environment jsdom
// H4b §8: portada, HUD, tarjetas, ficha, panel de Trabajos, menú Construir y registro.
import { expect, test, vi } from 'vitest';
import { buildAt } from '../game/tools';
import { parseZombies, startUrl } from '../game/seed';
import { createTimeController } from '../game/timeController';
import { setTile } from '../sim/map/grid';
import { damageTile } from '../sim/structures';
import { Tile } from '../sim/types';
import { createWorld } from '../sim/world';
import { zombiesInSight } from '../sim/danger';
import { newZombie } from '../sim/zombies/spawn';
import { emptyWorld } from '../sim/testing/fixtures';
import { mountBuildMenu } from './buildMenu';
import { mountCards } from './cards';
import { activityText, statusIcon } from './describe';
import { createFlag } from './flag';
import { mountHud } from './hud';
import { mountLog } from './logPanel';
import { createSelection } from './selection';
import { mountSheet } from './sheet';
import { mountStartScreen } from './startScreen';
import { createTool } from './tool';
import { mountWorkPanel } from './workPanel';
import { logEvent } from '../sim/log';

const q = (root: HTMLElement, id: string) =>
  root.querySelector(`[data-testid="${id}"]`) as HTMLElement;

test('la dirección lleva la opción Zombis (en español)', () => {
  expect(startUrl('?debug=1', 7, 'chaotic', 'many')).toBe(
    '?debug=1&seed=7&narrador=caotico&zombis=muchos',
  );
  expect(parseZombies('?zombis=pocos')).toBe('few');
  expect(parseZombies('?zombis=normal')).toBe('normal');
  expect(parseZombies('?zombis=nada')).toBeNull();
});

test('portada: opción Zombis (normal marcado) que llega a Empezar', () => {
  const root = document.createElement('div');
  const onStart = vi.fn();
  mountStartScreen(root, { seed: 42, randomSeed: () => 1, onStart });
  expect(q(root, 'zombies-normal').classList.contains('selected')).toBe(true);
  expect(q(root, 'zombies-few').textContent).toBe('Pocos');
  q(root, 'zombies-many').click();
  expect(q(root, 'zombies-many').classList.contains('selected')).toBe(true);
  q(root, 'start-go').click();
  expect(onStart).toHaveBeenCalledWith(42, 'balanced', 'many');
});

test('HUD: "Zombis a la vista: N"', () => {
  const root = document.createElement('div');
  const hud = mountHud(root, { seed: 1, time: createTimeController() });
  const w = createWorld(3);
  hud.update({ day: 1, hour: 8, minute: 0 }, w.storage.items, false, 4);
  expect(q(root, 'hud-zombies').textContent).toBe('Zombis a la vista: 4');
});

test('zombis a la vista: los que ve algún colono, en línea recta', () => {
  const w = emptyWorld(30, 30);
  w.seen.fill(1);
  w.survivors[0]!.pos = { x: 5.5, y: 5.5 };
  const a = newZombie(w, { x: 9, y: 5 });
  const b = newZombie(w, { x: 25, y: 25 });
  w.zombies.push(a, b);
  expect(zombiesInSight(w)).toEqual([a]);
  setTile(w.grid, 7, 5, Tile.Wall);
  expect(zombiesInSight(w)).toEqual([]);
});

test('tarjetas: barra de Salud e iconos de derribado, pelea con zombis y huida', () => {
  const root = document.createElement('div');
  const world = createWorld(5);
  const cards = mountCards(root, { world, selection: createSelection() });
  const s = world.survivors[0]!;
  s.health = 37;
  cards.update();
  const fill = root.querySelector(
    `[data-testid="card-${s.id}"] [data-need="health"] .fill`,
  ) as HTMLElement;
  expect(fill.style.width).toBe('37%');
  s.action = { type: 'downed', until: 99 };
  expect(statusIcon(s)?.label).toBe('En el suelo');
  s.action = { type: 'melee', zombieId: 1, cooldown: 0 };
  expect(statusIcon(s)?.label).toBe('Peleando con zombis');
  s.action = { type: 'moveTo', target: { x: 1, y: 1 }, run: true };
  expect(statusIcon(s)?.label).toBe('Huyendo');
  expect(activityText(s, world)).toBe('Huyendo a la base');
});

test('ficha: Salud, postura con tres botones y arma con su casilla Fijar (con órdenes en pausa)', () => {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const world = createWorld(5);
  const selection = createSelection();
  const sheet = mountSheet(root, { world, selection });
  const s = world.survivors[0]!;
  s.health = 64;
  s.stance = 'decide';
  s.equipped = 'bat';
  selection.set(s.id);
  sheet.update();
  expect(q(root, 'sheet').textContent).toContain('Salud: 64');
  expect(q(root, 'sheet-weapon').textContent).toContain('En la mano: bate');
  expect(q(root, 'sheet-stance-decide').classList.contains('selected')).toBe(true);
  q(root, 'sheet-stance-fight').click();
  expect(world.orders).toContainEqual({ type: 'setStance', survivorId: s.id, stance: 'fight' });
  sheet.update();
  expect(q(root, 'sheet-stance-fight').classList.contains('selected')).toBe(true);
  const lock = q(root, 'sheet-weapon-lock') as HTMLInputElement;
  expect(lock.checked).toBe(false);
  lock.click();
  expect(world.orders).toContainEqual({ type: 'lockWeapon', survivorId: s.id, locked: true });
  sheet.update();
  expect(lock.checked).toBe(true);
  s.equipped = null;
  sheet.update();
  expect(q(root, 'sheet-weapon').textContent).toContain('Sin arma');
});

test('panel de Trabajos: postura con un desplegable por colono (en la columna Pelear, H4c)', () => {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const world = createWorld(5);
  const open = createFlag();
  const panel = mountWorkPanel(root, { world, open });
  open.set(true);
  panel.update();
  expect([...root.querySelectorAll('th')].map((t) => t.textContent)).toContain('Pelear');
  const s = world.survivors[0]!;
  const sel = q(root, `work-${s.id}-stance`) as HTMLSelectElement;
  expect([...sel.options].map((o) => o.textContent)).toEqual(['Pelear', 'Huir', 'Decidir']);
  expect(sel.value).toBe(s.stance);
  sel.value = 'flee';
  sel.dispatchEvent(new Event('change'));
  expect(world.orders).toContainEqual({ type: 'setStance', survivorId: s.id, stance: 'flee' });
  s.stance = 'fight'; // la orden pendiente manda hasta que se aplique
  panel.update();
  expect(sel.value).toBe('flee');
});

test('menú Construir: Reparar (1–3 de madera)', () => {
  const root = document.createElement('div');
  const tool = createTool();
  const menu = mountBuildMenu(root, { tool });
  tool.set('build');
  menu.update();
  expect(q(root, 'build-repair').textContent).toBe('Reparar · 1–3');
  expect(q(root, 'build-fixDoor')).toBeNull(); // la elige Reparar sola
});

test('Reparar pone el plano que toca según lo que haya en la casilla', () => {
  const w = emptyWorld(10, 3);
  w.seen.fill(1);
  const put = (t: Tile, x: number) => setTile(w.grid, x, 1, t);
  put(Tile.Door, 1);
  damageTile(w, 1, 1, 5);
  put(Tile.BrokenDoor, 3);
  put(Tile.BrokenWindow, 5);
  put(Tile.Rubble, 7);
  put(Tile.Door, 9); // intacta: nada
  for (const x of [1, 3, 5, 7, 9]) buildAt(w, 'repair', x, 1);
  expect(w.orders).toEqual([
    { type: 'placeBlueprint', kind: 'repair', x: 1, y: 1 },
    { type: 'placeBlueprint', kind: 'fixDoor', x: 3, y: 1 },
    { type: 'placeBlueprint', kind: 'board', x: 5, y: 1 },
    { type: 'placeBlueprint', kind: 'woodWall', x: 7, y: 1 },
  ]);
});

test('el registro se puede minimizar (y volver a abrir)', () => {
  const root = document.createElement('div');
  const w = createWorld(3);
  const log = mountLog(root, { world: w });
  logEvent(w, { kind: 'outOfFood' });
  log.update();
  const list = root.querySelector('[data-testid="log"] ol') as HTMLElement;
  const toggle = q(root, 'log-toggle');
  expect(list.hidden).toBe(false);
  toggle.click();
  expect(list.hidden).toBe(true);
  expect(q(root, 'log').classList.contains('collapsed')).toBe(true);
  toggle.click();
  expect(list.hidden).toBe(false);
});
