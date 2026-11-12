// @vitest-environment jsdom
// C3: los logros: cuándo se consigue cada uno, lo guardado, el aviso y, con trampas, ninguno.
import { beforeEach, expect, test, vi } from 'vitest';
import { TICKS_PER_DAY } from '../sim/balance';
import { logEvent } from '../sim/log';
import { createWorld } from '../sim/world';
import {
  ACHIEVEMENTS,
  achieved,
  achievementsList,
  createAchievementStore,
  mountAchievements,
} from './achievements';

beforeEach(() => localStorage.clear());

test('cada logro, cuando toca (y ninguno al empezar)', () => {
  const w = createWorld(3);
  expect(achieved(w)).toEqual([]);
  w.tick = TICKS_PER_DAY; // día 2
  expect(achieved(w)).toEqual(['firstNight']);
  w.tick = 60 * TICKS_PER_DAY; // día 61
  expect(achieved(w)).toEqual(['firstNight', 'week', 'month', 'spring', 'year']);
  w.tick = 0;
  w.common.stats.siegesRepelled = 3;
  w.common.stats.harvested = 100;
  w.common.stats.kills = 1000;
  w.common.stats.joined = ['Luis'];
  logEvent(w, { kind: 'couple', survivorId: 1, otherId: 2 });
  logEvent(w, { kind: 'amputated', survivorId: 1, part: 'leftArm', ok: true });
  logEvent(w, { kind: 'radioEvac', day: 9, hours: 12 });
  w.survivors[0]!.shot = { tick: 0, gun: 'pistol', x: 1, y: 1 };
  expect(achieved(w)).toEqual([
    'siege',
    'fortress',
    'harvest',
    'farmer',
    'hundred',
    'thousand',
    'surgeon',
    'welcome',
    'couple',
    'radio',
    'firstShot',
  ]);
});

test('ganar, ganar sin muertes, una familia y lobo solitario', () => {
  const w = createWorld(3);
  w.common.over = { tick: 5 * TICKS_PER_DAY, won: true };
  expect(achieved(w)).toEqual(['firstNight', 'rescued', 'allSaved']);
  w.common.dead.push({ id: 99, name: 'Ana', day: 3, cause: 'infection' });
  expect(achieved(w)).toEqual(['firstNight', 'rescued']);
  const big = createWorld(3);
  while (big.survivors.length < 8)
    big.survivors.push({ ...big.survivors[0]!, id: 1000 + big.survivors.length });
  expect(achieved(big)).toContain('family');
  const solo = createWorld(3, 'balanced', 'normal', {
    scenario: 'solo',
    infection: 'normal',
    loot: 'normal',
    sieges: 'normal',
    needs: 'normal',
    cold: 'normal',
  });
  solo.tick = 14 * TICKS_PER_DAY; // día 15
  expect(achieved(solo)).toContain('lone');
});

test('con trampas, ninguno', () => {
  const w = createWorld(3);
  w.tick = 10 * TICKS_PER_DAY;
  w.common.cheated = true;
  expect(achieved(w)).toEqual([]);
});

test('lo conseguido se guarda en el navegador; el aviso, una sola vez', () => {
  const w = createWorld(3);
  const root = document.createElement('div');
  const store = createAchievementStore();
  const onUnlock = vi.fn();
  const a = mountAchievements(root, {
    world: w,
    store,
    onUnlock,
    now: () => new Date('2026-11-12T10:00:00Z'),
  });
  a.update();
  expect(onUnlock).not.toHaveBeenCalled();
  w.tick = TICKS_PER_DAY;
  for (let i = 0; i < 31; i++) a.update();
  expect(onUnlock).toHaveBeenCalledTimes(1);
  expect(onUnlock).toHaveBeenCalledWith('firstNight');
  expect(root.querySelector('[data-testid="achievement-firstNight"]')?.textContent).toBe(
    '🏆 Logro: Primera noche',
  );
  for (let i = 0; i < 60; i++) a.update();
  expect(onUnlock).toHaveBeenCalledTimes(1);
  // Otra vez (otra partida, recargando): sigue conseguido.
  const again = createAchievementStore();
  expect(again.get()).toEqual({ firstNight: '2026-11-12T10:00:00.000Z' });
  const list = achievementsList(again);
  expect(list).toHaveLength(ACHIEVEMENTS.length);
  expect(list.filter((x) => x.done).map((x) => x.id)).toEqual(['firstNight']);
  expect(list[1]).toEqual({ id: 'week', name: 'Una semana', how: 'Llegar al día 8', done: false });
});

test('lo guardado estropeado no rompe nada', () => {
  localStorage.setItem('rimzomboid.logros', '{nope');
  expect(createAchievementStore().get()).toEqual({});
  localStorage.setItem('rimzomboid.logros', JSON.stringify({ week: 3, bogus: 'x', year: 'y' }));
  expect(createAchievementStore().get()).toEqual({ year: 'y' });
});

test('varios a la vez, en un solo aviso; al acabar la partida, sin aviso (pero se guardan)', () => {
  const w = createWorld(3);
  const root = document.createElement('div');
  const store = createAchievementStore();
  const a = mountAchievements(root, { world: w, store });
  w.tick = 8 * TICKS_PER_DAY;
  a.update();
  const toasts = [...root.querySelectorAll('.achievement-toast')].map((x) => x.textContent);
  expect(toasts).toEqual(['🏆 2 logros: Primera noche, Una semana']);
  const end = createWorld(3);
  end.common.over = { tick: 40 * TICKS_PER_DAY };
  const root2 = document.createElement('div');
  const b = mountAchievements(root2, { world: end, store });
  b.update();
  expect(root2.querySelectorAll('.achievement-toast')).toHaveLength(0);
  expect(Object.keys(store.get()).sort()).toEqual(['firstNight', 'month', 'week']);
});
