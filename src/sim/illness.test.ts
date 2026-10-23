// H5 §7: la fiebre — la infección oculta y la gripe del narrador se ven igual; sus etapas, sus
// síntomas y el aviso de tres opciones.
import { expect, test } from 'vitest';
import {
  FEVER_HUNGER_MULT,
  FEVER_MOOD,
  MERCY_TICKS,
  NAUSEA_HUNGER_MULT,
  NAUSEA_MOOD,
  NAUSEA_PAIN,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './balance';
import { addWound, knockDown, painOf } from './body';
import { brains } from './brain';
import { deathSystem } from './death';
import { expireDecisions } from './events/resolve';
import { fluEvent } from './events/flu';
import { healthSystem } from './health';
import { illnessSystem, startFever } from './illness';
import { checkInvariants } from './invariants';
import { setTile } from './map/grid';
import { moodModifiers } from './mood';
import { issue, ordersSystem } from './orders';
import { step } from './step';
import { needsSystem } from './systems/needs';
import { addBase, addSurvivor, emptyWorld, withoutZombies } from './testing/fixtures';
import { Tile, type Survivor, type World } from './types';
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

test('infección: el mordisco infecta siempre, el arañazo 3 de cada 100 (ajuste), el corte nunca; muere a las 48–72 h', () => {
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
  expect(infected / 1000).toBeGreaterThan(0.015);
  expect(infected / 1000).toBeLessThan(0.05);
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

// --- H5 §7.4: Que se vaya y Acabar con su sufrimiento ---

/** Con carretera de lado a lado en y = 12 (sus extremos, (0, 12) y (39, 12)); Bea y Cris dentro. */
function colony() {
  const x = world();
  for (let i = 0; i < 40; i++) setTile(x.w.grid, i, 12, Tile.Road);
  const bea = addSurvivor(x.w, { x: 6, y: 5 });
  const cris = addSurvivor(x.w, { x: 8, y: 6 }, 'Cris');
  for (const s of x.w.survivors) s.carrying.bandage = 2; // que no vayan a por vendas
  return { ...x, bea, cris };
}

const answer = (w: World, option: 0 | 1 | 2) => {
  issue(w, { type: 'decide', decisionId: w.decisions[0]!.id, option });
  ordersSystem(w);
};

test('Que se vaya: deja lo suyo en el almacén y se marcha a pie por la carretera más cercana', () => {
  const { w, ana, bea, cris } = colony();
  ana.partnerId = bea.id;
  bea.partnerId = ana.id;
  ana.carrying.food = 2;
  ana.equipped = 'knife';
  const before = { ...w.storage.items };
  startFever(w, ana, 'flu');
  answer(w, 1);
  expect(w.storage.items).toMatchObject({
    food: before.food + 2,
    bandage: before.bandage + 2,
    knife: before.knife + 1,
  });
  expect(ana.equipped).toBeNull();
  expect(w.survivors).not.toContain(ana);
  expect(w.leaving).toEqual([ana]);
  expect(ana.action).toMatchObject({ type: 'moveTo', target: { x: 0, y: 12 } });
  expect(w.beds[0]!.ownerId).toBe(bea.id); // su cama, para otro
  expect(w.log.some((e) => e.kind === 'banished' && e.name === 'Ana')).toBe(true);
  const grief = (s: Survivor) => moodModifiers(s, w.tick).filter((m) => m.otherId === ana.id);
  expect(grief(cris)).toEqual([
    { id: 'banished', value: -10, expiresAt: w.tick + 72 * H, otherId: ana.id },
  ]);
  expect(grief(bea)).toEqual([
    { id: 'partnerBanished', value: -25, expiresAt: w.tick + 120 * H, otherId: ana.id },
  ]);
  expect(bea.partnerId).toBeNull();
  expect(checkInvariants(w)).toEqual([]);
  for (let i = 0; i < 2000 && w.leaving.length > 0; i++) step(w);
  expect(w.leaving).toEqual([]);
  expect(w.returning).toEqual([
    expect.objectContaining({ kind: 'stranger', pos: { x: 0, y: 12 } }),
  ]);
  const back = w.returning[0]!.at - w.tick;
  expect(back).toBeGreaterThanOrEqual(2 * TICKS_PER_DAY - 1);
  expect(back).toBeLessThanOrEqual(4 * TICKS_PER_DAY);
  expect(checkInvariants(w)).toEqual([]);
});

test('si era gripe, a los 2–4 días vuelve y pide entrar, con la opinión por los suelos', () => {
  const { w, ana, bea } = colony();
  bea.opinions[ana.id] = 30;
  startFever(w, ana, 'flu');
  answer(w, 1);
  for (let i = 0; i < 2000 && w.leaving.length > 0; i++) step(w);
  w.tick = w.returning[0]!.at;
  step(w);
  expect(w.returning).toEqual([]);
  expect(w.stranger?.survivors.map((s) => s.name)).toEqual(['Ana']);
  const back = w.stranger!.survivors[0]!;
  expect(back.fever).toBeNull();
  expect(back.opinions[bea.id]).toBe(-40);
  expect(bea.opinions[back.id]).toBe(-40);
  expect(w.decisions).toEqual([
    expect.objectContaining({ kind: 'stranger', survivorIds: [back.id] }),
  ]);
  expect(w.log.some((e) => e.kind === 'returned' && e.name === 'Ana')).toBe(true);
  expect(checkInvariants(w)).toEqual([]);
});

test('si estaba infectado, al día siguiente su zombi llega por donde salió y va a la base; al verlo, todos lo sienten', () => {
  const { w, ana, bea, cris } = colony();
  ana.infection = { at: w.tick - 12 * H, deathAt: w.tick + 40 * H };
  illnessSystem(w);
  answer(w, 1);
  for (let i = 0; i < 2000 && w.leaving.length > 0; i++) step(w);
  const r = w.returning[0]!;
  expect(r).toMatchObject({ kind: 'zombie', pos: { x: 0, y: 12 } });
  expect(r.at - w.tick).toBeGreaterThan(TICKS_PER_DAY - 5);
  w.tick = r.at;
  step(w);
  const z = w.zombies.find((x) => x.name === 'Ana')!;
  expect(z).toBeDefined();
  expect(z.state).toBe('alert');
  expect(z.goal).toEqual(w.base.door);
  // Al verlo (aquí, a su lado), "Ana ya es un zombi".
  z.pos = { x: 7.5, y: 11.5 };
  bea.pos = { x: 7.5, y: 10.5 };
  step(w);
  for (const s of [bea, cris])
    expect(moodModifiers(s, w.tick).filter((m) => m.id === 'sawTurned')).toEqual([
      expect.objectContaining({ value: -15, otherId: ana.id }),
    ]);
  expect(w.log.filter((e) => e.kind === 'sawTurned')).toHaveLength(1);
  step(w);
  expect(w.log.filter((e) => e.kind === 'sawTurned')).toHaveLength(1); // una sola vez
});

test('Acabar con su sufrimiento: va el más cercano que puede, tarda media hora y el cuerpo no se levanta', () => {
  const { w, ana, bea, cris } = colony();
  ana.infection = { at: w.tick - 12 * H, deathAt: w.tick + 40 * H };
  illnessSystem(w);
  cris.pos = { x: 5.5, y: 5.5 }; // la más cercana, pero en modo combate
  cris.drafted = true;
  bea.pos = { x: 7.5, y: 5.5 };
  answer(w, 2);
  expect(w.mercy).toEqual([ana.id]);
  expect(brains.ai.decide(bea, w)).toMatchObject({
    type: 'moveTo',
    then: { type: 'mercy', patientId: ana.id },
  });
  let ticks = 0;
  for (let i = 0; i < 600 && w.survivors.includes(ana); i++) {
    step(w);
    if (bea.action.type === 'mercy') ticks++;
  }
  expect(w.survivors).not.toContain(ana);
  expect(Math.abs(ticks - MERCY_TICKS)).toBeLessThanOrEqual(1);
  expect(w.dead[0]).toMatchObject({ name: 'Ana', cause: 'mercy' });
  expect(w.containers.find((c) => c.name === 'Ana')?.risesAt).toBeUndefined();
  expect(moodModifiers(bea, w.tick).map((m) => [m.id, m.value])).toContainEqual(['hadToKill', -15]);
  expect(moodModifiers(cris, w.tick).map((m) => m.id)).not.toContain('hadToKill');
  expect(moodModifiers(cris, w.tick).map((m) => m.id)).not.toContain('killedForNothing');
  expect(w.mercy).toEqual([]);
  expect(checkInvariants(w)).toEqual([]);
});

test('si era gripe: "Matamos a Ana por nada" (−25, 5 días) y el registro lo dice', () => {
  const { w, ana, bea, cris } = colony();
  startFever(w, ana, 'flu');
  bea.pos = { x: 5.5, y: 5.5 };
  answer(w, 2);
  for (let i = 0; i < 600 && w.survivors.includes(ana); i++) step(w);
  for (const s of [bea, cris])
    expect(moodModifiers(s, w.tick).filter((m) => m.id === 'killedForNothing')).toEqual([
      expect.objectContaining({ value: -25, otherId: ana.id }),
    ]);
  expect(w.log.some((e) => e.kind === 'killedForNothing' && e.name === 'Ana')).toBe(true);
});

test('si no hay nadie que pueda, espera', () => {
  const { w, ana, bea, cris } = colony();
  startFever(w, ana, 'flu');
  knockDown(w, bea);
  cris.drafted = true;
  answer(w, 2);
  for (let i = 0; i < 50; i++) step(w);
  expect(w.survivors).toContain(ana);
  expect(w.mercy).toEqual([ana.id]);
  cris.drafted = false;
  for (let i = 0; i < 600 && w.survivors.includes(ana); i++) step(w);
  expect(w.survivors).not.toContain(ana);
});

test('mientras espera a que alguien acabe con su sufrimiento, come y duerme (no se queda sin comer)', () => {
  const { w, ana } = colony();
  w.survivors = [ana]; // nadie más que pueda hacerlo
  w.beds = w.beds.filter((b) => b.ownerId === ana.id);
  startFever(w, ana, 'flu');
  answer(w, 2);
  expect(w.mercy).toEqual([ana.id]);
  ana.needs.hunger = 10;
  ana.carrying.food = 0;
  w.storage.items.food = 5;
  expect(brains.ai.decide(ana, w)).toMatchObject({ type: 'moveTo', then: { type: 'eat' } });
  ana.needs.hunger = 100;
  ana.action = { type: 'idle', ticksLeft: 0 };
  expect(brains.ai.decide(ana, w)).toBeNull(); // si no, espera donde está
});
