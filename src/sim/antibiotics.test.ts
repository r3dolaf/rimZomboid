// H6a §1: los antibióticos curan la infección de un arañazo o un corte si se dan a tiempo (antes de
// las náuseas); no la de un mordisco ni la gripe. Se dan con la decisión de la fiebre; de viaje, solos.
import { expect, test } from 'vitest';
import { INFECTION_FEVER_HOURS, INFECTION_NAUSEA_HOURS, TICKS_PER_HOUR } from './balance';
import { addWound } from './body';
import { dayStart } from './clock';
import { hexToward } from './expeditions';
import { stepGame } from './game';
import { illnessSystem, startFever } from './illness';
import { checkInvariants } from './invariants';
import { issue, ordersSystem } from './orders';
import { emptyWorld, travelFor } from './testing/fixtures';
import type { World } from './types';

const H = TICKS_PER_HOUR;

/** Ana con una infección de arañazo de hace `hours` horas (y su aviso de fiebre, si toca). */
function infected(hours: number, bite = false): { w: World; ana: World['survivors'][number] } {
  const w = emptyWorld(10, 10);
  w.tick = dayStart(2);
  const ana = w.survivors[0]!;
  ana.infection = { at: w.tick - hours * H, deathAt: w.tick + 40 * H, bite };
  illnessSystem(w);
  return { w, ana };
}

const fever = (w: World) => w.decisions.find((d) => d.kind === 'fever')!;

test('un mordisco recuerda que lo fue, también si ya había infección de un arañazo', () => {
  const w = emptyWorld(10, 10);
  const ana = w.survivors[0]!;
  addWound(w, ana, 'leftArm', 'bite');
  expect(ana.infection?.bite).toBe(true);
  const bea = infected(1).ana;
  expect(bea.infection?.bite).toBe(false);
  addWound(w, bea, 'leftArm', 'bite');
  expect(bea.infection?.bite).toBe(true);
});

test('a tiempo, la infección de un arañazo se cura: sin infección ni fiebre, y se gasta uno', () => {
  const { w, ana } = infected(INFECTION_FEVER_HOURS + 1);
  w.storage.items.antibiotics = 2;
  expect(ana.fever?.cause).toBe('infection');
  issue(w, { type: 'decide', decisionId: fever(w).id, option: 3 });
  ordersSystem(w);
  expect(ana.infection).toBeNull();
  expect(ana.fever).toBeNull();
  expect(w.storage.items.antibiotics).toBe(1);
  expect(w.decisions.filter((d) => d.kind === 'fever')).toEqual([]);
  expect(w.common.log.map((e) => e.kind)).toEqual(
    expect.arrayContaining(['antibiotics', 'infectionCured']),
  );
  expect(checkInvariants(w)).toEqual([]);
});

test('tarde, o de un mordisco, no curan: se gasta y descansa, nada más', () => {
  const late = infected(INFECTION_NAUSEA_HOURS + 1);
  late.w.storage.items.antibiotics = 1;
  issue(late.w, { type: 'decide', decisionId: fever(late.w).id, option: 3 });
  ordersSystem(late.w);
  expect(late.ana.infection).not.toBeNull();
  expect(late.ana.fever?.rest).toBe(true);
  expect(late.w.storage.items.antibiotics).toBe(0);
  const bite = infected(INFECTION_FEVER_HOURS + 1, true);
  bite.w.storage.items.antibiotics = 1;
  issue(bite.w, { type: 'decide', decisionId: fever(bite.w).id, option: 3 });
  ordersSystem(bite.w);
  expect(bite.ana.infection).not.toBeNull();
  expect(bite.w.common.log.some((e) => e.kind === 'infectionCured')).toBe(false);
});

test('con gripe no hacen nada (la gripe sigue); sin antibióticos, es como «Que descanse»', () => {
  const w = emptyWorld(10, 10);
  const ana = w.survivors[0]!;
  startFever(w, ana, 'flu');
  w.storage.items.antibiotics = 1;
  issue(w, { type: 'decide', decisionId: fever(w).id, option: 3 });
  ordersSystem(w);
  expect(ana.fever).toMatchObject({ cause: 'flu', rest: true });
  expect(w.storage.items.antibiotics).toBe(0);
  const b = infected(INFECTION_FEVER_HOURS + 1);
  issue(b.w, { type: 'decide', decisionId: fever(b.w).id, option: 3 });
  ordersSystem(b.w);
  expect(b.ana.infection).not.toBeNull();
  expect(b.ana.fever?.rest).toBe(true);
});

test('si lo lleva encima, se usa el suyo (aunque el almacén esté vacío)', () => {
  const { w, ana } = infected(INFECTION_FEVER_HOURS + 1);
  ana.carrying.antibiotics = 1;
  issue(w, { type: 'decide', decisionId: fever(w).id, option: 3 });
  ordersSystem(w);
  expect(ana.infection).toBeNull();
  expect(ana.carrying.antibiotics).toBe(0);
});

test('de viaje, quien lleva antibióticos y ya tendría fiebre toma uno (solo una vez)', () => {
  const w = emptyWorld(10, 10);
  const { atlas } = w.common;
  w.narrator.nextEventAt = 1e9;
  const ana = w.survivors[0]!;
  w.survivors = [];
  w.tick = dayStart(2) + 9 * H;
  const t = travelFor(w, {
    kind: 'go',
    from: atlas.base,
    to: hexToward(atlas, atlas.base, 3, 6),
    members: [ana],
    hoursLeft: 3,
  });
  t.nextEventAt = 1e12;
  w.common.expedition.travels.push(t);
  ana.carrying.antibiotics = 2;
  ana.infection = {
    at: w.tick - (INFECTION_FEVER_HOURS - 1) * H,
    deathAt: w.tick + 40 * H,
    bite: true,
  };
  stepGame(w);
  expect(ana.carrying.antibiotics).toBe(2); // aún no tendría fiebre
  for (let i = 0; i < H + 1; i++) stepGame(w);
  expect(ana.carrying.antibiotics).toBe(1); // lo toma, pero de mordisco no cura
  expect(ana.infection).not.toBeNull();
  for (let i = 0; i < H; i++) stepGame(w);
  expect(ana.carrying.antibiotics).toBe(1); // no vuelve a tomar
});
