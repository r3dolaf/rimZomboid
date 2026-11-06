import { computeFov } from '../sim/vision';
import type { Grid } from '../sim/types';

/** Píxeles del mapa de luz por casilla (A4); se estira con suavizado, así que basta con pocos. */
export const LIGHT_RES = 2;
/** Cuánto quita de la oscuridad la luz más fuerte (junto al fuego no queda casi nada de noche). */
export const LIGHT_STRENGTH = 0.9;
/**
 * Lo oscura que es la noche al multiplicar: la oscuridad del cielo se cuenta esto más (sin pasar
 * de 1), para que los huecos de luz de las hogueras se noten.
 */
export const NIGHT_DEPTH = 1.35;
/** Cuánto aclara la luz lo ya visto que ahora no se ve (la niebla): los cuartos con hoguera. */
export const LIGHT_IN_FOG = 0.5;

/** Una luz (una hoguera): su centro en casillas y hasta dónde llega. */
export interface Light {
  x: number;
  y: number;
  radius: number;
}

/** De 1 (junto a la luz) a 0 (al llegar a `radius`), suave en los dos extremos: sin anillos. */
export function falloff(d: number, radius: number): number {
  const t = Math.min(1, Math.max(0, 1 - d / radius));
  return t * t * (3 - 2 * t);
}

/**
 * Por cuánto se multiplica cada color (de 0 a 255), que se escribe en `out` desde `at` (rojo,
 * verde, azul): sin oscuridad, por nada (255); del todo a oscuras, por el tinte de la noche; y cerca
 * del fuego (`warm`, de 0 a 1), tirando a `fire`, cálido. Multiplicar (y no tapar) hace que la capa
 * se dibuje aparte: tapando, Phaser la juntaba con los letreros y costaba un tercio de las imágenes
 * por segundo.
 */
export function nightShade(
  dark: number,
  warm: number,
  tint: number,
  fire: number,
  out: Uint8ClampedArray | number[],
  at = 0,
): void {
  const d = Math.min(1, dark * NIGHT_DEPTH);
  for (let k = 0; k < 3; k++) {
    const s = 16 - k * 8;
    const night = 255 * (1 - d) + ((tint >> s) & 255) * d;
    out[at + k] = Math.round(night * (1 - warm + (warm * ((fire >> s) & 255)) / 255));
  }
}

/** Lo oscuro que queda donde llega esa luz, con el cielo así de oscuro. */
export const darknessWith = (sky: number, light: number): number =>
  sky * (1 - LIGHT_STRENGTH * light);

/**
 * Cuánta luz llega a cada píxel del mapa de luz (de 0 a 1), en `out` (ancho × alto × `LIGHT_RES`²).
 * Cada luz alumbra lo que vería desde su casilla: los muros, las puertas y lo tapiado la paran (y
 * se alumbran por el lado de la luz). Donde llegan dos, la más fuerte.
 */
export function lightField(g: Grid, lights: readonly Light[], out: Float32Array): void {
  out.fill(0);
  const w = g.width * LIGHT_RES;
  for (const l of lights) {
    const [ox, oy] = [Math.floor(l.x), Math.floor(l.y)];
    computeFov(g, ox, oy, Math.ceil(l.radius), (tx, ty) => {
      for (let sy = 0; sy < LIGHT_RES; sy++)
        for (let sx = 0; sx < LIGHT_RES; sx++) {
          const px = tx + (sx + 0.5) / LIGHT_RES;
          const py = ty + (sy + 0.5) / LIGHT_RES;
          const f = falloff(Math.sqrt((px - l.x) ** 2 + (py - l.y) ** 2), l.radius);
          const i = (ty * LIGHT_RES + sy) * w + tx * LIGHT_RES + sx;
          if (f > out[i]!) out[i] = f;
        }
    });
  }
}
