// Lo que pasa por el camino (spec H5c3 §2): zombis sueltos, botín abandonado y buscar comida, al
// entrar en un hexágono. (La horda y quien pide unirse, con decisión.) Con el azar de las expediciones.
import { ROAD_FIGHT, ROAD_FORAGE, ROAD_LOOT, ROAD_ZOMBIES } from '../balance';
import { stashOne } from '../bags';
import { addWound, BODY_PARTS } from '../body';
import { WEAPONS } from '../jobs/weapons';
import type { ItemKind } from '../items';
import { logEvent } from '../log';
import { nextFloat, nextInt, pick } from '../rng';
import { practice } from '../skills';
import { startHorde } from './horde';
import { startJoiner } from './joiner';
import type { Atlas, RoadGround, RoadKind, Survivor, Travel, World } from '../types';

/** El terreno de `hex` para los sucesos (la carretera o un puente, «road»). */
export function roadGround(atlas: Atlas, hex: number): RoadGround {
  const t = atlas.terrain[hex]!;
  return atlas.road[hex] === 1 || t === 'water' ? 'road' : t;
}

/** El riesgo de salir herido al pelear con `zombies` zombis entre `people`. */
export function fightRisk(s: Survivor, zombies: number, people: number): number {
  const f = ROAD_FIGHT;
  const risk =
    (f.base * zombies) / Math.max(1, people) -
    f.perLevel * s.skills.fight.level -
    (s.equipped ? f.armed : 0);
  return Math.min(f.max, Math.max(f.min, risk));
}

/** Pelean con `n` zombis: cada uno puede salir herido (arañazo o mordisco); todos practican. */
export function roadZombies(base: World, t: Travel, hex: number, n: number, horde = false): void {
  const rng = base.common.expedition.rng;
  const hurt: { name: string; wound: 'scratch' | 'bite' }[] = [];
  for (const s of t.members) {
    practice(base, s, 'fight', ROAD_FIGHT.xp);
    if (nextFloat(rng) >= fightRisk(s, n, t.members.length)) continue;
    const wound = nextFloat(rng) < ROAD_FIGHT.bite ? 'bite' : 'scratch';
    addWound(base, s, pick(rng, BODY_PARTS), wound);
    hurt.push({ name: s.name, wound });
  }
  logEvent(base, {
    kind: 'roadZombies',
    names: t.members.map((s) => s.name),
    zombies: n,
    hurt,
    ground: roadGround(base.common.atlas, hex),
    ...(horde ? { horde: true } : {}),
  });
}

/** Algo del botín, según su peso. */
function lootKind(base: World): ItemKind {
  const rng = base.common.expedition.rng;
  const total = ROAD_LOOT.kinds.reduce((n, [, w]) => n + w, 0);
  let r = nextFloat(rng) * total;
  return (ROAD_LOOT.kinds.find(([, w]) => (r -= w) < 0) ?? ROAD_LOOT.kinds.at(-1)!)[0];
}

/** Un coche (en la carretera) o una casa abandonada: 1–3 cosas para quien tenga sitio. */
export function roadLoot(base: World, t: Travel, hex: number): void {
  const rng = base.common.expedition.rng;
  const items: Partial<Record<ItemKind, number>> = {};
  let left = false;
  for (let i = nextInt(rng, ROAD_LOOT.count[0], ROAD_LOOT.count[1]); i > 0; i--) {
    const k = lootKind(base);
    if (!t.members.some((s) => stashOne(s, k))) {
      left = true;
      continue;
    }
    items[k] = (items[k] ?? 0) + 1;
    if ((WEAPONS as readonly ItemKind[]).includes(k)) base.common.weaponLog.fromSites++;
  }
  logEvent(base, {
    kind: 'roadLoot',
    names: t.members.map((s) => s.name),
    car: base.common.atlas.road[hex] === 1,
    items,
    left,
  });
}

/** Buscan comida por el campo o el bosque: 1 o 2 latas, para quien más hambre tenga (y sitio). */
export function roadForage(base: World, t: Travel, hex: number): void {
  const rng = base.common.expedition.rng;
  const hungry = [...t.members].sort((a, b) => a.needs.hunger - b.needs.hunger);
  let food = 0;
  for (let i = nextInt(rng, ROAD_FORAGE[0], ROAD_FORAGE[1]); i > 0; i--)
    if (hungry.some((s) => stashOne(s, 'food'))) food++;
  if (food === 0) return;
  logEvent(base, {
    kind: 'roadForage',
    names: t.members.map((s) => s.name),
    food,
    ground: roadGround(base.common.atlas, hex),
  });
}

/** Lo que pasa al entrar en `hex`. */
export function roadEvent(base: World, t: Travel, hex: number, kind: RoadKind): void {
  const rng = base.common.expedition.rng;
  if (kind === 'horde') startHorde(base, t);
  else if (kind === 'joiner') startJoiner(base, t);
  else if (kind === 'zombies')
    roadZombies(base, t, hex, nextInt(rng, ROAD_ZOMBIES[0], ROAD_ZOMBIES[1]));
  else if (kind === 'loot') roadLoot(base, t, hex);
  else if (kind === 'forage') roadForage(base, t, hex);
}
