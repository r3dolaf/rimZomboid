// @vitest-environment jsdom
// M3 §5: en un móvil en vertical, «Se juega mejor en horizontal», con «Seguir así».
import { expect, test } from 'vitest';
import { mountRotateHint } from './rotateHint';

function setup(portrait: boolean) {
  const root = document.createElement('div');
  const changes: (() => void)[] = [];
  const query = {
    matches: portrait,
    addEventListener: (_: string, f: () => void) => changes.push(f),
  };
  mountRotateHint(root, { query: query as unknown as MediaQueryList });
  const hint = () => root.querySelector('[data-testid="rotate-hint"]') as HTMLElement;
  const turn = (p: boolean) => {
    query.matches = p;
    changes.forEach((f) => f());
  };
  return { hint, turn };
}

test('en vertical sale; al girar se va y vuelve si se pone otra vez en vertical', () => {
  const { hint, turn } = setup(true);
  expect(hint().hidden).toBe(false);
  expect(hint().textContent).toContain('Se juega mejor en horizontal');
  turn(false);
  expect(hint().hidden).toBe(true);
  turn(true);
  expect(hint().hidden).toBe(false);
});

test('en horizontal no sale', () => {
  expect(setup(false).hint().hidden).toBe(true);
});

test('«Seguir así» lo quita y no vuelve a salir en esta visita', () => {
  const { hint, turn } = setup(true);
  (hint().querySelector('[data-testid="rotate-hint-dismiss"]') as HTMLButtonElement).click();
  expect(hint().hidden).toBe(true);
  turn(false);
  turn(true);
  expect(hint().hidden).toBe(true);
});
