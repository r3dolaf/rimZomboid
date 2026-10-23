// El cuerpo (spec H5 §2): partes con su vida, heridas, dolor (la Salud) y lo que hacen piernas y
// brazos heridos.
import {
  BODY_HP,
  DOWNED_TICKS,
  FRESH_PAIN,
  FRESH_PAIN_HOURS,
  INFECTION_DEATH_HOURS_MAX,
  INFECTION_DEATH_HOURS_MIN,
  NAUSEA_PAIN,
  PAIN_PER_DAMAGE,
  PAINKILLER_PAIN,
  TICKS_PER_HOUR,
  WOUNDS,
} from './balance';
import { logEvent } from './log';
import { nextFloat, nextInt } from './rng';
import type { BodyPart, Survivor, World, Wound, WoundKind } from './types';
import { tileOf } from './world';

export const BODY_PARTS: readonly BodyPart[] = [
  'head',
  'torso',
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg',
];

/** ¿Es de la colonia? (Lo de los desconocidos no se apunta en el registro.) */
const colonist = (w: World, s: Survivor) => w.survivors.includes(s);

/** Vida que le queda a una parte: su máximo menos el daño de sus heridas (como poco, 0). */
export function partHp(s: Survivor, part: BodyPart): number {
  let hp: number = BODY_HP[part];
  for (const wd of s.wounds) if (wd.part === part) hp -= wd.damage;
  return Math.max(0, hp);
}

/** Lo que le falta a una parte, de 0 (entera) a 1 (a 0). */
const lost = (s: Survivor, part: BodyPart) => 1 - partHp(s, part) / BODY_HP[part];

/** Rapidez al andar por las piernas: una a 0, la mitad; las dos, un cuarto (spec §2.4). */
export function legFactor(s: Survivor): number {
  return Math.max(0.25, 1 - 0.5 * (lost(s, 'leftLeg') + lost(s, 'rightLeg')));
}

/** Rapidez al trabajar y acierto al pelear por los brazos: uno a 0, la mitad; los dos, nada. */
export function armFactor(s: Survivor): number {
  return Math.max(0, 1 - 0.5 * (lost(s, 'leftArm') + lost(s, 'rightArm')));
}

/** Lo que duele una herida ahora: más cuanto más reciente (×FRESH_PAIN al hacerse, ×1 a las 6 h). */
function painOfWound(wd: Wound, tick: number): number {
  const age = Math.max(0, tick - wd.at) / (FRESH_PAIN_HOURS * TICKS_PER_HOUR);
  const fresh = FRESH_PAIN - (FRESH_PAIN - 1) * Math.min(1, age);
  return wd.damage * PAIN_PER_DAMAGE * fresh;
}

/** El dolor de todas sus heridas. */
export function painOf(s: Survivor, tick: number): number {
  let pain = 0;
  for (const wd of s.wounds) pain += painOfWound(wd, tick);
  // Las náuseas también duelen (H5 §7.3).
  if (s.fever && s.fever.stage !== 'fever') pain += NAUSEA_PAIN;
  // Con analgésico (H5 §5), la mitad.
  return s.painkillerUntil > tick ? pain * PAINKILLER_PAIN : pain;
}

/** ¿Puede andar? Ni derribado ni con las dos piernas a 0. */
export function canWalk(s: Survivor): boolean {
  return s.action.type !== 'downed' && legFactor(s) > 0.25;
}

/** La Salud es 100 menos el dolor (entre 0 y 100). */
export function refreshHealth(w: World, s: Survivor): void {
  s.health = Math.max(0, Math.min(100, 100 - painOf(s, w.tick)));
}

/** Cae derribado (lo que estuviera haciendo se corta) y sale del modo combate. */
export function knockDown(w: World, s: Survivor): void {
  if (s.action.type === 'downed') return;
  // Si estaba acostado en una cama (durmiendo o descansando), sigue en ella (H5 §6).
  const a = s.action;
  const t = tileOf(s.pos);
  const inBed =
    (a.type === 'sleep' && a.inBed) ||
    (a.type === 'rest' && w.beds.some((b) => b.pos.x === t.x && b.pos.y === t.y));
  s.action = { type: 'downed', until: w.tick + DOWNED_TICKS, ...(inBed ? { inBed } : {}) };
  s.path = [];
  s.drafted = false;
  // Un desconocido no es de la colonia: se apunta con su nombre y sin aviso.
  if (colonist(w, s)) logEvent(w, { kind: 'downed', survivorId: s.id });
  else logEvent(w, { kind: 'strangerDowned', names: [s.name] });
}

/**
 * La infección (H5 §7.1), oculta: el mordisco infecta siempre, el arañazo a veces (azar de los
 * zombis); muere de ella a las 48–72 h.
 */
function infect(w: World, s: Survivor, kind: WoundKind): void {
  const chance = WOUNDS[kind].infect;
  if (s.infection || chance === 0 || (chance < 1 && nextFloat(w.zombieRng) >= chance)) return;
  const hours = nextInt(w.zombieRng, INFECTION_DEATH_HOURS_MIN, INFECTION_DEATH_HOURS_MAX);
  s.infection = { at: w.tick, deathAt: w.tick + hours * TICKS_PER_HOUR };
}

/** Le deja una herida; si el dolor le deja a 0, cae derribado. */
export function addWound(w: World, s: Survivor, part: BodyPart, kind: WoundKind): Wound {
  const size = WOUNDS[kind].damage;
  const wd: Wound = {
    id: w.nextWoundId++,
    part,
    kind,
    size,
    damage: size,
    at: w.tick,
    bleeding: true,
    cleanUntil: 0,
  };
  s.wounds.push(wd);
  infect(w, s, kind);
  if (colonist(w, s)) logEvent(w, { kind: 'wounded', survivorId: s.id, part, wound: kind });
  refreshHealth(w, s);
  if (s.health <= 0) knockDown(w, s);
  return wd;
}

/** Las heridas que le sangran ahora. */
export function bleedingWounds(s: Survivor): Wound[] {
  return s.wounds.filter((wd) => wd.bleeding);
}
