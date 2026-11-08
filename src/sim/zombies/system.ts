// Cada tick: llegan zombis por los bordes, piensan, andan, golpean y rompen (spec H4b §2).
import {
  NOISE,
  ZOMBIE_BREAK_DAMAGE,
  ZOMBIE_HIT_TICKS,
  ZOMBIE_REACH,
  ZOMBIE_COLD_SPEED,
  ZOMBIE_SPEED,
  ZOMBIE_THINK_TICKS,
} from '../balance';
import { contains } from '../geom';
import { logEvent } from '../log';
import { isZombieWalkable } from '../map/grid';
import { makeNoise } from '../noise';
import { damageTile, resistanceOf } from '../structures';
import { outdoorTemp } from '../season';
import type { World, Zombie } from '../types';
import { personById, thinkZombie, visibleToZombies, zombieAttack } from './brain';
import { tileOf } from '../world';
import { hordeSystem } from './hordes';
import { arrivalsSystem } from './spawn';

export function zombieSystem(w: World): void {
  const inBase = (z: Zombie) => contains(w.base.rect, tileOf(z.pos));
  const already = w.zombies.some(inBase);
  hordeSystem(w); // H4e: antes de las llegadas por los bordes
  arrivalsSystem(w);
  for (const z of w.zombies) {
    if (z.cooldown > 0) z.cooldown--;
    if ((w.tick + z.id) % ZOMBIE_THINK_TICKS === 0) thinkZombie(w, z);
    act(w, z);
  }
  // Aviso: el primero que entra en la base (spec H4b §8).
  const first = already ? undefined : w.zombies.find(inBase);
  if (first) logEvent(w, { kind: 'zombiesInBase', ...tileOf(first.pos) });
}

/** La velocidad de los zombis en este tick (V3 §6): helados, un 20 % menos. Se calcula una vez. */
let speedAt = { tick: -1, seed: 0, speed: ZOMBIE_SPEED };
export function zombieSpeed(w: World): number {
  if (speedAt.tick !== w.tick || speedAt.seed !== w.seed)
    speedAt = {
      tick: w.tick,
      seed: w.seed,
      speed: ZOMBIE_SPEED * (outdoorTemp(w) < 0 ? ZOMBIE_COLD_SPEED : 1),
    };
  return speedAt.speed;
}

/** Golpea a su presa si la tiene al lado; si no, anda o rompe lo que tiene delante. */
function act(w: World, z: Zombie): void {
  if (z.state === 'chase') {
    const prey = personById(w, z.targetId);
    if (prey && visibleToZombies(prey)) {
      const d2 = (prey.pos.x - z.pos.x) ** 2 + (prey.pos.y - z.pos.y) ** 2;
      if (d2 <= ZOMBIE_REACH * ZOMBIE_REACH) {
        if (z.cooldown === 0) zombieAttack(w, z, prey);
        return;
      }
    }
  }
  const next = z.path[0];
  if (!next) return;
  if (isZombieWalkable(w.grid, next.x, next.y)) {
    const tx = next.x + 0.5;
    const ty = next.y + 0.5;
    const dx = tx - z.pos.x;
    const dy = ty - z.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = zombieSpeed(w); // V3: helados, más despacio
    if (dist <= speed) {
      z.pos = { x: tx, y: ty };
      z.path.shift();
    } else {
      z.pos = {
        x: z.pos.x + (dx / dist) * speed,
        y: z.pos.y + (dy / dist) * speed,
      };
    }
    return;
  }
  // Delante hay algo que romper: golpe a golpe.
  if (resistanceOf(w, next.x, next.y) === undefined) {
    z.path = []; // algo que no se rompe (p. ej., un árbol): ya buscará otro camino
    return;
  }
  if (z.cooldown > 0) return;
  z.cooldown = ZOMBIE_HIT_TICKS;
  makeNoise(w, { x: next.x + 0.5, y: next.y + 0.5 }, NOISE.zombieHit);
  damageTile(w, next.x, next.y, ZOMBIE_BREAK_DAMAGE);
}
