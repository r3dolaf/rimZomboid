import { TICKS_PER_DAY } from '../sim/balance';

/** Lo que se anda en cada paso (casillas): un dibujo de piernas distinto (A5). */
export const STEP_TILES = 0.2;

/** El paso de quien anda (A, de pie, B, de pie…, según lo andado); quieto, de pie (`null`). */
export function walkStep(walked: number, moving: boolean): 'A' | 'B' | null {
  if (!moving) return null;
  const phase = Math.floor(walked / STEP_TILES) % 4;
  return phase === 0 ? 'A' : phase === 2 ? 'B' : null;
}

/**
 * Una gota de sangre, una astilla o una mota de polvo (A5): dónde está en el suelo (en píxeles del
 * mapa) y a qué altura, cómo se mueve (píxeles por milisegundo) y cuánto le queda (milisegundos).
 */
export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  color: number;
  size: number;
  /** Polvo: no cae, sube despacio y se deshace. */
  floats?: boolean;
}

/** Lo que tira hacia abajo de lo que salta (píxeles por milisegundo, cada milisegundo). */
export const GRAVITY = 0.0009;

/** Mueve lo que salta: cae hasta el suelo y allí se queda; quita lo que se ha acabado. */
export function stepParticles(ps: Particle[], dtMs: number): void {
  for (const p of ps) {
    p.life -= dtMs;
    if (p.floats) {
      p.x += p.vx * dtMs;
      p.z += p.vz * dtMs;
      continue;
    }
    if (p.z <= 0 && p.vz <= 0) continue; // ya en el suelo
    p.vz -= GRAVITY * dtMs;
    p.x += p.vx * dtMs;
    p.y += p.vy * dtMs;
    p.z += p.vz * dtMs;
    if (p.z <= 0) {
      p.z = 0;
      p.vz = 0;
      p.vx = 0;
      p.vy = 0;
    }
  }
  let k = 0;
  for (const p of ps) if (p.life > 0) ps[k++] = p;
  ps.length = k;
}

/** Las manchas de sangre del suelo se secan en un día de juego: enteras la primera mitad. */
export const DECAL_TICKS = TICKS_PER_DAY;

export function decalAlpha(age: number): number {
  if (age <= DECAL_TICKS / 2) return 1;
  return Math.max(0, 1 - (age - DECAL_TICKS / 2) / (DECAL_TICKS / 2));
}

/** Lo que tarda en caer un árbol talado y en desvanecerse luego (milisegundos). */
export const FALL_MS = 700;
export const FADE_MS = 500;

/** El ángulo de un árbol que cae (de 0 a un cuarto de vuelta), cada vez más deprisa. */
export function fallAngle(ms: number): number {
  const t = Math.min(1, Math.max(0, ms / FALL_MS));
  return (Math.PI / 2) * t * t;
}

/** Lo que se lanza hacia delante quien golpea (píxeles), y cuánto dura (milisegundos). */
export const LUNGE_PX = 3;
export const LUNGE_MS = 180;

/** Cuánto se ha adelantado a los `ms` de empezar el golpe: va y vuelve. */
export function lungeAmount(ms: number): number {
  if (ms < 0 || ms >= LUNGE_MS) return 0;
  return LUNGE_PX * Math.sin((Math.PI * ms) / LUNGE_MS);
}
