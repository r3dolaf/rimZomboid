import { expect, test } from 'vitest';
import { canPlot, markPlot, plotMarked } from './farm';
import { issue, ordersSystem } from './orders';
import { addBase, emptyWorld } from './testing/fixtures';
import { Tile } from './types';
import { setTile } from './map/grid';

/** Hierba de 10×10, todo visto, con la base en la esquina (3×3). */
function field() {
  const w = addBase(emptyWorld(10, 10), { x: 0, y: 0, w: 3, h: 3 });
  w.seen.fill(1);
  w.survivors[0]!.pos = { x: 4.5, y: 4.5 }; // en la hierba (en 0,0 quedaba en el muro)
  return w;
}

test('el huerto va en hierba vista, fuera de los edificios y sin nada encima', () => {
  const w = field();
  expect(canPlot(w, { x: 6, y: 6 })).toBe(true);
  expect(canPlot(w, { x: 1, y: 1 })).toBe(false); // dentro de la base
  setTile(w.grid, 7, 7, Tile.Tree);
  expect(canPlot(w, { x: 7, y: 7 })).toBe(false);
  setTile(w.grid, 5, 8, Tile.Road);
  expect(canPlot(w, { x: 5, y: 8 })).toBe(false);
  w.piles.push({ id: 60, pos: { x: 8, y: 2 }, items: { ...w.storage.items } });
  expect(canPlot(w, { x: 8, y: 2 })).toBe(false);
  w.seen[4 * 10 + 9] = 0;
  expect(canPlot(w, { x: 9, y: 4 })).toBe(false);
  expect(canPlot(w, { x: 20, y: 4 })).toBe(false);
});

test('marcar y desmarcar parcelas; desmarcar pierde lo sembrado; no se repiten', () => {
  const w = field();
  markPlot(w, 6, 6, true);
  markPlot(w, 6, 6, true);
  expect(w.plots).toEqual([{ tile: 66, crop: null, moisture: 0 }]);
  expect(canPlot(w, { x: 6, y: 6 })).toBe(false); // ya es huerto
  w.plots[0]!.crop = { grown: 10, ripe: 0, dry: 0 };
  markPlot(w, 6, 6, false);
  expect(w.plots).toEqual([]);
  markPlot(w, 1, 1, true); // en la base, no
  expect(w.plots).toEqual([]);
});

test('en un sitio del mapa del mundo no hay huerto', () => {
  const w = field();
  w.mapId = 3;
  expect(canPlot(w, { x: 6, y: 6 })).toBe(false);
});

test('las órdenes pendientes cuentan para saber si está marcada', () => {
  const w = field();
  issue(w, { type: 'markPlot', x: 5, y: 5, on: true });
  expect(plotMarked(w, 5, 5)).toBe(true);
  ordersSystem(w);
  expect(w.plots.map((p) => p.tile)).toEqual([55]);
  issue(w, { type: 'markPlot', x: 5, y: 5, on: false });
  expect(plotMarked(w, 5, 5)).toBe(false);
});

test('no se construye encima del huerto', async () => {
  const { canPlace } = await import('./build');
  const w = field();
  markPlot(w, 6, 6, true);
  expect(canPlace(w, 'campfire', { x: 6, y: 6 })).toBe(false);
});

test('las invariantes vigilan el huerto', async () => {
  const { checkInvariants } = await import('./invariants');
  const w = field();
  markPlot(w, 6, 6, true);
  expect(checkInvariants(w)).toEqual([]);
  w.plots.push({ ...w.plots[0]! });
  w.plots[0]!.crop = { grown: 3, ripe: 2, dry: 0 };
  setTile(w.grid, 6, 6, Tile.Road);
  const problems = checkInvariants(w).join(' | ');
  expect(problems).toContain('repetida');
  expect(problems).toContain('fuera de la hierba');
  expect(problems).toContain('sin haber crecido');
});
