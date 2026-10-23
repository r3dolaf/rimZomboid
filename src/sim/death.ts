// La muerte (spec H5 §8): el cuerpo con lo que llevaba, el ánimo de los demás, lo que se queda
// colgando (camas, parejas, cosas de dos, llevar en brazos, decisiones) y levantarse como zombi.
// También irse (y volver) y acabar con su sufrimiento (§7.4).
import {
  CORPSE_ROT_TICKS,
  DEATH_MOOD_MAX,
  DEATH_MOOD_MIN,
  DEATH_OPINION_MOOD,
  MEMORY_EFFECTS,
  MERCY_TICKS,
  RETURN_DAYS_MAX,
  RETURN_DAYS_MIN,
  RETURNED_OPINION,
  RISE_TICKS,
  SURVIVOR_WALK_SPEED,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  TURNED_RETURN_TICKS,
} from './balance';
import { armFactor, canWalk } from './body';
import { gameTime } from './clock';
import { seenByColony } from './danger';
import { addDecision } from './decisions';
import { addInto, emptyInventory } from './items';
import { dropCarried } from './jobs/heal';
import { assignBeds } from './jobs/medical';
import { logEvent } from './log';
import { findPath, regionOf } from './path/astar';
import { dropPile } from './piles';
import { nextInt } from './rng';
import { doorOutside, exitFor, leaveStrangers } from './systems/strangers';
import { walkStep } from './systems/movement';
import type {
  Action,
  Activity,
  Container,
  DeathCause,
  MemoryId,
  Returning,
  Survivor,
  World,
} from './types';
import { tileOf } from './world';
import { newZombie } from './zombies/spawn';

/** Un recuerdo de `otherId` para `o` (cada uno el suyo: dos muertes no se pisan). */
function remember(w: World, o: Survivor, id: MemoryId, otherId: number, value?: number): void {
  const expiresAt = w.tick + MEMORY_EFFECTS[id].hours * TICKS_PER_HOUR;
  o.memories.push(
    value === undefined ? { id, expiresAt, otherId } : { id, expiresAt, otherId, value },
  );
}

/** ¿Habla de `id` (con quién pelea, a quién consuela, venda, rescata…)? */
function mentions(x: Action | Activity, id: number): boolean {
  return (
    ('otherId' in x && x.otherId === id) ||
    ('patientId' in x && x.patientId === id) ||
    ('downedId' in x && x.downedId === id)
  );
}

const involves = (a: Action, id: number) =>
  mentions(a, id) || (a.type === 'moveTo' && a.then !== undefined && mentions(a.then, id));

/**
 * Los demás lo sienten (`id`; su pareja, `partnerId`, y se quedan sin pareja). Al morir, según
 * lo que pensaban de él.
 */
function mourn(w: World, gone: Survivor, id: 'died' | 'banished', partnerId: MemoryId): void {
  for (const o of w.survivors) {
    if (o === gone) continue;
    if (o.partnerId === gone.id) {
      o.partnerId = null;
      remember(w, o, partnerId, gone.id);
      continue;
    }
    if (id === 'banished') {
      remember(w, o, id, gone.id);
      continue;
    }
    const value = MEMORY_EFFECTS.died.value - (o.opinions[gone.id] ?? 0) * DEATH_OPINION_MOOD;
    remember(w, o, id, gone.id, Math.max(DEATH_MOOD_MIN, Math.min(DEATH_MOOD_MAX, value)));
  }
  gone.partnerId = null;
}

/** Su cuerpo, con lo que llevaba y su arma; el de un infectado (salvo si acabaron con él) se levanta. */
function leaveBody(w: World, s: Survivor, cause: DeathCause): void {
  const items = emptyInventory();
  addInto(items, s.carrying);
  if (s.equipped) items[s.equipped]++;
  const c: Container = {
    id: w.nextId++,
    houseId: -1,
    pos: tileOf(s.pos),
    kind: 'corpse',
    items,
    searched: false,
    designated: false,
    reservedBy: null,
    until: w.tick + CORPSE_ROT_TICKS,
    name: s.name,
  };
  if (s.infection && cause !== 'mercy') c.risesAt = w.tick + RISE_TICKS;
  w.containers.push(c);
}

/** Que nada se quede apuntando a `s` (cosas de dos, llevar en brazos, reservas, decisiones…). */
function detach(w: World, s: Survivor): void {
  if (s.carryingId !== null) dropCarried(w, s);
  for (const o of [...w.survivors, ...(w.stranger?.survivors ?? [])]) {
    if (o === s) continue;
    if (o.carryingId === s.id) o.carryingId = null;
    if (o.partnerId === s.id) o.partnerId = null; // también entre desconocidos
    if (involves(o.action, s.id)) {
      o.action = { type: 'idle', ticksLeft: 0 };
      o.path = [];
    }
  }
  for (const c of w.containers) if (c.reservedBy === s.id) c.reservedBy = null;
  for (const z of w.zombies) if (z.targetId === s.id) z.targetId = null;
  for (const d of w.decisions) d.survivorIds = d.survivorIds.filter((id) => id !== s.id);
  w.decisions = w.decisions.filter((d) => d.survivorIds.length > 0);
  w.mercy = w.mercy.filter((id) => id !== s.id);
}

/** Sale de la colonia: su cama, para otro. */
function leaveColony(w: World, s: Survivor): void {
  w.survivors.splice(w.survivors.indexOf(s), 1);
  const bed = w.beds.find((b) => b.ownerId === s.id);
  if (bed) bed.ownerId = null;
  s.bedId = null;
  assignBeds(w);
}

/** Muere `s` (colono o desconocido): sale del mundo y no queda nada apuntando a él. */
export function killSurvivor(w: World, s: Survivor, cause: DeathCause): void {
  const colonist = w.survivors.includes(s);
  const group = colonist ? w.survivors : w.stranger?.survivors;
  if (!group?.includes(s)) return;
  if (colonist) mourn(w, s, 'died', 'partnerDied');
  detach(w, s);
  for (const o of [...w.survivors, ...(w.stranger?.survivors ?? [])]) delete o.opinions[s.id];
  leaveBody(w, s, cause);
  if (!colonist) {
    group.splice(group.indexOf(s), 1);
    logEvent(w, { kind: 'strangerDied', names: [s.name] });
    if (w.stranger?.survivors.length === 0) w.stranger = null;
    return;
  }
  leaveColony(w, s);
  w.dead.push({ id: s.id, name: s.name, day: gameTime(w.tick).day, cause });
  logEvent(w, { kind: 'died', name: s.name, cause });
}

/**
 * Que se vaya (§7.4): deja lo que lleva y su arma en el almacén, deja de ser de la colonia y se
 * marcha a pie hacia el extremo de carretera más cercano.
 */
export function banish(w: World, s: Survivor): void {
  if (!w.survivors.includes(s)) return;
  addInto(w.storage.items, s.carrying);
  s.carrying = emptyInventory();
  if (s.equipped) w.storage.items[s.equipped]++;
  s.equipped = null;
  mourn(w, s, 'banished', 'partnerBanished');
  detach(w, s);
  leaveColony(w, s);
  s.drafted = false;
  const exit = exitFor(w, s);
  s.action = { type: 'moveTo', target: exit };
  s.path = findPath(w.grid, tileOf(s.pos), exit) ?? [];
  w.leaving.push(s);
  logEvent(w, { kind: 'banished', name: s.name });
}

/** Los que se van andan hasta el borde; al llegar, se apunta cuándo y cómo vuelven. */
function leavingSystem(w: World): void {
  for (const s of [...w.leaving]) {
    if (walkStep(s, w.grid, SURVIVOR_WALK_SPEED) === 'walking') continue;
    w.leaving = w.leaving.filter((x) => x !== s);
    const pos = tileOf(s.pos);
    const r: Returning = s.infection
      ? { kind: 'zombie', at: w.tick + TURNED_RETURN_TICKS, pos, name: s.name, survivorId: s.id }
      : {
          kind: 'stranger',
          at:
            w.tick +
            nextInt(w.rng, RETURN_DAYS_MIN * TICKS_PER_DAY, RETURN_DAYS_MAX * TICKS_PER_DAY),
          pos,
          survivor: s,
        };
    w.returning.push(r);
  }
}

/**
 * Vuelven: el infectado, como zombi que va derecho a la base; el de la gripe, a pedir entrar (si
 * no hay ya alguien a la puerta), con la opinión por los suelos.
 */
function returningSystem(w: World): void {
  for (const r of [...w.returning]) {
    if (w.tick < r.at) continue;
    if (r.kind === 'stranger' && (w.stranger !== null || w.over !== null)) continue;
    w.returning = w.returning.filter((x) => x !== r);
    if (r.kind === 'zombie') {
      const z = newZombie(w, r.pos);
      z.name = r.name;
      z.turnedFrom = r.survivorId;
      z.state = 'alert';
      z.goal = { ...w.base.door };
      z.lastSeenAt = w.tick;
      w.zombies.push(z);
      continue;
    }
    const s = r.survivor;
    s.fever = null;
    s.pos = { x: r.pos.x + 0.5, y: r.pos.y + 0.5 };
    const door = doorOutside(w);
    s.action = { type: 'moveTo', target: door };
    s.path = findPath(w.grid, r.pos, door) ?? [];
    for (const o of w.survivors) {
      o.opinions[s.id] = RETURNED_OPINION;
      s.opinions[o.id] = RETURNED_OPINION;
    }
    w.stranger = { survivors: [s], leaving: false };
    addDecision(w, 'stranger', [s.id]);
    logEvent(w, { kind: 'returned', name: s.name });
  }
}

/** Al ver al que echaron convertido en zombi, todos lo sienten (una vez). */
function turnedSystem(w: World): void {
  for (const z of w.zombies) {
    if (z.turnedFrom === undefined || !seenByColony(w, z)) continue;
    for (const o of w.survivors) remember(w, o, 'sawTurned', z.turnedFrom);
    logEvent(w, { kind: 'sawTurned', name: z.name ?? '?' });
    delete z.turnedFrom;
  }
}

/** ¿Puede acabar con el sufrimiento de alguien? En pie, con un brazo al menos y sin modo combate. */
const ableToMercy = (s: Survivor) => canWalk(s) && armFactor(s) > 0 && !s.drafted;

/** A quién va a acabar con su sufrimiento (o está en ello), o `null`. */
function mercyTargetId(s: Survivor): number | null {
  const a = s.action;
  if (a.type === 'mercy') return a.patientId;
  if (a.type === 'moveTo' && a.then?.type === 'mercy') return a.then.patientId;
  return null;
}

/**
 * Acabar con su sufrimiento (§7.4): va el colono más cercano que pueda (y llegue). `null`: ya está
 * en ello; `undefined`: no le toca.
 */
export function mercyDecision(s: Survivor, w: World): Action | null | undefined {
  if (mercyTargetId(s) !== null) return null;
  if (w.mercy.length === 0 || !ableToMercy(s)) return undefined;
  for (const id of w.mercy) {
    const p = w.survivors.find((x) => x.id === id);
    if (!p || p === s || w.survivors.some((o) => mercyTargetId(o) === id)) continue;
    const t = tileOf(p.pos);
    const region = regionOf(w.grid, t.x, t.y);
    const d2 = (o: Survivor) => (o.pos.x - p.pos.x) ** 2 + (o.pos.y - p.pos.y) ** 2;
    const reaches = (o: Survivor) => {
      const h = tileOf(o.pos);
      return regionOf(w.grid, h.x, h.y) === region;
    };
    const able = w.survivors.filter((o) => o !== p && ableToMercy(o) && reaches(o));
    const nearest = able.reduce<Survivor | null>((b, o) => (b && d2(b) <= d2(o) ? b : o), null);
    if (nearest === s) return { type: 'moveTo', target: t, then: { type: 'mercy', patientId: id } };
  }
  return undefined;
}

/** Al llegar junto a él, empieza (media hora). */
export function startMercy(s: Survivor, w: World, patientId: number): Action {
  const p = w.survivors.find((x) => x.id === patientId);
  const near = p && (p.pos.x - s.pos.x) ** 2 + (p.pos.y - s.pos.y) ** 2 <= 1.5 * 1.5;
  return near && w.mercy.includes(patientId)
    ? { type: 'mercy', patientId, ticksLeft: MERCY_TICKS }
    : { type: 'idle', ticksLeft: 0 };
}

/**
 * Acabando con su sufrimiento: al terminar, muere (el cuerpo no se levanta); quien lo hizo lo
 * lleva encima; si solo era una gripe, todos.
 */
export function mercyStep(w: World, s: Survivor): void {
  const a = s.action;
  if (a.type !== 'mercy') return;
  const p = w.survivors.find((x) => x.id === a.patientId);
  if (!p || (p.pos.x - s.pos.x) ** 2 + (p.pos.y - s.pos.y) ** 2 > 1.5 * 1.5) {
    s.action = { type: 'idle', ticksLeft: 0 };
    return;
  }
  if (--a.ticksLeft > 0) return;
  s.action = { type: 'idle', ticksLeft: 0 };
  const forNothing = p.infection === null;
  killSurvivor(w, p, 'mercy');
  remember(w, s, 'hadToKill', p.id);
  if (!forNothing) return;
  for (const o of w.survivors) remember(w, o, 'killedForNothing', p.id);
  logEvent(w, { kind: 'killedForNothing', name: p.name });
}

/** El cuerpo se levanta como zombi con su nombre; lo que llevaba queda en un montón. */
function rise(w: World, c: Container): void {
  w.containers = w.containers.filter((x) => x !== c);
  const searcher = w.survivors.find((s) => s.id === c.reservedBy);
  if (searcher) {
    searcher.action = { type: 'idle', ticksLeft: 0 };
    searcher.path = [];
  }
  dropPile(w, c.pos, c.items);
  const z = newZombie(w, c.pos);
  if (c.name !== undefined) z.name = c.name;
  w.zombies.push(z);
  logEvent(w, { kind: 'rose', name: c.name ?? '?' });
}

/**
 * Después de la salud: mueren los que tienen que morir; se levantan los cuerpos que toca; los que
 * se van andan y vuelven a su hora.
 */
export function deathSystem(w: World): void {
  for (const s of [...w.survivors, ...(w.stranger?.survivors ?? [])])
    if (s.dying) killSurvivor(w, s, s.dying);
  for (const c of w.containers.filter((x) => x.risesAt !== undefined && x.risesAt <= w.tick))
    rise(w, c);
  leavingSystem(w);
  returningSystem(w);
  turnedSystem(w);
  if (w.over === null && w.survivors.length === 0) endGame(w);
}

/** No queda nadie (H5 §9): se acaba la partida; el que esperaba a la puerta se va. */
function endGame(w: World): void {
  w.over = { tick: w.tick };
  if (w.stranger && !w.stranger.leaving) leaveStrangers(w);
  w.decisions = [];
  logEvent(w, { kind: 'colonyFell' });
}
