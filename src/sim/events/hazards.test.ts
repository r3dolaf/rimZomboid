// Tormenta y gripe (spec H3c §3.3; la gripe, desde H5 §7).
import { expect, test } from 'vitest';
import { FLOOR_SLEEP_FACTOR, SLEEP_GAIN_PER_TICK, TICKS_PER_HOUR } from '../balance';
import { checkInvariants } from '../invariants';
import { moodModifiers } from '../mood';
import { issue } from '../orders';
import { step } from '../step';
import { needsSystem } from '../systems/needs';
import type { Survivor, World } from '../types';
import { findWork } from '../work';
import { createWorld } from '../world';
import { startFever } from '../illness';
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
  expect(w.common.stormUntil - w.tick).toBeGreaterThanOrEqual(8 * TICKS_PER_HOUR);
  expect(w.common.stormUntil - w.tick).toBeLessThanOrEqual(12 * TICKS_PER_HOUR);
  for (const s of w.survivors) expect(s.memories.some((m) => m.id === 'storm')).toBe(true);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'storm' });
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
  w.common.stormUntil = w.tick + 10;
  needsSystem(w);
  expect(a.needs.sleep - 10).toBeCloseTo(normal * 0.75, 9);
});

// --- 12. Gripe (desde H5, una fiebre: ver illness.test.ts) ---

test('gripe: a alguien sin fiebre, la fiebre y su aviso; no vuelve mientras todos tengan', () => {
  const { w, a } = calm();
  expect(fluEvent.tone).toBe('bad');
  expect(fluEvent.severity).toBe(2);
  expect(fluEvent.cooldownDays).toBe(5);
  for (const s of w.survivors) if (s !== a) startFever(w, s, 'flu');
  w.decisions = [];
  fluEvent.happen(w);
  expect(a.fever).toMatchObject({ cause: 'flu', since: w.tick, stage: 'fever', rest: false });
  expect(w.decisions[0]).toMatchObject({ kind: 'fever', survivorIds: [a.id] });
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'fever', survivorId: a.id });
  expect(fluEvent.canHappen(w)).toBe(false);
  expect(moodModifiers(a, w.tick).map((m) => m.id)).toContain('fever');
  expect(checkInvariants(w)).toEqual([]);
});

test('Que descanse (contestado o si caduca): no saquea mientras tenga fiebre', () => {
  for (const timeout of [false, true]) {
    const { w, a } = calm();
    for (const s of w.survivors) if (s !== a) startFever(w, s, 'flu');
    w.decisions = [];
    fluEvent.happen(w);
    const d = w.decisions[0]!;
    if (timeout)
      d.expiresAt = w.tick; // (sin adelantar el reloj: a las 12 h ya estaría peor)
    else issue(w, { type: 'decide', decisionId: d.id, option: 0 });
    step(w);
    expect(a.fever?.rest).toBe(true);
    for (const c of w.containers) c.designated = true;
    a.work.loot = true;
    const job = findWork(a, w);
    expect(job === null || (job.type === 'moveTo' && job.then?.type === 'unload')).toBe(true);
  }
});
