// D1: las armas de fuego (spec D1 §1–§2). Se llevan encima (no en la mano): quien pelea con un zombi
// y lo tiene a tiro dispara en vez de acercarse, en modo combate siempre y si no, solo en apuros.
import {
  DECIDE_MIN_BLOOD,
  DECIDE_MIN_HEALTH,
  GUN_MIN_HIT,
  GUN_TROUBLE_THREATS,
  GUNS,
  HEAD_HIT_CHANCE,
  SHOTGUN_SPLASH,
} from './balance';
import { loadedGuns, spend } from './bags';
import { threatsOf } from './danger';
import { makeNoise } from './noise';
import { nextFloat } from './rng';
import { hitChance, practice } from './skills';
import type { Gun, Point, Survivor, World, Zombie } from './types';
import { lineOfSight } from './vision';
import { tileOf } from './world';
import { hurtZombie } from './zombies/hurt';

export { loadedGuns };

const dist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

/** ¿Tiene a tiro a `z` con esa arma (a su alcance y en línea recta)? */
function inRange(w: World, s: Survivor, z: Zombie, gun: Gun): boolean {
  return dist(s.pos, z.pos) <= GUNS[gun].range && lineOfSight(w.grid, tileOf(s.pos), tileOf(z.pos));
}

/** Los otros zombis a SHOTGUN_SPLASH de `z`, del más cercano al más lejano. */
function besides(w: World, z: Zombie): Zombie[] {
  return w.zombies
    .filter((o) => o !== z && dist(o.pos, z.pos) <= SHOTGUN_SPLASH)
    .sort((a, b) => dist(a.pos, z.pos) - dist(b.pos, z.pos));
}

/**
 * Con qué dispara a `z`, o `null` si no puede (sin arma cargada o sin tenerlo a tiro): la escopeta
 * si hay otro zombi al lado del suyo; si no, la pistola; si no, la que llegue.
 */
export function chooseGun(w: World, s: Survivor, z: Zombie): Gun | null {
  const ok = loadedGuns(s).filter((g) => inRange(w, s, z, g));
  if (ok.length === 0) return null;
  if (ok.includes('shotgun') && besides(w, z).length > 0) return 'shotgun';
  return ok.includes('pistol') ? 'pistol' : ok[0]!;
}

/** ¿Hay un asedio en marcha? */
const siegeOn = (w: World) => w.hordes.some((h) => h.kind === 'siege' && !h.done);

/**
 * ¿Dispara ahora? En modo combate, siempre; si no, en apuros: viendo varios zombis, herido o con
 * poca sangre, o en un asedio. Con un zombi solo y bien, a golpes (sin ruido).
 */
export function shootsNow(w: World, s: Survivor): boolean {
  if (s.drafted) return true;
  if (s.health < DECIDE_MIN_HEALTH || s.blood < DECIDE_MIN_BLOOD || siegeOn(w)) return true;
  return threatsOf(w, s).length >= GUN_TROUBLE_THREATS;
}

/** Lo que acierta a `d` casillas: como un golpe, menos con la distancia; como poco, GUN_MIN_HIT. */
export function gunHitChance(s: Survivor, gun: Gun, d: number): number {
  return Math.max(GUN_MIN_HIT, hitChance(s.skills.fight.level, s) - GUNS[gun].falloff * d);
}

/** Una tirada contra `z`: si acierta, el daño (a la cabeza, doble). */
function shootAt(w: World, s: Survivor, z: Zombie, gun: Gun, damage: number): void {
  if (nextFloat(w.rng) >= gunHitChance(s, gun, dist(s.pos, z.pos))) return;
  const head = nextFloat(w.rng) < HEAD_HIT_CHANCE;
  hurtZombie(w, s, z, damage * (head ? 2 : 1));
}

/**
 * Dispara a `z`: gasta una bala o un cartucho, se oye desde lejos y practica Pelear; la escopeta da
 * también a los de al lado (cada uno con su tirada).
 */
export function fire(w: World, s: Survivor, z: Zombie, gun: Gun): void {
  const g = GUNS[gun];
  spend(s, g.ammo);
  makeNoise(w, s.pos, g.noise);
  if (w.survivors.includes(s)) practice(w, s, 'fight', g.ticks);
  s.shot = { tick: w.tick, gun, x: z.pos.x, y: z.pos.y };
  const others = g.spread > 0 ? besides(w, z).slice(0, g.spread) : [];
  shootAt(w, s, z, gun, g.damage);
  for (const o of others) shootAt(w, s, o, gun, g.splashDamage);
}
