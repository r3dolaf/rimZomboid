// @vitest-environment jsdom
// C1 §5: lo de la radio y el helicóptero en pantalla: la radio al pasar el ratón, lo que se oye en el
// registro y en los avisos (el helicóptero pausa), el punto de evacuación en Expediciones y el
// mundo, y los consejos.
import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from '../sim/balance';
import { radioSystem } from '../sim/radio';
import type { World } from '../sim/types';
import { createWorld } from '../sim/world';
import { evacLine, furnitureLabel, logText, noticeFor } from './describe';
import { dueTip } from './guide';
import { pauses } from './noticePrefs';

function withRadio(): World {
  const w = createWorld(7);
  const p = { x: w.base.rect.x + 2, y: w.base.rect.y + 2 };
  w.furniture.push({ id: w.common.nextId++, kind: 'radio', pos: p, fuel: 24, on: true });
  return w;
}

function listen(w: World, h: number): void {
  for (let i = 0; i < h; i++) {
    w.tick = (Math.floor(w.tick / TICKS_PER_HOUR) + 1) * TICKS_PER_HOUR;
    radioSystem(w);
  }
}

test('la radio al pasar el ratón: encendida o apagada, su carga, sin pilas y el día del helicóptero', () => {
  const w = withRadio();
  const r = w.furniture.find((f) => f.kind === 'radio')!;
  expect(furnitureLabel(w, r)).toBe('Radio encendida · carga para 24 h');
  r.on = false;
  expect(furnitureLabel(w, r)).toBe('Radio apagada · carga para 24 h');
  r.fuel = 0;
  expect(furnitureLabel(w, r)).toBe('Radio sin pilas: Transportar le lleva las del almacén');
  r.on = true;
  r.fuel = 24;
  listen(w, 12);
  expect(furnitureLabel(w, r)).toMatch(/· helicóptero el día \d+, de 10 a 16 h$/);
});

test('lo que se oye, en el registro y como aviso verde; el helicóptero anunciado pausa', () => {
  const w = withRadio();
  listen(w, 12);
  const news = w.common.log.find((e) => e.kind === 'radioNews')!;
  const dir = w.common.log.find((e) => e.kind === 'radioDirection')!;
  const evac = w.common.log.find((e) => e.kind === 'radioEvac')!;
  expect(logText(news, w)).toContain('El ejército está evacuando');
  expect(logText(dir, w)).toMatch(/hacia el (norte|sur|oeste|este), a unos \d+ hexágonos/);
  expect(logText(evac, w)).toMatch(/el día \d+, de 10 a 16 h/);
  for (const e of [news, dir, evac]) expect(noticeFor(e)?.tone).toBe('good');
  expect(pauses({}, 'radioEvac', 'good')).toBe(true);
  expect(pauses({}, 'radioNews', 'good')).toBe(false);
  expect(pauses({ radioEvac: { pause: false } }, 'radioEvac', 'good')).toBe(false);
});

test('el punto en Expediciones y el mundo: cuándo llega, que espera, que ya se fue', () => {
  const w = withRadio();
  listen(w, 12);
  const r = w.common.rescue!;
  const site = w.common.expedition.sites.find((x) => x.id === r.siteId)!;
  expect(evacLine(w, site)).toMatch(/^🚁 El helicóptero: día \d+, de 10 a 16 h$/);
  w.tick = r.from!;
  expect(evacLine(w, site)).toBe('🚁 ¡El helicóptero espera hasta las 16 h!');
  w.common.rescue = { ...r, siteId: null };
  expect(evacLine(w, site)).toBe('El helicóptero ya se fue');
  const other = w.common.expedition.sites.find((x) => x.kind !== 'evac')!;
  expect(evacLine(w, other)).toBeNull();
});

test('consejos: la primera radio en el almacén y el helicóptero anunciado', () => {
  const w = createWorld(7);
  const ctx = { pausedByNotice: false, zombiesSeen: 0 };
  const all = ['pause', 'night', 'zombies', 'bleeding', 'bite', 'food', 'mood', 'siege'] as const;
  expect(dueTip(w, ctx, all)).toBeNull();
  w.storage.items.radio = 1;
  expect(dueTip(w, ctx, all)).toEqual({ id: 'radio' });
  const r = withRadio();
  listen(r, 12);
  expect(dueTip(r, ctx, [...all, 'radio'])).toEqual({ id: 'evac' });
});
