import { expect, test } from 'vitest';
import { emptyWorld } from '../sim/testing/fixtures';
import { bubbleIcon } from './bubbles';

test('el icono del globo mientras dura y nada después', () => {
  const s = emptyWorld(3, 3).survivors[0]!;
  expect(bubbleIcon(s, 0)).toBeNull();
  s.bubble = { kind: 'argue', until: 30 };
  expect(bubbleIcon(s, 29)).toBe('💢');
  expect(bubbleIcon(s, 30)).toBeNull();
  for (const [kind, icon] of [
    ['chat', '💬'],
    ['fight', '🥊'],
    ['console', '🤝'],
    ['share', '🍞'],
    ['love', '💕'],
  ] as const) {
    s.bubble = { kind, until: 10 };
    expect(bubbleIcon(s, 0)).toBe(icon);
  }
});
