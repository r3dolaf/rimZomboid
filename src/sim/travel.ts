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
  EXPLORE_SECOND_BASE,
  EXPLORE_SECOND_PER_LEVEL,
  EXPLORE_WOUND,
  TICKS_PER_HOUR,
  TRAVEL_DAY,
} from './balance';
import { has, spend, wornBags } from './bags';
import { bloodTick } from './blood';
import { gameTime } from './clock';
import { piecesGone } from './clothes';
import { exitTile } from './expeditions';
import { WEAPONS } from './jobs/weapons';
import { logEvent } from './log';
import { catchUp, discoverSite, siteMap } from './sites';
import { addWound, BODY_PARTS } from './body';
import { nextFloat, pick } from './rng';
import type { DeathCause, Point, Survivor, Travel, World } from './types';

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** Los viajes de todo el juego, desde la base: avanzan de día y llegan. */
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
    if (t.hoursLeft <= 1e-9) arrive(base, t);
  }
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

/** Llegan: al sitio (que se crea o se despierta) o a la base, por el borde de su lado. */
export function arrive(base: World, t: Travel): void {
  const ex = base.common.expedition;
  ex.travels = ex.travels.filter((x) => x !== t);
  const names = t.members.map((s) => s.name);
  if (t.kind === 'go') {
    const info = ex.sites.find((x) => x.id === t.siteId);
    if (!info || info.state !== 'known') {
      // El sitio se ha perdido por el camino: se vuelven.
      ex.travels.push({ ...t, kind: 'back', hoursLeft: info?.hours ?? 1 });
      return;
    }
    const w = siteMap(base, info);
    if (w.survivors.length === 0) catchUp(w, info, base.tick); // lo que pasó sin nadie (§2)
    info.visited = true;
    info.leftAt = null;
    enterMap(w, t.members, exitTile(w, info.side));
    const { kind, special, side, hours } = info;
    logEvent(w, { kind: 'expeditionArrived', site: { kind, special, side, hours }, names });
    return;
  }
  enterMap(base, t.members, exitTile(base, t.side));
  logEvent(base, { kind: 'expeditionArrived', site: null, names });
  if (t.kind === 'explore') exploreFindings(base, t);
}

/** Al volver de explorar (§3): 1 o 2 sitios de ese lado, y a veces una herida. */
function exploreFindings(base: World, t: Travel): void {
  const rng = base.common.expedition.rng;
  const first = t.members[0];
  const by = first ? { survivorId: first.id } : {};
  discoverSite(base, { how: 'explore', side: t.side, ...by });
  const best = Math.max(0, ...t.members.map((s) => s.skills.loot.level));
  if (nextFloat(rng) < EXPLORE_SECOND_BASE + EXPLORE_SECOND_PER_LEVEL * best)
    discoverSite(base, { how: 'explore', side: t.side, ...by });
  const chance = t.members.length === 1 ? EXPLORE_WOUND.alone : EXPLORE_WOUND.pair;
  for (const s of t.members)
    if (nextFloat(rng) < chance)
      addWound(base, s, pick(rng, BODY_PARTS), nextFloat(rng) < 0.5 ? 'scratch' : 'cut');
}
