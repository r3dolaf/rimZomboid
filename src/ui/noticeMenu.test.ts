// @vitest-environment jsdom
// H4e §6: el menú de Avisos.
import { expect, test } from 'vitest';
import { createFlag } from './flag';
import { mountNoticeMenu } from './noticeMenu';
import { createPrefsStore } from './noticePrefs';

function setup() {
  const root = document.createElement('div');
  document.body.replaceChildren(root); // las casillas solo avisan del cambio si están en la página
  const data: Record<string, string> = {};
  const store = createPrefsStore({
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  });
  const open = createFlag();
  const menu = mountNoticeMenu(root, { prefs: store, open });
  const q = <T extends HTMLElement>(id: string) => root.querySelector(`[data-testid="${id}"]`) as T;
  return { root, store, open, menu, q };
}

test('oculto hasta que se abre; por grupos, con Aparece y Pausa por tipo (por defecto)', () => {
  const { root, open, menu, q } = setup();
  menu.update();
  expect(q('notice-menu').hidden).toBe(true);
  open.set(true);
  menu.update();
  expect(q('notice-menu').hidden).toBe(false);
  expect([...root.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
    'Narrador',
    'Zombis',
    'Hordas',
    'Colonos',
  ]);
  expect(q<HTMLInputElement>('notice-show-grief').checked).toBe(true);
  expect(q<HTMLInputElement>('notice-pause-grief').checked).toBe(true);
  expect(q<HTMLInputElement>('notice-pause-cache').checked).toBe(false);
  // Los de decisión: aparecen siempre (sin casilla) y pausan.
  expect(q('notice-show-decision:stranger')).toBeNull();
  expect(q<HTMLInputElement>('notice-pause-decision:stranger').checked).toBe(true);
});

test('quitar Aparece apaga Pausa; los cambios se guardan; Como al principio lo deja como antes', () => {
  const { store, open, menu, q } = setup();
  open.set(true);
  menu.update();
  const show = q<HTMLInputElement>('notice-show-fled');
  show.click();
  expect(store.get()).toEqual({ fled: { show: false } });
  menu.update();
  expect(q<HTMLInputElement>('notice-pause-fled').disabled).toBe(true);
  q<HTMLInputElement>('notice-pause-grief').click();
  expect(store.get().grief).toEqual({ pause: false });
  q('notice-reset').click();
  expect(store.get()).toEqual({});
  menu.update();
  expect(q<HTMLInputElement>('notice-show-fled').checked).toBe(true);
  q('notice-menu-close').click();
  expect(open.value).toBe(false);
});
