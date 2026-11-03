// La tirada del camino (spec H5c3 §1): al entrar en un hexágono, si pasa algo y qué, según sus horas,
// el narrador, el respiro y el terreno. Con el azar de las expediciones.
import {
  COLONY_MAX,
  ROAD_EVENT_GAP,
  ROAD_EVENT_PER_HOUR,
  ROAD_STYLE,
  ROAD_TOWN_BONUS,
  ROAD_WEIGHTS,
  TICKS_PER_HOUR,
} from '../balance';
import { hexesWithin } from '../atlas/hex';
import { hexHours } from '../atlas/route';
import { nextFloat } from '../rng';
import type { RoadKind, Travel, World } from '../types';

const KINDS: readonly RoadKind[] = ['zombies', 'horde', 'loot', 'joiner', 'forage'];

/** Cuántos colonos hay en todo el juego: en los mapas y de viaje. */
export function colonySize(base: World): number {
  return (
    base.survivors.length +
    base.siteMaps.reduce((n, m) => n + m.world.survivors.length, 0) +
    base.common.expedition.travels.reduce((n, t) => n + t.members.length, 0)
  );
}

/** La probabilidad de que pase algo al entrar en `hex` (0 durante el respiro). */
export function roadChance(base: World, t: Travel, hex: number): number {
  if (t.nextEventAt !== undefined && base.tick < t.nextEventAt) return 0;
  const hours = hexHours(base.common.atlas, hex);
  if (!Number.isFinite(hours)) return 0;
  return Math.min(1, ROAD_EVENT_PER_HOUR * hours * ROAD_STYLE[base.narrator.style]);
}

/** Lo que puede tocar en `hex`, con su peso. */
export function roadWeights(base: World, t: Travel, hex: number): Record<RoadKind, number> {
  const { atlas } = base.common;
  const ground = atlas.road[hex] === 1 ? 'road' : atlas.terrain[hex]!;
  const w: Record<RoadKind, number> = { ...ROAD_WEIGHTS[ground === 'water' ? 'road' : ground] };
  if (hexesWithin(atlas, hex, 1).some((i) => atlas.town[i] === 1)) {
    w.zombies += ROAD_TOWN_BONUS.zombies;
    w.horde += ROAD_TOWN_BONUS.horde;
  }
  // Nada que pida respuesta mientras se espera otra, ni al llegar (salvo a la zona a explorar).
  const last = t.at >= t.path.length - 1 && !(t.kind === 'explore' && !t.explored);
  if (t.waiting !== undefined || t.joiner || last) {
    w.horde = 0;
    w.joiner = 0;
  }
  if (t.joiner || colonySize(base) >= COLONY_MAX) w.joiner = 0;
  return w;
}

/** La tirada al entrar en `hex`: lo que pasa (y empieza el respiro) o `null`. */
export function rollRoad(base: World, t: Travel, hex: number): RoadKind | null {
  const rng = base.common.expedition.rng;
  if (nextFloat(rng) >= roadChance(base, t, hex)) return null;
  const w = roadWeights(base, t, hex);
  const total = KINDS.reduce((n, k) => n + w[k], 0);
  if (total <= 0) return null;
  let r = nextFloat(rng) * total;
  const kind = KINDS.find((k) => (r -= w[k]) < 0) ?? KINDS.at(-1)!;
  t.nextEventAt = base.tick + ROAD_EVENT_GAP * TICKS_PER_HOUR;
  return kind;
}
