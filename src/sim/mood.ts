import {
  HUNGRY_BELOW,
  HUNGRY_MOOD,
  MEMORY_EFFECTS,
  MOOD_BASE,
  OPTIMIST_MOOD,
  PESSIMIST_MOOD,
  SCARED_OUTSIDE_MOOD,
  STARVING_MOOD,
  TICKS_PER_HOUR,
  TIRED_BELOW,
  TIRED_MOOD,
} from './balance';
import { contains } from './geom';
import type { MemoryId, Rect, Survivor } from './types';

export type MoodModifierId =
  'hungry' | 'starving' | 'tired' | 'optimist' | 'pessimist' | 'scaredOutside' | MemoryId;

/** Un motivo del ánimo. Los recuerdos llevan su tick de caducidad. */
export interface MoodModifier {
  id: MoodModifierId;
  value: number;
  expiresAt?: number;
}

/**
 * Los motivos que afectan ahora al ánimo: estado, rasgos y recuerdos vigentes.
 * Con `base`, también "Asustado fuera" para el Cobarde fuera de la base.
 */
export function moodModifiers(s: Survivor, tick: number, base?: Rect): MoodModifier[] {
  const mods: MoodModifier[] = [];
  if (s.needs.hunger <= 0) mods.push({ id: 'starving', value: STARVING_MOOD });
  else if (s.needs.hunger < HUNGRY_BELOW) mods.push({ id: 'hungry', value: HUNGRY_MOOD });
  if (s.needs.sleep < TIRED_BELOW) mods.push({ id: 'tired', value: TIRED_MOOD });
  if (s.traits.includes('optimist')) mods.push({ id: 'optimist', value: OPTIMIST_MOOD });
  if (s.traits.includes('pessimist')) mods.push({ id: 'pessimist', value: PESSIMIST_MOOD });
  if (base && s.traits.includes('coward') && !contains(base, tileOf(s.pos)))
    mods.push({ id: 'scaredOutside', value: SCARED_OUTSIDE_MOOD });
  for (const m of s.memories)
    if (m.expiresAt > tick)
      mods.push({ id: m.id, value: MEMORY_EFFECTS[m.id].value, expiresAt: m.expiresAt });
  return mods;
}

/** Hacia dónde se mueve el ánimo: 50 más los motivos, entre 0 y 100. */
export function moodTarget(s: Survivor, tick: number, base?: Rect): number {
  const sum = moodModifiers(s, tick, base).reduce((acc, m) => acc + m.value, MOOD_BASE);
  return Math.min(100, Math.max(0, sum));
}

/** Añade un recuerdo; si ya tenía uno del mismo tipo, lo sustituye. */
export function addMemory(s: Survivor, id: MemoryId, tick: number): void {
  s.memories = s.memories.filter((m) => m.id !== id);
  s.memories.push({ id, expiresAt: tick + MEMORY_EFFECTS[id].hours * TICKS_PER_HOUR });
}

/** Casilla en la que está una posición continua (copia local para no depender de world.ts). */
function tileOf(p: { x: number; y: number }) {
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}
