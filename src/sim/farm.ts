// El huerto (spec V1 §3): dónde va, marcar y desmarcar parcelas, y cómo crece lo sembrado.
import {
  CROPS,
  RAIN_MOISTURE_HOURS,
  RIPE_ROT_HOURS,
  TICKS_PER_HOUR,
  WATER_BELOW_HOURS,
  WITHER_DRY_HOURS,
} from './balance';
import { occupied } from './build';
import { logEvent } from './log';
import { getTile, inBounds } from './map/grid';
import { Tile, type CropKind, type Plot, type Point, type World } from './types';
import { outdoorTemp } from './season';
import { isRaining } from './water';
import { indoors } from './zombies/spawn';

/** Vacía, creciendo o madura. */
export type CropStage = 'empty' | 'growing' | 'ripe';

export function cropStage(p: Plot): CropStage {
  if (!p.crop) return 'empty';
  return p.crop.grown >= CROPS[p.crop.kind].hours ? 'ripe' : 'growing';
}

/** ¿Hay que regarla? Lo sembrado sin madurar con poca humedad. */
export const needsWater = (p: Plot): boolean =>
  cropStage(p) === 'growing' && p.moisture < WATER_BELOW_HOURS;

/**
 * Cada hora (V1 §3): la lluvia moja todo el huerto; lo húmedo crece y lo seco cuenta horas hasta
 * secarse; lo maduro cuenta horas hasta pudrirse. Lo perdido se apunta en el registro. V4 §2: cada
 * cultivo, con sus horas, el frío con el que se para y la helada que lo mata.
 */
export function farmSystem(w: World): void {
  if (w.mapId !== 0 || w.plots.length === 0 || w.tick % TICKS_PER_HOUR !== 0) return;
  // V3 §6: con helada se mueren las plantas; con frío no crecen; la nieve no moja (está helado).
  const temp = outdoorTemp(w);
  const rain = isRaining(w) && temp >= 0;
  let dried = 0;
  let rotted = 0;
  let frozen = 0;
  const frozenKinds: CropKind[] = [];
  for (const p of w.plots) {
    if (rain) p.moisture = RAIN_MOISTURE_HOURS;
    const wet = p.moisture > 0;
    p.moisture = Math.max(0, p.moisture - 1);
    const c = p.crop;
    if (!c) continue;
    const spec = CROPS[c.kind];
    if (c.grown >= spec.hours) {
      if (++c.ripe >= RIPE_ROT_HOURS) {
        p.crop = null;
        rotted++;
      }
    } else if (temp < spec.frost) {
      p.crop = null;
      frozen++;
      if (!frozenKinds.includes(c.kind)) frozenKinds.push(c.kind);
    } else if (temp < spec.growMin) {
      continue; // parado: ni crece ni se seca
    } else if (wet) {
      c.grown++;
      c.dry = 0;
    } else if (++c.dry >= WITHER_DRY_HOURS) {
      p.crop = null;
      dried++;
    }
  }
  if (dried + rotted > 0) logEvent(w, { kind: 'cropsLost', dried, rotted });
  if (frozen > 0) logEvent(w, { kind: 'cropsFrozen', n: frozen, crops: frozenKinds });
}

/** La parcela de esa casilla, o `undefined`. */
export function plotAt(w: World, x: number, y: number): Plot | undefined {
  const i = y * w.grid.width + x;
  return w.plots.find((p) => p.tile === i);
}

/** La casilla de una parcela. */
export const plotPos = (w: World, p: Plot): Point => ({
  x: p.tile % w.grid.width,
  y: Math.floor(p.tile / w.grid.width),
});

/**
 * ¿Puede ir ahí una parcela? En la base (no en los sitios), en hierba vista, fuera de los edificios
 * y sin nada encima (ni otra parcela).
 */
export function canPlot(w: World, p: Point): boolean {
  if (w.mapId !== 0 || !inBounds(w.grid, p.x, p.y)) return false;
  if (w.seen[p.y * w.grid.width + p.x] !== 1 || getTile(w.grid, p.x, p.y) !== Tile.Grass)
    return false;
  return !indoors(w, p.x, p.y) && !occupied(w, p.x, p.y);
}

/**
 * Marca o desmarca una parcela con lo que se siembra en ella (V4 §2.2). Desmarcar pierde lo
 * sembrado; marcar una ya marcada cambia su cultivo (lo sembrado sigue hasta cosecharse o perderse).
 */
export function markPlot(
  w: World,
  x: number,
  y: number,
  on: boolean,
  crop: CropKind = 'potato',
): void {
  const i = y * w.grid.width + x;
  if (!on) {
    w.plots = w.plots.filter((p) => p.tile !== i);
    return;
  }
  const p = plotAt(w, x, y);
  if (p) p.kind = crop;
  else if (canPlot(w, { x, y })) w.plots.push({ tile: i, kind: crop, crop: null, moisture: 0 });
}

/** Lo que se sembrará en esa casilla (contando las órdenes pendientes), o `null` si no es huerto. */
export function plotKindAt(w: World, x: number, y: number): CropKind | null {
  let kind = plotAt(w, x, y)?.kind ?? null;
  for (const o of w.orders)
    if (o.type === 'markPlot' && o.x === x && o.y === y) kind = o.on ? (o.crop ?? 'potato') : null;
  return kind;
}

/** ¿Está marcada (contando las órdenes pendientes)? */
export const plotMarked = (w: World, x: number, y: number): boolean => plotKindAt(w, x, y) !== null;
