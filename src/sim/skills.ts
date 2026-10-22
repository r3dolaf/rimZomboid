// Habilidades (spec H4c): cómo empiezan, lo que cuesta subir y lo que cambian.
import {
  SKILL_MAX,
  SKILL_START_MAX,
  SPECIALTY_MAX,
  SPECIALTY_MIN,
  TICKS_PER_HOUR,
  TRAIT_SKILL_MODS,
} from './balance';
import { createRng, nextInt, pick, type RngState } from './rng';
import type { Skill, SkillId, TraitId } from './types';

/** En el orden de los trabajos del panel (H4a §3.1) y Pelear al final. */
export const SKILLS: readonly SkillId[] = ['social', 'build', 'haul', 'chop', 'loot', 'fight'];

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
  for (const k of SKILLS) out[k] = { level: nextInt(rng, 0, SKILL_START_MAX), xp: 0 };
  out[pick(rng, SKILLS)].level = nextInt(rng, SPECIALTY_MIN, SPECIALTY_MAX);
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
