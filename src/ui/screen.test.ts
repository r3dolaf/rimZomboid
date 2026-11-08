// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { MENU_SCREEN, screenIs, SMALL_SCREEN, trackHeight } from './screen';

afterEach(() => vi.unstubAllGlobals());

test('las consultas: la pequeña, por debajo de 800 de ancho o hasta 500 de alto; el menú, de 1200', () => {
  expect(SMALL_SCREEN).toBe('(max-width: 799px), (max-height: 500px)');
  expect(MENU_SCREEN).toBe('(max-width: 1199px), (max-height: 500px)');
});

test('screenIs: lo que diga matchMedia; sin matchMedia (tests, navegadores viejos), la ancha', () => {
  expect(screenIs(SMALL_SCREEN)).toBe(false);
  const asked: string[] = [];
  vi.stubGlobal('matchMedia', (q: string) => {
    asked.push(q);
    return { matches: q === SMALL_SCREEN };
  });
  expect(screenIs(SMALL_SCREEN)).toBe(true);
  expect(screenIs(MENU_SCREEN)).toBe(false);
  expect(asked).toEqual([SMALL_SCREEN, MENU_SCREEN]);
});

test('trackHeight pone la altura en la variable de CSS y la sigue al cambiar', () => {
  const el = document.createElement('div');
  let height = 40;
  Object.defineProperty(el, 'offsetHeight', { get: () => height });
  let changed: (() => void) | null = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        changed = cb;
      }
      observe(target: Element) {
        expect(target).toBe(el);
      }
    },
  );
  const target = document.createElement('div');
  trackHeight(el, '--bar-h', target);
  expect(target.style.getPropertyValue('--bar-h')).toBe('40px');
  height = 52;
  changed!();
  expect(target.style.getPropertyValue('--bar-h')).toBe('52px');
});

test('trackHeight sin ResizeObserver: solo la de ahora', () => {
  vi.stubGlobal('ResizeObserver', undefined);
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetHeight', { get: () => 30 });
  const target = document.createElement('div');
  trackHeight(el, '--cards-h', target);
  expect(target.style.getPropertyValue('--cards-h')).toBe('30px');
});
