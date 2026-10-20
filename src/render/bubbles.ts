import type { BubbleKind, Survivor } from '../sim/types';

const BUBBLE_ICONS: Record<BubbleKind, string> = {
  chat: '💬',
  argue: '💢',
  fight: '🥊',
  console: '🤝',
  share: '🍞',
  love: '💕',
};

/** El icono que lleva sobre la cabeza ahora, o `null`. */
export function bubbleIcon(s: Survivor, tick: number): string | null {
  return s.bubble && s.bubble.until > tick ? BUBBLE_ICONS[s.bubble.kind] : null;
}
