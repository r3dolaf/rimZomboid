// H5 §7: la fiebre — la infección oculta y la gripe del narrador se ven igual; sus etapas, sus
// síntomas y el aviso de tres opciones.
import { expect, test } from 'vitest';
import {
  FEVER_HUNGER_MULT,
  FEVER_MOOD,
  NAUSEA_HUNGER_MULT,
  NAUSEA_MOOD,
  NAUSEA_PAIN,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './balance';
import { addWound, painOf } from './body';
import { brains } from './brain';
import { deathSystem } from './death';
import { expireDecisions } from './events/resolve';
import { fluEvent } from './events/flu';
import { healthSystem } from './health';
import { illnessSystem, startFever } from './illness';
import { checkInvariants } from './invariants';
import { moodModifiers } from './mood';
import { issue, ordersSystem } from './orders';
import { needsSystem } from './systems/needs';
import { addBase, addSurvivor, emptyWorld, withoutZombies } from './testing/fixtures';
import type { Survivor, World } from './types';
import { findWork } from './work';

const H = TICKS_PER_HOUR;

/** Base en (2, 2)–(11, 9); Ana dentro, sana. */
function world(): { w: World; ana: Survivor } {
  const w = withoutZombies(addBase(emptyWorld(40, 40), { x: 2, y: 2, w: 10, h: 8 }));
  w.seen.fill(1);
  w.tick = TICKS_PER_DAY / 2;
  const ana = w.survivors[0]!;
  ana.pos = { x: 4.5, y: 5.5 };
  return { w, ana };
}

/** Pasa el tiempo hasta `tick` solo con la enfermedad, la salud y la muerte (sin moverse). */
function until(w: World, tick: number, each?: () => void): void {
  while (w.tick < tick) {
    each?.();
    illnessSystem(w);
    healthSystem(w);
    deathSystem(w);
    w.tick++;
  }
}

test('infección: el mordisco infecta siempre, el arañazo 1 de cada 10, el corte nunca; muere a las 48–72 h', () => {
  const { w, ana } = world();
  addWound(w, ana, 'leftLeg', 'cut');
  expect(ana.infection).toBeNull();
  addWound(w, ana, 'leftArm', 'bite');
  expect(ana.infection?.at).toBe(w.tick);
  const death = ana.infection!.deathAt - w.tick;
  expect(death).toBeGreaterThanOrEqual(48 * H);
  expect(death).toBeLessThanOrEqual(72 * H);
  const first = ana.infection;
  w.tick += 10;
  addWound(w, ana, 'rightArm', 'bite');
  expect(ana.infection).toBe(first); // la segunda no cambia nada
  let infected = 0;
  for (let i = 0; i < 1000; i++) {
    ana.infection = null;
    ana.wounds = [];
    addWound(w, ana, 'leftLeg', 'scratch');
    if (ana.infection) infected++;
  }
  expect(infected / 1000).toBeGreaterThan(0.07);
  expect(infected / 1000).toBeLessThan(0.13);
});

test('infección: fiebre a las 12 h, náuseas a las 24, muy grave 6 h antes de morir (y no se levanta) y muere', () => {
  const { w, ana } = world();
  const start = w.tick;
  ana.infection = { at: start, deathAt: start + 50 * H };
  until(w, start + 12 * H - 1);
  expect(ana.fever).toBeNull();
  until(w, start + 12 * H + 1);
  expect(ana.fever).toMatchObject({ cause: 'infection', stage: 'fever', rest: false });
  expect(w.decisions).toEqual([expect.objectContaining({ kind: 'fever', survivorIds: [ana.id] })]);
  expect(w.decisions[0]!.worse).toBeUndefined();
  expect(w.log.some((e) => e.kind === 'fever' && e.survivorId === ana.id)).toBe(true);
  until(w, start + 24 * H + 1);
  expect(ana.fever?.stage).toBe('nausea');
  expect(w.decisions).toEqual([expect.objectContaining({ kind: 'fever', worse: true })]);
  expect(w.log.some((e) => e.kind === 'feverWorse' && e.survivorId === ana.id)).toBe(true);
  until(w, start + 44 * H + 1, () => (ana.needs.hunger = 100));
  expect(ana.fever?.stage).toBe('grave');
  expect(ana.action.type).toBe('downed');
  until(w, start + 50 * H - 1, () => (ana.needs.hunger = 100));
  expect(ana.action.type).toBe('downed'); // ya no se levanta
  until(w, start + 50 * H + 1, () => (ana.needs.hunger = 100));
  expect(w.survivors).not.toContain(ana);
  expect(w.dead[0]).toMatchObject({ name: 'Ana', cause: 'infection' });
  expect(w.containers.find((c) => c.name === 'Ana')?.risesAt).toBeDefined();
  expect(checkInvariants(w)).toEqual([]);
});

test('gripe (narrador): la misma fiebre, el mismo aviso y lo mismo en el registro', () => {
  const { w, ana } = world();
  expect(fluEvent.canHappen(w)).toBe(true);
  fluEvent.happen(w);
  expect(ana.fever).toMatchObject({ cause: 'flu', stage: 'fever', rest: false, since: w.tick });
  expect(w.decisions).toEqual([expect.objectContaining({ kind: 'fever', survivorIds: [ana.id] })]);
  expect(w.log.at(-1)).toEqual({ tick: w.tick, kind: 'fever', survivorId: ana.id });
  expect(fluEvent.canHappen(w)).toBe(false);
  // Y la infección, a las 12 h, igual.
  const x = world();
  x.ana.infection = { at: x.w.tick - 12 * H, deathAt: x.w.tick + 40 * H };
  illnessSystem(x.w);
  expect(x.w.log.at(-1)).toEqual({ tick: x.w.tick, kind: 'fever', survivorId: x.ana.id });
  expect(moodModifiers(x.ana, x.w.tick)).toEqual(moodModifiers(ana, w.tick));
  expect(x.w.decisions.map((d) => [d.kind, d.worse])).toEqual(
    w.decisions.map((d) => [d.kind, d.worse]),
  );
});

/** Ana con gripe, que descansa (o no) todo el tiempo; `badLuck`, si le toca la mala suerte. */
function flu(rest: boolean, badLuck = false) {
  const x = world();
  startFever(x.w, x.ana, 'flu');
  x.ana.fever!.badLuck = badLuck;
  x.ana.fever!.rest = rest;
  const start = x.w.tick;
  const each = () => {
    x.ana.needs.hunger = 100;
    if (rest && x.ana.action.type !== 'downed') x.ana.action = { type: 'rest' };
  };
  return { ...x, start, each };
}

test('gripe descansando todo el tiempo (y sin mala suerte): sin náuseas y se cura a los 2 días', () => {
  const { w, ana, start, each } = flu(true);
  until(w, start + 47 * H, each);
  expect(ana.fever?.stage).toBe('fever');
  until(w, start + 48 * H + 1, each);
  expect(ana.fever).toBeNull();
  expect(w.log.some((e) => e.kind === 'feverGone' && e.survivorId === ana.id)).toBe(true);
});

test('gripe descansando pero con mala suerte: náuseas a las 12 h igualmente', () => {
  const { w, ana, start, each } = flu(true, true);
  until(w, start + 12 * H + 1, each);
  expect(ana.fever?.stage).toBe('nausea');
  until(w, start + 48 * H + 1, each);
  expect(ana.fever).toBeNull();
});

test('gripe sin descansar: náuseas a las 12 h, muy grave a las 36 (derribado 6 h), curada a los 4 días; no muere', () => {
  const { w, ana, start, each } = flu(false);
  until(w, start + 12 * H + 1, each);
  expect(ana.fever?.stage).toBe('nausea');
  until(w, start + 36 * H + 1, each);
  expect(ana.fever?.stage).toBe('grave');
  expect(ana.action.type).toBe('downed');
  until(w, start + 42 * H - 10, each);
  expect(ana.action.type).toBe('downed');
  until(w, start + 43 * H, each);
  expect(ana.action.type).not.toBe('downed');
  expect(ana.fever?.stage).toBe('nausea');
  until(w, start + 96 * H - 1, each);
  expect(ana.fever).not.toBeNull();
  until(w, start + 96 * H + 1, each);
  expect(ana.fever).toBeNull();
  expect(w.survivors).toContain(ana);
});

test('síntomas: fiebre −15 y hambre ×1,3; náuseas, −10 más, hambre ×2 y +20 de dolor', () => {
  expect([FEVER_MOOD, NAUSEA_MOOD, FEVER_HUNGER_MULT, NAUSEA_HUNGER_MULT, NAUSEA_PAIN]).toEqual([
    -15, -10, 1.3, 2, 20,
  ]);
  const { w, ana } = world();
  const bea = addSurvivor(w, { x: 6, y: 5 });
  startFever(w, ana, 'flu');
  expect(moodModifiers(ana, w.tick)).toContainEqual({ id: 'fever', value: -15 });
  for (const s of [ana, bea]) s.needs.hunger = 50;
  needsSystem(w);
  expect(50 - ana.needs.hunger).toBeCloseTo((50 - bea.needs.hunger) * 1.3, 9);
  expect(painOf(ana, w.tick)).toBe(0);
  ana.fever!.stage = 'nausea';
  const ids = moodModifiers(ana, w.tick).map((m) => [m.id, m.value]);
  expect(ids).toContainEqual(['fever', -15]);
  expect(ids).toContainEqual(['nausea', -10]);
  for (const s of [ana, bea]) s.needs.hunger = 50;
  needsSystem(w);
  expect(50 - ana.needs.hunger).toBeCloseTo((50 - bea.needs.hunger) * 2, 9);
  expect(painOf(ana, w.tick)).toBe(20);
});

test('aviso de fiebre: si nadie contesta, al día Que descanse; hasta entonces, no descansa', () => {
  const { w, ana } = world();
  ana.carrying.bandage = 2; // que no vaya a por vendas
  startFever(w, ana, 'flu');
  const a = brains.ai.decide(ana, w);
  expect(a?.type === 'moveTo' ? a.then?.type : a?.type).not.toBe('rest');
  w.tick = w.decisions[0]!.expiresAt;
  expireDecisions(w);
  expect(ana.fever?.rest).toBe(true);
  expect(w.log.at(-1)).toMatchObject({ kind: 'feverRest', survivorId: ana.id });
  expect(brains.ai.decide(ana, w)).toMatchObject({ type: 'moveTo', then: { type: 'rest' } });
});

test('Que descanse: no trabaja y se acuesta hasta que se le pase la fiebre', () => {
  const { w, ana } = world();
  ana.carrying.bandage = 2;
  startFever(w, ana, 'flu');
  issue(w, { type: 'decide', decisionId: w.decisions[0]!.id, option: 0 });
  ordersSystem(w);
  expect(ana.fever?.rest).toBe(true);
  for (const c of w.containers) c.designated = true;
  w.blueprints.push({ id: 70, kind: 'campfire', pos: { x: 6, y: 6 }, wood: 3, progress: 0 });
  w.woodLog.start = 3;
  expect(findWork(ana, w)).toBeNull();
  ana.action = { type: 'rest' };
  expect(brains.ai.decide(ana, w)).toBeNull(); // sigue
  ana.fever = null;
  expect(brains.ai.decide(ana, w)).toEqual({ type: 'idle', ticksLeft: 0 });
});

test('invariantes: la fiebre bien formada', () => {
  const { w, ana } = world();
  startFever(w, ana, 'flu');
  expect(checkInvariants(w)).toEqual([]);
  ana.fever!.since = Number.NaN;
  expect(checkInvariants(w).join()).toMatch(/fiebre/);
});
