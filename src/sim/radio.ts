// La radio (spec C1 §1–3): se construye en la base con una radio encontrada en un sitio, se carga con
// pilas y, encendida, se escucha: primero, que el ejército evacúa; luego, hacia dónde; por último,
// dónde y cuándo pasará el helicóptero (el punto de evacuación aparece en el mapa del mundo).
import {
  EVAC_DIST,
  EVAC_HINT_RADIUS,
  EVAC_HOUR,
  EVAC_LEAD_DAYS,
  EVAC_WAIT_HOURS,
  RADIO_CALL_CHANCE,
  RADIO_HEARD,
  TICKS_PER_HOUR,
} from './balance';
import { hexDistance, sideFrom } from './atlas/hex';
import { findRoute } from './atlas/route';
import { dayStart, gameTime } from './clock';
import { logEvent } from './log';
import { nextFloat, nextInt } from './rng';
import { addEvacSite, discoverSite, reveal } from './sites';
import type { Furniture, Rescue, World } from './types';

/** La radio de ese mapa, o `null`. */
export const radioOf = (w: World): Furniture | null =>
  w.furniture.find((f) => f.kind === 'radio') ?? null;

/** ¿Está encendida, contando lo pedido en pausa? (Para la interfaz.) */
export function radioOn(w: World): boolean {
  let on = radioOf(w)?.on ?? false;
  for (const o of w.orders) if (o.type === 'setRadio') on = o.on;
  return on;
}

/** Encender o apagar la radio de ese mapa (si la hay). */
export function setRadio(w: World, on: boolean): void {
  const r = radioOf(w);
  if (r) r.on = on;
}

/** Lo que se sabe del rescate (lo crea la primera vez, sin nada escuchado). */
export function rescueOf(w: World): Rescue {
  w.common.rescue ??= {
    heard: 0,
    stage: 0,
    hex: null,
    siteId: null,
    from: null,
    until: null,
    landed: false,
    boarded: [],
  };
  return w.common.rescue;
}

/**
 * El hexágono del punto de evacuación (§3): a 9–13 de la base, en tierra, sin otro sitio y con ruta;
 * si no hay ninguno así, cualquiera en tierra más lejos que los sitios, con ruta. `null` si nada.
 */
function evacHex(w: World): number | null {
  const { atlas, expedition: ex } = w.common;
  const taken = new Set(ex.sites.map((x) => x.hex));
  const all = Array.from({ length: atlas.width * atlas.height }, (_, i) => i).filter(
    (i) => atlas.terrain[i] !== 'water' && !taken.has(i) && i !== atlas.base,
  );
  const near = (i: number) => {
    const d = hexDistance(atlas, atlas.base, i);
    return d >= EVAC_DIST[0] && d <= EVAC_DIST[1];
  };
  // Al azar hasta dar con uno con ruta (sin buscar la ruta de todos: sería un tirón).
  for (const list of [all.filter(near), all.filter((i) => hexDistance(atlas, atlas.base, i) > 4)])
    while (list.length > 0) {
      const k = nextInt(ex.rng, 0, list.length - 1);
      const i = list[k]!;
      if (findRoute(atlas, atlas.base, i) !== null) return i;
      list.splice(k, 1);
    }
  return null;
}

/** Lo que se oye al llegar a cada número de horas escuchadas (§2). */
function hear(w: World, r: Rescue): void {
  const { atlas } = w.common;
  if (r.stage === 0 && r.heard >= RADIO_HEARD[0]) {
    r.stage = 1;
    logEvent(w, { kind: 'radioNews' });
  }
  if (r.stage === 1 && r.heard >= RADIO_HEARD[1]) {
    const hex = evacHex(w);
    if (hex === null) return;
    r.stage = 2;
    r.hex = hex;
    reveal(w, hex, EVAC_HINT_RADIUS, 'radio');
    const side = sideFrom(atlas, atlas.base, hex);
    logEvent(w, { kind: 'radioDirection', side, dist: hexDistance(atlas, atlas.base, hex) });
  }
  if (r.stage === 2 && r.heard >= RADIO_HEARD[2] && r.hex !== null) {
    const info = addEvacSite(w, r.hex);
    const day = gameTime(w.tick).day + EVAC_LEAD_DAYS;
    r.stage = 3;
    r.siteId = info.id;
    r.from = dayStart(day) + EVAC_HOUR * TICKS_PER_HOUR;
    r.until = r.from + EVAC_WAIT_HOURS * TICKS_PER_HOUR;
    logEvent(w, { kind: 'radioEvac', day, hours: info.hours });
  }
}

/** Truco de depuración (H6c): oírlo todo de golpe, hasta saber dónde y cuándo. */
export function hearAll(base: World): void {
  const r = rescueOf(base);
  r.heard = Math.max(r.heard, RADIO_HEARD[2]);
  hear(base, r);
}

/**
 * Cada hora, en la base (§2): la radio encendida y con carga gasta una hora; cuenta como escuchada
 * hasta saber dónde y cuándo, y a veces se oye una llamada que descubre un sitio oculto.
 */
export function radioSystem(base: World): void {
  if (base.mapId !== 0 || base.tick % TICKS_PER_HOUR !== 0 || base.common.over) return;
  const radio = radioOf(base);
  if (!radio?.on || (radio.fuel ?? 0) <= 0) return;
  radio.fuel = Math.max(0, radio.fuel! - 1);
  const r = rescueOf(base);
  if (r.stage < 3) {
    r.heard++;
    hear(base, r);
  }
  if (nextFloat(base.common.expedition.rng) < RADIO_CALL_CHANCE)
    discoverSite(base, { how: 'radio' });
}
