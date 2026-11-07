// Sin estruendo (spec S1 §1.1): a x3, con un asedio, no se amontonan los efectos.

/** Un mismo efecto, como mucho cada tanto. */
export const SAME_GAP_MS = 70;
/** Efectos nuevos por fotograma, como mucho. */
export const MAX_PER_FRAME = 6;
/** Efectos sonando a la vez, como mucho. */
export const MAX_VOICES = 16;

export function createLimiter() {
  const last = new Map<string, number>();
  let thisFrame = 0;
  return {
    /** Empieza otro fotograma. */
    frame(): void {
      thisFrame = 0;
    },
    /** ¿Puede sonar `id` ahora, con `voices` sonando? Si puede, cuenta como que ha sonado. */
    allow(id: string, now: number, voices: number): boolean {
      if (voices >= MAX_VOICES || thisFrame >= MAX_PER_FRAME) return false;
      const before = last.get(id);
      if (before !== undefined && now - before < SAME_GAP_MS) return false;
      last.set(id, now);
      thisFrame++;
      return true;
    },
  };
}
