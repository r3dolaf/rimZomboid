import { es } from '../i18n/es';
import type { Survivor } from '../sim/types';

/** El icono que lleva sobre la cabeza ahora, o `null`. */
export function bubbleIcon(s: Survivor, tick: number): string | null {
  return s.bubble && s.bubble.until > tick ? es.bubbles[s.bubble.kind] : null;
}
