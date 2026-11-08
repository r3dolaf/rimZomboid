// El huerto (spec V1 §3): dónde va, marcar y desmarcar parcelas, y cómo crece lo sembrado.
import {
  GROW_HOURS,
  RAIN_MOISTURE_HOURS,
  RIPE_ROT_HOURS,
  TICKS_PER_HOUR,
  WATER_BELOW_HOURS,
  WITHER_DRY_HOURS,
} from './balance';
import { occupied } from './build';
import { logEvent } from './log';
import { getTile, inBounds } from './map/grid';
import { Tile, type Plot, type Point, type World } from './types';
import { isRaining } from './water';
import { indoors } from './zombies/spawn';

/** Vacía, creciendo o madura. */
export type CropStage = 'empty' | 'growing' | 'ripe';

export function cropStage(p: Plot): CropStage {
  if (!p.crop) return 'empty';
  return p.crop.grown >= GROW_HOURS ? 'ripe' : 'growing';
}

/** ¿Hay que regarla? Lo sembrado sin madurar con poca humedad. */
export const needsWater = (p: Plot): boolean =>
  cropStage(p) === 'growing' && p.moisture < WATER_BELOW_HOURS;

/**
 * Cada hora (V1 §3): la lluvia moja todo el huerto; lo húmedo crece y lo seco cuenta horas hasta
 * secarse; lo maduro cuenta horas hasta pudrirse. Lo perdido se apunta en el registro.
 */
export function farmSystem(w: World): void {
  if (w.mapId !== 0 || w.plots.length === 0 || w.tick % TICKS_PER_HOUR !== 0) return;
  const rain = isRaining(w);
  let dried = 0;
  let rotted = 0;
  for (const p of w.plots) {
    if (rain) p.moisture = RAIN_MOISTURE_HOURS;
    const wet = p.moisture > 0;
    p.moisture = Math.max(0, p.moisture - 1);
    const c = p.crop;
    if (!c) continue;
    if (c.grown >= GROW_HOURS) {
      if (++c.ripe >= RIPE_ROT_HOURS) {
        p.crop = null;
        rotted++;
      }
    } else if (wet) {
      c.grown++;
      c.dry = 0;
    } else if (++c.dry >= WITHER_DRY_HOURS) {
      p.crop = null;
      dried++;
    }
  }
  if (dried + rotted > 0) logEvent(w, { kind: 'cropsLost', dried, rotted });
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

/** Marca o desmarca una parcela. Desmarcar pierde lo sembrado. */
export function markPlot(w: World, x: number, y: number, on: boolean): void {
  const i = y * w.grid.width + x;
  if (!on) {
    w.plots = w.plots.filter((p) => p.tile !== i);
    return;
  }
  if (canPlot(w, { x, y })) w.plots.push({ tile: i, crop: null, moisture: 0 });
}

/** ¿Está marcada (contando las órdenes pendientes)? */
export function plotMarked(w: World, x: number, y: number): boolean {
  let on = plotAt(w, x, y) !== undefined;
  for (const o of w.orders) if (o.type === 'markPlot' && o.x === x && o.y === y) on = o.on;
  return on;
}
