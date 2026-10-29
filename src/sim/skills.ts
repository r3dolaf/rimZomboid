// Habilidades (spec H4c): cómo empiezan, lo que cuesta subir y lo que cambian.
import {
  BAGS,
  BUILD_FAIL_BASE,
  CARRY_BASE_KG,
  CARRY_PER_LEVEL_KG,
  BUILD_FAIL_PER_LEVEL,
  CLUMSY_FAIL,
  CONSOLE_OK_BASE,
  CONSOLE_OK_PER_LEVEL,
  FIGHT_HIT_BASE,
  FIGHT_HIT_PER_LEVEL,
  LEARN_MULT,
  LOAD_BRAKE_BASE,
  LOAD_BRAKE_PER_LEVEL,
  MIN_WORK_SPEED,
  SKILL_MAX,
  SKILL_SPEED_MIN,
  SKILL_SPEED_PER_LEVEL,
  SKILL_START_MAX,
  SPECIALTY_MAX,
  SPECIALTY_MIN,
  TICKS_PER_HOUR,
  TRAIT_SKILL_MODS,
} from './balance';
import { armFactor } from './body';
import { weightOf } from './items';
import { logEvent } from './log';
import { createRng, nextInt, pick, type RngState } from './rng';
import type { Skill, SkillId, Survivor, TraitId, World } from './types';

/** En el orden de los trabajos del panel (H4a §3.1) y Pelear al final. */
export const SKILLS: readonly SkillId[] = [
  'heal',
  'social',
  'build',
  'craft',
  'haul',
  'chop',
  'loot',
  'fight',
];

/** Las que se sortean como en H4c (Sanar va aparte; ver `rollSkills`). */
const ROLLED: readonly SkillId[] = SKILLS.filter((k) => k !== 'heal');

/**
 * El azar de las habilidades de cada colono: la semilla del mundo y su id. Así sortearlas no
 * cambia nada más del mundo con la misma semilla (como `zombieRng`).
 */
export function skillRng(seed: number, id: number): RngState {
  return createRng(seed ^ Math.imul(id, 0x9e3779b1));
}

/** Cada una entre 0 y 3, una especialidad entre 5 y 7, y lo que sumen o resten los rasgos. */
export function rollSkills(rng: RngState, traits: readonly TraitId[]): Record<SkillId, Skill> {
  const out = {} as Record<SkillId, Skill>;
  for (const k of ROLLED) out[k] = { level: nextInt(rng, 0, SKILL_START_MAX), xp: 0 };
  out[pick(rng, ROLLED)].level = nextInt(rng, SPECIALTY_MIN, SPECIALTY_MAX);
  // Sanar (H4e), después y sin poder ser la especialidad: así lo de antes sale igual.
  out.heal = { level: nextInt(rng, 0, SKILL_START_MAX), xp: 0 };
  for (const t of traits) {
    const mods: Partial<Record<SkillId, number>> =
      t in TRAIT_SKILL_MODS ? TRAIT_SKILL_MODS[t as keyof typeof TRAIT_SKILL_MODS] : {};
    for (const k of SKILLS)
      out[k].level = Math.min(SKILL_MAX, Math.max(0, out[k].level + (mods[k] ?? 0)));
  }
  return out;
}

/** Práctica para pasar del nivel `level` al siguiente: (nivel + 1) horas. */
export function xpToNext(level: number): number {
  return (level + 1) * TICKS_PER_HOUR;
}

/** Probabilidad de fallar al terminar un plano: 30 % con 0, 10 % con 5, 0 desde 8; Torpe +10 %. */
export function buildFailChance(level: number, clumsy: boolean): number {
  return Math.max(0, BUILD_FAIL_BASE - BUILD_FAIL_PER_LEVEL * level) + (clumsy ? CLUMSY_FAIL : 0);
}

/** Lo que puede llevar encima: 6 kg con Transportar 0, 8 con 5 y 10 con 10. */
export function capacityKg(s: Survivor): number {
  return CARRY_BASE_KG + CARRY_PER_LEVEL_KG * s.skills.haul.level;
}

/**
 * Lo que pesa al andar (H5b2 §1): lo de las manos, entero; cada bolsa puesta, vacía más lo de dentro
 * por su porcentaje.
 */
export function effectiveLoad(s: Survivor): number {
  let kg = weightOf(s.carrying);
  for (const b of Object.values(s.bags))
    if (b) kg += BAGS[b.kind].kg + weightOf(b.items) * BAGS[b.kind].factor;
  return kg;
}

/** Cuánto le frena lo que lleva (1 = nada): a plena carga, ×0,6 con 0, ×0,75 con 5, ×0,9 con 10. */
export function loadFactor(s: Survivor): number {
  const brake = LOAD_BRAKE_BASE - LOAD_BRAKE_PER_LEVEL * s.skills.haul.level;
  return 1 - brake * Math.min(1, effectiveLoad(s) / capacityKg(s));
}

/** Acierto de un golpe a un zombi: 60 % con Pelear 0, 75 % con 5, 90 % con 10. */
export function hitChance(level: number, s?: Survivor): number {
  // Con los brazos heridos (H5), menos.
  return (FIGHT_HIT_BASE + FIGHT_HIT_PER_LEVEL * level) * (s ? armFactor(s) : 1);
}

/** Probabilidad de que consolar salga bien: 50 % con Social 0, 75 % con 5, siempre con 10. */
export function consoleChance(level: number): number {
  return Math.min(1, CONSOLE_OK_BASE + CONSOLE_OK_PER_LEVEL * level);
}

/** Rapidez con ese nivel: ×0,5 con 0, ×1 con 5 (como antes de H4c) y ×1,5 con 10. */
export function skillSpeed(level: number): number {
  return SKILL_SPEED_MIN + SKILL_SPEED_PER_LEVEL * level;
}

/** Rapidez de un trabajo: la de su habilidad por los brazos (H5 §2.4; sin brazos, casi nada). */
export function workSpeed(s: Survivor, skill: SkillId): number {
  return Math.max(MIN_WORK_SPEED, skillSpeed(s.skills[skill].level) * armFactor(s));
}

/**
 * Suma práctica (Aprende rápido ×1,5, Aprende despacio ×0,5). Al llegar a lo que cuesta, sube de
 * nivel y lo registra; lo que sobra pasa al siguiente. A nivel 10 ya no suma.
 */
export function practice(w: World, s: Survivor, skill: SkillId, amount: number): void {
  const k = s.skills[skill];
  if (k.level >= SKILL_MAX) return;
  let mult = 1;
  for (const t of s.traits) if (t in LEARN_MULT) mult *= LEARN_MULT[t as keyof typeof LEARN_MULT];
  k.xp += amount * mult;
  while (k.level < SKILL_MAX && k.xp >= xpToNext(k.level)) {
    k.xp -= xpToNext(k.level);
    k.level++;
    logEvent(w, { kind: 'skillUp', survivorId: s.id, skill, level: k.level });
  }
  if (k.level >= SKILL_MAX) k.xp = 0;
}
