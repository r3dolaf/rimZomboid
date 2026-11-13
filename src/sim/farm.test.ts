import { expect, test } from 'vitest';
import {
  CROPS,
  RAIN_MOISTURE_HOURS,
  RIPE_ROT_HOURS,
  TICKS_PER_HOUR,
  WITHER_DRY_HOURS,
} from './balance';
import { canPlot, cropStage, farmSystem, markPlot, needsWater, plotMarked } from './farm';
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
  expect(w.plots).toEqual([{ tile: 66, kind: 'potato', crop: null, moisture: 0 }]);
  expect(canPlot(w, { x: 6, y: 6 })).toBe(false); // ya es huerto
  w.plots[0]!.crop = { kind: 'potato', grown: 10, ripe: 0, dry: 0 };
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
  w.plots[0]!.crop = { kind: 'potato', grown: 3, ripe: 2, dry: 0 };
  setTile(w.grid, 6, 6, Tile.Road);
  const problems = checkInvariants(w).join(' | ');
  expect(problems).toContain('repetida');
  expect(problems).toContain('fuera de la hierba');
  expect(problems).toContain('sin haber crecido');
});

const HOUR = TICKS_PER_HOUR;
/** Avanza `hours` horas de huerto (una pasada por hora). */
function hours(w: ReturnType<typeof field>, n: number) {
  for (let i = 0; i < n; i++) {
    w.tick += HOUR;
    farmSystem(w);
  }
}

test('crece solo con humedad; la lluvia la deja en 48 h', () => {
  const w = field();
  markPlot(w, 6, 6, true);
  const p = w.plots[0]!;
  p.crop = { kind: 'potato', grown: 0, ripe: 0, dry: 0 };
  hours(w, 5);
  expect(p.crop).toEqual({ kind: 'potato', grown: 0, ripe: 0, dry: 5 });
  w.common.rainUntil = w.tick + 2 * HOUR + 1; // llueve las 2 horas siguientes
  hours(w, 2);
  expect(p.moisture).toBe(RAIN_MOISTURE_HOURS - 1);
  expect(p.crop!.dry).toBe(0);
  hours(w, 10);
  expect(p.crop!.grown).toBe(12);
  expect(p.moisture).toBe(RAIN_MOISTURE_HOURS - 11);
});

test('con sus horas húmeda está madura (la patata, 10 días); sin cosechar, se pudre a los 4 días', () => {
  const w = field();
  markPlot(w, 6, 6, true);
  const p = w.plots[0]!;
  p.crop = { kind: 'potato', grown: CROPS.potato.hours - 1, ripe: 0, dry: 0 };
  p.moisture = 10;
  hours(w, 1);
  expect(cropStage(p)).toBe('ripe');
  hours(w, RIPE_ROT_HOURS - 1);
  expect(cropStage(p)).toBe('ripe');
  hours(w, 1);
  expect(p.crop).toBeNull();
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'cropsLost', dried: 0, rotted: 1 });
});

test('tras 3 días sin humedad se seca y se pierde', () => {
  const w = field();
  markPlot(w, 6, 6, true);
  markPlot(w, 7, 6, true);
  for (const p of w.plots) p.crop = { kind: 'potato', grown: 20, ripe: 0, dry: 0 };
  hours(w, WITHER_DRY_HOURS - 1);
  expect(w.plots.every((p) => cropStage(p) === 'growing')).toBe(true);
  hours(w, 1);
  expect(w.plots.every((p) => p.crop === null)).toBe(true);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'cropsLost', dried: 2, rotted: 0 });
});

test('pide agua lo sembrado que no está maduro y tiene menos de 6 h de humedad', () => {
  const w = field();
  markPlot(w, 6, 6, true);
  const p = w.plots[0]!;
  expect(needsWater(p)).toBe(false); // vacía
  p.crop = { kind: 'potato', grown: 3, ripe: 0, dry: 0 };
  p.moisture = 6;
  expect(needsWater(p)).toBe(false);
  p.moisture = 5;
  expect(needsWater(p)).toBe(true);
  p.crop = { kind: 'potato', grown: CROPS.potato.hours, ripe: 1, dry: 0 };
  expect(needsWater(p)).toBe(false);
});

test('el registro dice lo que se ha perdido del huerto', async () => {
  const { es } = await import('../i18n/es');
  expect(es.log.cropsLost(2, 0)).toBe('Se han secado 2 cultivos');
  expect(es.log.cropsLost(0, 1)).toBe('Se ha podrido 1 cultivo sin cosechar');
  expect(es.log.cropsLost(1, 3)).toBe(
    'Se ha secado 1 cultivo y se han podrido 3 cultivos sin cosechar',
  );
});
