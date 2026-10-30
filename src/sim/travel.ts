// De viaje (spec H5c1 §4): solo se avanza de día (de 6 a 20 h) y de noche acampan; tienen hambre y
// sueño, comen y se vendan con lo suyo, sangran y pueden morir; al llegar, entran en el sitio (o en
// la base) por el borde de su lado.
import {
  BANDAGE_CLEAN_HOURS,
  EAT_BELOW,
  EAT_RESTORE,
  FLOOR_SLEEP_FACTOR,
  HUNGER_PER_TICK,
  SLEEP_DRAIN_PER_TICK,
  SLEEP_GAIN_PER_TICK,
  EXPLORE_RADIUS,
  EXPLORE_WOUND,
  TICKS_PER_HOUR,
  TRAVEL_DAY,
  TRAVEL_SEEN,
} from './balance';
import { has, spend, wornBags } from './bags';
import { bloodTick } from './blood';
import { gameTime } from './clock';
import { piecesGone } from './clothes';
import { exitTile } from './expeditions';
import { WEAPONS } from './jobs/weapons';
import { logEvent } from './log';
import { catchUp, reveal, siteMap } from './sites';
import { sideFrom } from './atlas/hex';
import { findRoute, hexHours } from './atlas/route';
import { addWound, BODY_PARTS } from './body';
import { nextFloat, pick } from './rng';
import type { DeathCause, MapSide, Point, Survivor, Travel, World } from './types';

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** Los viajes de todo el juego, desde la base: avanzan de día, hexágono a hexágono, y llegan. */
export function travelSystem(base: World): void {
  const hour = gameTime(base.tick).hour;
  const day = hour >= TRAVEL_DAY[0] && hour < TRAVEL_DAY[1];
  for (const t of [...base.common.expedition.travels]) {
    if (t.pending.length > 0 || t.members.length === 0) continue;
    for (const s of [...t.members]) travelerTick(base, t, s, !day);
    if (t.members.length === 0) {
      base.common.expedition.travels = base.common.expedition.travels.filter((x) => x !== t);
      continue;
    }
    if (!day) continue;
    t.hoursLeft -= 1 / TICKS_PER_HOUR;
    while (t.hoursLeft <= 1e-9 && base.common.expedition.travels.includes(t)) step(base, t);
  }
}

/**
 * Entran en el siguiente hexágono de la ruta (y despejan alrededor); si es agua sin puente, rehacen
 * la ruta desde donde están (H5c2 §4). Al final de la ruta, llegan.
 */
function step(base: World, t: Travel): void {
  const { atlas } = base.common;
  if (t.at >= t.path.length - 1) return arrive(base, t);
  const next = t.path[t.at + 1]!;
  if (!Number.isFinite(hexHours(atlas, next))) {
    atlas.seen[next] = 1;
    return reroute(base, t);
  }
  t.at++;
  reveal(base, next, TRAVEL_SEEN, 'seen', t.members[0]?.id);
  if (t.at >= t.path.length - 1) return arrive(base, t);
  const after = t.path[t.at + 1]!;
  const h = hexHours(atlas, after);
  if (!Number.isFinite(h)) {
    atlas.seen[after] = 1;
    return reroute(base, t);
  }
  t.hoursLeft += h;
}

/** Rehacen la ruta a su destino desde donde están; si no hay, vuelven a la base. */
function reroute(base: World, t: Travel): void {
  const { atlas } = base.common;
  const here = t.path[t.at]!;
  let path = findRoute(atlas, here, t.target);
  if (!path) {
    t.kind = 'back';
    t.siteId = null;
    t.target = atlas.base;
    t.explored = undefined;
    path = findRoute(atlas, here, atlas.base) ?? [...t.path.slice(0, t.at + 1)].reverse();
  }
  t.path = path;
  t.at = 0;
  t.waypoints = [];
  t.hoursLeft =
    path.length > 1
      ? Number.isFinite(hexHours(atlas, path[1]!))
        ? hexHours(atlas, path[1]!)
        : 1
      : 0;
}

/** Un tick de viaje de alguien: hambre, sueño, comer y vendarse con lo suyo, sangre, morir. */
function travelerTick(base: World, t: Travel, s: Survivor, night: boolean): void {
  const n = s.needs;
  n.hunger = clamp(n.hunger - HUNGER_PER_TICK);
  if (night) {
    s.action = { type: 'sleep', inBed: false };
    n.sleep = clamp(n.sleep + SLEEP_GAIN_PER_TICK * FLOOR_SLEEP_FACTOR);
  } else {
    s.action = { type: 'idle', ticksLeft: 0 };
    n.sleep = clamp(n.sleep - SLEEP_DRAIN_PER_TICK);
  }
  if (n.hunger < EAT_BELOW && spend(s, 'food') === 1) n.hunger = clamp(n.hunger + EAT_RESTORE);
  const bleeding = s.wounds.find((wd) => wd.bleeding);
  if (bleeding && has(s, 'bandage') > 0) {
    spend(s, 'bandage');
    bleeding.bleeding = false;
    bleeding.cleanUntil = base.tick + BANDAGE_CLEAN_HOURS * TICKS_PER_HOUR;
  }
  bloodTick(base, s);
  if (s.infection && base.tick >= s.infection.deathAt) s.dying ??= 'infection';
  if (s.dying) roadDeath(base, t, s, s.dying);
}

/** Muere por el camino: se pierde con todo lo que llevaba (en las cuentas); los demás se enteran. */
function roadDeath(base: World, t: Travel, s: Survivor, cause: DeathCause): void {
  t.members = t.members.filter((x) => x !== s);
  const c = base.common;
  piecesGone(base, [...s.worn, ...s.carrying.pieces, ...wornBags(s)]);
  c.woodLog.wasted += s.carrying.wood;
  c.weaponLog.rotted += WEAPONS.reduce((k, w) => k + s.carrying[w], 0) + (s.equipped ? 1 : 0);
  // Su pareja, su cama y el duelo, en todos los mapas: al final del tick (`farewellsSystem`).
  s.bedId = null;
  s.partnerId = null;
  c.departed.push({ id: s.id, how: 'died', mapId: null });
  c.dead.push({ id: s.id, name: s.name, day: gameTime(base.tick).day, cause });
  logEvent(base, { kind: 'died', name: s.name, cause });
}

/** Entran en `w` por la casilla `at`, sin nada que hacer. */
function enterMap(w: World, members: Survivor[], at: Point): void {
  for (const s of members) {
    s.pos = { x: at.x + 0.5, y: at.y + 0.5 };
    s.action = { type: 'idle', ticksLeft: 0 };
    s.path = [];
    w.survivors.push(s);
  }
}

/** El lado del mapa por el que entran: el que da al hexágono del que vienen. */
function arrivalSide(base: World, t: Travel): MapSide {
  const { atlas } = base.common;
  const here = t.path[t.at]!;
  const prev = t.path[t.at - 1];
  return prev === undefined ? 1 : sideFrom(atlas, here, prev);
}

/** Llegan: al sitio (que se crea o se despierta), a la zona a explorar o a la base. */
export function arrive(base: World, t: Travel): void {
  const ex = base.common.expedition;
  const names = t.members.map((s) => s.name);
  if (t.kind === 'explore' && !t.explored) return exploreHere(base, t);
  if (t.kind === 'go') {
    const info = ex.sites.find((x) => x.id === t.siteId);
    if (!info || info.state !== 'known') {
      // El sitio se ha perdido por el camino: se vuelven a la base.
      t.siteId = null;
      t.target = base.common.atlas.base;
      t.kind = 'back';
      return reroute(base, t);
    }
    ex.travels = ex.travels.filter((x) => x !== t);
    const w = siteMap(base, info);
    if (w.survivors.length === 0) catchUp(w, info, base.tick); // lo que pasó sin nadie (§2)
    info.visited = true;
    info.leftAt = null;
    enterMap(w, t.members, exitTile(w, arrivalSide(base, t)));
    const { kind, special, side, hours } = info;
    logEvent(w, { kind: 'expeditionArrived', site: { kind, special, side, hours }, names });
    return;
  }
  ex.travels = ex.travels.filter((x) => x !== t);
  enterMap(base, t.members, exitTile(base, arrivalSide(base, t)));
  logEvent(base, { kind: 'expeditionArrived', site: null, names });
}

/**
 * Al llegar a la zona a explorar (H5c2 §3): despejan alrededor (y descubren los sitios), a veces se
 * hacen un arañazo o un corte, y vuelven a la base.
 */
function exploreHere(base: World, t: Travel): void {
  const rng = base.common.expedition.rng;
  reveal(base, t.target, EXPLORE_RADIUS, 'explore', t.members[0]?.id);
  const chance = t.members.length === 1 ? EXPLORE_WOUND.alone : EXPLORE_WOUND.pair;
  for (const s of t.members)
    if (nextFloat(rng) < chance)
      addWound(base, s, pick(rng, BODY_PARTS), nextFloat(rng) < 0.5 ? 'scratch' : 'cut');
  t.explored = true;
  t.target = base.common.atlas.base;
  reroute(base, t);
}
