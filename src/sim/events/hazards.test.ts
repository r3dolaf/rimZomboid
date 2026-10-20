// Tormenta y gripe (spec H3c §3.3).
import { expect, test } from 'vitest';
import { FLOOR_SLEEP_FACTOR, SLEEP_GAIN_PER_TICK, TICKS_PER_DAY, TICKS_PER_HOUR } from '../balance';
import { checkInvariants } from '../invariants';
import { moodModifiers } from '../mood';
import { issue } from '../orders';
import { step } from '../step';
import { needsSystem } from '../systems/needs';
import type { Survivor, World } from '../types';
import { findWork } from '../work';
import { createWorld } from '../world';
import { fluEvent } from './flu';
import { stormEvent } from './storm';

const BASE = createWorld(3);

function calm(): { w: World; a: Survivor; b: Survivor } {
  const w = structuredClone(BASE);
  w.tick = 1000;
  w.narrator.nextEventAt = 1e9;
  for (const s of w.survivors) {
    s.traits = [];
    s.nextChatAt = 1e9;
  }
  const [a, b] = w.survivors as [Survivor, Survivor];
  return { w, a, b };
}

// --- 11. Tormenta ---

test('tormenta: 8–12 h, "Tormenta" −6 a todos y no se repite mientras dura', () => {
  const { w } = calm();
  expect(stormEvent.tone).toBe('bad');
  expect(stormEvent.severity).toBe(1);
  expect(stormEvent.cooldownDays).toBe(4);
  expect(stormEvent.canHappen(w)).toBe(true);
  stormEvent.happen(w);
  expect(w.stormUntil - w.tick).toBeGreaterThanOrEqual(8 * TICKS_PER_HOUR);
  expect(w.stormUntil - w.tick).toBeLessThanOrEqual(12 * TICKS_PER_HOUR);
  for (const s of w.survivors) expect(s.memories.some((m) => m.id === 'storm')).toBe(true);
  expect(w.log.at(-1)).toMatchObject({ kind: 'storm' });
  expect(stormEvent.canHappen(w)).toBe(false);
});

test('con tormenta el sueño se recupera un 25 % más despacio', () => {
  const { w, a } = calm();
  a.action = { type: 'sleep', inBed: false };
  a.needs.sleep = 10;
  needsSystem(w);
  const normal = a.needs.sleep - 10;
  expect(normal).toBeCloseTo(SLEEP_GAIN_PER_TICK * FLOOR_SLEEP_FACTOR, 9);
  a.needs.sleep = 10;
  w.stormUntil = w.tick + 10;
  needsSystem(w);
  expect(a.needs.sleep - 10).toBeCloseTo(normal * 0.75, 9);
});

// --- 12. Gripe ---

test('gripe: a alguien sano, 4 días, decisión, "Con gripe" −10 y más hambre', () => {
  const { w, a, b } = calm();
  expect(fluEvent.tone).toBe('bad');
  expect(fluEvent.severity).toBe(2);
  expect(fluEvent.cooldownDays).toBe(5);
  for (const s of w.survivors) if (s !== a) s.sick = { until: 1e9, plan: 'work' };
  fluEvent.happen(w);
  expect(a.sick).toEqual({ until: w.tick + 4 * TICKS_PER_DAY, plan: 'undecided' });
  expect(w.decisions[0]).toMatchObject({ kind: 'flu', survivorIds: [a.id] });
  expect(w.log.at(-1)).toMatchObject({ kind: 'flu', survivorId: a.id });
  expect(fluEvent.canHappen(w)).toBe(false);
  const ids = moodModifiers(a, w.tick).map((m) => m.id);
  expect(ids).toContain('flu');
  expect(ids).not.toContain('workingSick'); // aún no se ha decidido
  a.needs.hunger = 50;
  b.sick = null;
  b.needs.hunger = 50;
  needsSystem(w);
  expect(50 - a.needs.hunger).toBeCloseTo((50 - b.needs.hunger) * 1.3, 9);
  expect(checkInvariants(w)).toEqual([]);
});

function sickA() {
  const x = calm();
  x.b.sick = { until: 1e9, plan: 'work' };
  for (const s of x.w.survivors.slice(2)) s.sick = { until: 1e9, plan: 'work' };
  fluEvent.happen(x.w);
  return { ...x, d: x.w.decisions[0]! };
}

test('Que descanse: se cura a los 2 días y mientras no saquea', () => {
  const { w, a, d } = sickA();
  const start = w.tick;
  issue(w, { type: 'decide', decisionId: d.id, option: 0 });
  step(w);
  expect(a.sick).toEqual({ until: start + 2 * TICKS_PER_DAY, plan: 'rest' });
  for (const c of w.containers) c.designated = true;
  a.work.loot = true;
  const job = findWork(a, w);
  expect(job === null || (job.type === 'moveTo' && job.then?.type === 'unload')).toBe(true);
  expect(moodModifiers(a, w.tick).map((m) => m.id)).not.toContain('workingSick');
  w.tick = start + 2 * TICKS_PER_DAY;
  step(w);
  expect(a.sick).toBeNull();
  expect(w.log.at(-1)).toMatchObject({ kind: 'fluOver', survivorId: a.id });
});

test('Que siga trabajando (o si caduca): 4 días y "Trabaja con gripe" −5', () => {
  for (const timeout of [false, true]) {
    const { w, a, d } = sickA();
    const start = w.tick;
    if (timeout) w.tick = d.expiresAt;
    else issue(w, { type: 'decide', decisionId: d.id, option: 1 });
    step(w);
    expect(a.sick).toEqual({ until: start + 4 * TICKS_PER_DAY, plan: 'work' });
    expect(moodModifiers(a, w.tick)).toContainEqual({ id: 'workingSick', value: -5 });
    for (const c of w.containers) c.designated = true;
    a.work.loot = true;
    a.carrying.food = 0;
    expect(findWork(a, w)?.type).toBe('moveTo');
  }
});
