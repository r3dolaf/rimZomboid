// Los colonos pelean con los zombis (spec H4b §6.1): golpes según el arma y matar.
import { carriesSomething, dropHandBag } from './bags';
import {
  HEAD_HIT_CHANCE,
  NOISE,
  RUN_NOISE_TICKS,
  SURVIVOR_REACH,
  SURVIVOR_RUN_SPEED,
  HAND_BAG_DAMAGE,
  HAND_BAG_HIT,
  WEAPON_HANDS,
  WEAPON_STATS,
} from './balance';
import { leaveCorpse } from './corpses';
import { logEvent } from './log';
import { makeNoise } from './noise';
import { findPath } from './path/astar';
import { nextFloat } from './rng';
import { hitChance, practice } from './skills';
import { walkStep } from './systems/movement';
import type { Survivor, World, Zombie } from './types';
import { tileOf } from './world';

/**
 * Lo que acierta y el daño de su golpe: según Pelear (y los brazos) y el arma; con una bolsa en la
 * mano, el bate y la palanca van con una mano, peor (H5b2 §4).
 */
export function weaponHit(s: Survivor): { chance: number; damage: number } {
  const weapon = s.equipped ?? 'none';
  const oneHanded = s.bags.hand !== null && WEAPON_HANDS[weapon] === 'either';
  return {
    chance: hitChance(s.skills.fight.level, s) * (oneHanded ? HAND_BAG_HIT : 1),
    damage: WEAPON_STATS[weapon].damage * (oneHanded ? HAND_BAG_DAMAGE : 1),
  };
}

/** Un golpe a un zombi: puede fallar; 1 de cada 6 aciertos, a la cabeza (doble). Se oye siempre. */
export function colonistHit(w: World, s: Survivor, z: Zombie): void {
  makeNoise(w, s.pos, NOISE.fightHit);
  // Se aprende con cada golpe, acierte o no (spec H4c §4); acierta según Pelear (§3.6). Lo de los
  // desconocidos (H4e) no se apunta.
  const colonist = w.survivors.includes(s);
  if (colonist) practice(w, s, 'fight', WEAPON_STATS[s.equipped ?? 'none'].ticks);
  const hit = weaponHit(s);
  if (nextFloat(w.rng) >= hit.chance) return;
  const head = nextFloat(w.rng) < HEAD_HIT_CHANCE;
  z.health -= hit.damage * (head ? 2 : 1);
  if (z.health > 0) return;
  w.zombies = w.zombies.filter((x) => x !== z);
  leaveCorpse(w, z); // H4d
  if (!colonist) return;
  w.common.stats.kills++;
  logEvent(w, { kind: 'zombieKilled', survivorId: s.id });
}

/** Quien pelea con un zombi: si lo tiene al lado, le golpea; si no, va corriendo hacia él. */
export function combatSystem(w: World): void {
  // También los desconocidos (H4e), que se defienden.
  const fighters = w.stranger ? [...w.survivors, ...w.stranger.survivors] : w.survivors;
  for (const s of fighters) {
    const a = s.action;
    if (a.type !== 'melee') continue;
    const z = w.zombies.find((x) => x.id === a.zombieId);
    if (!z) {
      s.action = { type: 'idle', ticksLeft: 0 };
      s.path = [];
      continue;
    }
    // Con el hacha de talar (de dos manos) suelta la bolsa de la mano (H5b2 §4).
    if (s.bags.hand && s.equipped === 'axe') dropHandBag(w, s);
    if (a.cooldown > 0) a.cooldown--;
    const d2 = (z.pos.x - s.pos.x) ** 2 + (z.pos.y - s.pos.y) ** 2;
    if (d2 <= SURVIVOR_REACH * SURVIVOR_REACH) {
      s.path = [];
      if (a.cooldown > 0) continue;
      a.cooldown = WEAPON_STATS[s.equipped ?? 'none'].ticks;
      colonistHit(w, s, z);
      if (!w.zombies.includes(z)) s.action = { type: 'idle', ticksLeft: 0 };
      continue;
    }
    // En modo combate, quieto (H4e): si se aleja, no lo persigue.
    if (a.hold) {
      s.action = { type: 'idle', ticksLeft: 0 };
      s.path = [];
      continue;
    }
    // Hacia el zombi, rehaciendo el camino cuando cambia de casilla.
    const zt = tileOf(z.pos);
    const end = s.path.at(-1);
    if (!end || end.x !== zt.x || end.y !== zt.y) {
      const path = findPath(w.grid, tileOf(s.pos), zt);
      if (!path) {
        s.action = { type: 'idle', ticksLeft: 0 };
        s.path = [];
        continue;
      }
      s.path = path;
    }
    const step = walkStep(s, w.grid, SURVIVOR_RUN_SPEED);
    if (step === 'walking' && carriesSomething(s)) practice(w, s, 'haul', 1);
    if (step === 'walking' && w.tick % RUN_NOISE_TICKS === 0) makeNoise(w, s.pos, NOISE.run);
  }
}
