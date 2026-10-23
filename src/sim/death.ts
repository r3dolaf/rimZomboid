// La muerte (spec H5 §8): el cuerpo con lo que llevaba, el ánimo de los demás, lo que se queda
// colgando (camas, parejas, cosas de dos, llevar en brazos, decisiones) y levantarse como zombi.
import {
  CORPSE_ROT_TICKS,
  DEATH_MOOD_MAX,
  DEATH_MOOD_MIN,
  DEATH_OPINION_MOOD,
  MEMORY_EFFECTS,
  RISE_TICKS,
  TICKS_PER_HOUR,
} from './balance';
import { gameTime } from './clock';
import { addInto, emptyInventory } from './items';
import { dropCarried } from './jobs/heal';
import { assignBeds } from './jobs/medical';
import { logEvent } from './log';
import { dropPile } from './piles';
import type { Action, Activity, Container, DeathCause, Survivor, World } from './types';
import { tileOf } from './world';
import { newZombie } from './zombies/spawn';

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

/** "Ha muerto Ana": según lo que pensaba de él; a su pareja, más (y se queda sin pareja). */
function grieve(w: World, dead: Survivor): void {
  const until = (hours: number) => w.tick + hours * TICKS_PER_HOUR;
  for (const o of w.survivors) {
    if (o === dead) continue;
    if (o.partnerId === dead.id) {
      o.partnerId = null;
      const expiresAt = until(MEMORY_EFFECTS.partnerDied.hours);
      o.memories.push({ id: 'partnerDied', expiresAt, otherId: dead.id });
      continue;
    }
    const value = MEMORY_EFFECTS.died.value - (o.opinions[dead.id] ?? 0) * DEATH_OPINION_MOOD;
    o.memories.push({
      id: 'died',
      expiresAt: until(MEMORY_EFFECTS.died.hours),
      otherId: dead.id,
      value: Math.max(DEATH_MOOD_MIN, Math.min(DEATH_MOOD_MAX, value)),
    });
  }
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

/** Muere `s` (colono o desconocido): sale del mundo y no queda nada apuntando a él. */
export function killSurvivor(w: World, s: Survivor, cause: DeathCause): void {
  const colonist = w.survivors.includes(s);
  const group = colonist ? w.survivors : w.stranger?.survivors;
  if (!group?.includes(s)) return;
  if (s.carryingId !== null) dropCarried(w, s);
  if (colonist) grieve(w, s);
  for (const o of [...w.survivors, ...(w.stranger?.survivors ?? [])]) {
    if (o === s) continue;
    if (o.carryingId === s.id) o.carryingId = null;
    if (involves(o.action, s.id)) {
      o.action = { type: 'idle', ticksLeft: 0 };
      o.path = [];
    }
    delete o.opinions[s.id];
  }
  for (const c of w.containers) if (c.reservedBy === s.id) c.reservedBy = null;
  for (const z of w.zombies) if (z.targetId === s.id) z.targetId = null;
  for (const d of w.decisions) d.survivorIds = d.survivorIds.filter((id) => id !== s.id);
  w.decisions = w.decisions.filter((d) => d.survivorIds.length > 0);
  leaveBody(w, s, cause);
  group.splice(group.indexOf(s), 1);
  if (!colonist) {
    logEvent(w, { kind: 'strangerDied', names: [s.name] });
    if (w.stranger?.survivors.length === 0) w.stranger = null;
    return;
  }
  const bed = w.beds.find((b) => b.ownerId === s.id);
  if (bed) bed.ownerId = null;
  assignBeds(w);
  w.dead.push({ id: s.id, name: s.name, day: gameTime(w.tick).day, cause });
  logEvent(w, { kind: 'died', name: s.name, cause });
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

/** Después de la salud: mueren los que tienen que morir; se levantan los cuerpos que toca. */
export function deathSystem(w: World): void {
  for (const s of [...w.survivors, ...(w.stranger?.survivors ?? [])])
    if (s.dying) killSurvivor(w, s, s.dying);
  for (const c of w.containers.filter((x) => x.risesAt !== undefined && x.risesAt <= w.tick))
    rise(w, c);
}
