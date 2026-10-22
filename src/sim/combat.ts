// Los colonos pelean con los zombis (spec H4b §6.1): golpes según el arma y matar.
import {
  HEAD_HIT_CHANCE,
  NOISE,
  RUN_NOISE_TICKS,
  SURVIVOR_REACH,
  SURVIVOR_RUN_SPEED,
  WEAPON_STATS,
} from './balance';
import { leaveCorpse } from './corpses';
import { weightOf } from './items';
import { logEvent } from './log';
import { makeNoise } from './noise';
import { findPath } from './path/astar';
import { nextFloat } from './rng';
import { hitChance, practice } from './skills';
import { walkStep } from './systems/movement';
import type { Survivor, World, Zombie } from './types';
import { tileOf } from './world';

/** Un golpe a un zombi: puede fallar; 1 de cada 6 aciertos, a la cabeza (doble). Se oye siempre. */
export function colonistHit(w: World, s: Survivor, z: Zombie): void {
  makeNoise(w, s.pos, NOISE.fightHit);
  // Se aprende con cada golpe, acierte o no (spec H4c §4); acierta según Pelear (§3.6). Lo de los
  // desconocidos (H4e) no se apunta.
  const colonist = w.survivors.includes(s);
  if (colonist) practice(w, s, 'fight', WEAPON_STATS[s.equipped ?? 'none'].ticks);
  if (nextFloat(w.rng) >= hitChance(s.skills.fight.level)) return;
  const head = nextFloat(w.rng) < HEAD_HIT_CHANCE;
  z.health -= WEAPON_STATS[s.equipped ?? 'none'].damage * (head ? 2 : 1);
  if (z.health > 0) return;
  w.zombies = w.zombies.filter((x) => x !== z);
  leaveCorpse(w, z); // H4d
  if (colonist) logEvent(w, { kind: 'zombieKilled', survivorId: s.id });
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
    if (step === 'walking' && weightOf(s.carrying) > 0) practice(w, s, 'haul', 1);
    if (step === 'walking' && w.tick % RUN_NOISE_TICKS === 0) makeNoise(w, s.pos, NOISE.run);
  }
}
