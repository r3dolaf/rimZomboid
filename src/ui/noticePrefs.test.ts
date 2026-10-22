// H4e §6: qué avisos aparecen y cuáles pausan — por defecto, como antes; se guarda en el navegador.
import { expect, test } from 'vitest';
import {
  createPrefsStore,
  loadPrefs,
  NOTICE_GROUPS,
  pauses,
  savePrefs,
  shows,
  type NoticePrefs,
} from './noticePrefs';

/** Un localStorage de mentira. */
function fakeStorage(init: Record<string, string> = {}) {
  const data = { ...init };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

test('por defecto aparecen todos y pausan los rojos y los de decisión', () => {
  const p: NoticePrefs = {};
  expect(shows(p, 'grief')).toBe(true);
  expect(pauses(p, 'grief', 'bad')).toBe(true);
  expect(pauses(p, 'cache', 'good')).toBe(false);
  expect(pauses(p, 'theftPunished', 'mixed')).toBe(false); // de tono variable: según el tono
  expect(pauses(p, 'theftPunished', 'bad')).toBe(true);
  expect(pauses(p, 'decision:stranger', 'mixed')).toBe(true);
  expect(shows(p, 'decision:stranger')).toBe(true);
});

test('lo elegido manda, sea del color que sea; los de decisión aparecen siempre', () => {
  const p: NoticePrefs = {
    grief: { pause: false },
    zombieSighted: { pause: true },
    fled: { show: false },
    'decision:theft': { show: false, pause: false },
  };
  expect(pauses(p, 'grief', 'bad')).toBe(false);
  expect(pauses(p, 'zombieSighted', 'mixed')).toBe(true);
  expect(shows(p, 'fled')).toBe(false);
  expect(pauses(p, 'fled', 'mixed')).toBe(false); // si no aparece, no pausa
  expect(shows(p, 'decision:theft')).toBe(true);
  expect(pauses(p, 'decision:theft', 'bad')).toBe(false);
});

test('se guarda y se lee en el navegador (clave rimzomboid.avisos)', () => {
  const st = fakeStorage();
  savePrefs({ fled: { show: false } }, st);
  expect(JSON.parse(st.data['rimzomboid.avisos']!)).toEqual({ fled: { show: false } });
  expect(loadPrefs(st)).toEqual({ fled: { show: false } });
});

test('si lo guardado está roto o el navegador no deja, lo de siempre (y no se rompe nada)', () => {
  expect(loadPrefs(fakeStorage({ 'rimzomboid.avisos': '{roto' }))).toEqual({});
  expect(loadPrefs(fakeStorage({ 'rimzomboid.avisos': '[1,2]' }))).toEqual({});
  expect(loadPrefs(fakeStorage({ 'rimzomboid.avisos': '{"fled":{"show":"no"}}' }))).toEqual({});
  const broken = {
    getItem: () => {
      throw new Error('bloqueado');
    },
    setItem: () => {
      throw new Error('bloqueado');
    },
  };
  expect(loadPrefs(broken)).toEqual({});
  expect(() => savePrefs({ fled: { show: false } }, broken)).not.toThrow();
  expect(loadPrefs(null)).toEqual({});
});

test('el almacén de preferencias guarda al cambiar', () => {
  const st = fakeStorage();
  const store = createPrefsStore(st);
  expect(store.get()).toEqual({});
  store.set({ storm: { pause: false } });
  expect(store.get()).toEqual({ storm: { pause: false } });
  expect(loadPrefs(st)).toEqual({ storm: { pause: false } });
});

test('grupos: Narrador, Zombis, Hordas y Colonos, con todos los tipos de aviso una sola vez', () => {
  expect(NOTICE_GROUPS.map((g) => g.id)).toEqual(['narrator', 'zombies', 'hordes', 'colonists']);
  const kinds = NOTICE_GROUPS.flatMap((g) => g.kinds);
  expect(new Set(kinds).size).toBe(kinds.length);
  for (const k of ['grief', 'decision:stranger', 'downed', 'siegeArrived', 'skillUp'])
    expect(kinds).toContain(k);
});
