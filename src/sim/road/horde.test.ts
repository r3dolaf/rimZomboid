// H5c3 §2: una horda en el camino: el grupo se para y espera la respuesta; rodear (sin pasar por ese
// hexágono ni sus vecinos) o atravesar (más zombis); sin respuesta, rodean.
import { expect, test } from 'vitest';
import { ROAD_DECISION_HOURS, ROAD_HORDE, TICKS_PER_HOUR } from '../balance';
import { hexesWithin } from '../atlas/hex';
import { dayStart } from '../clock';
import { hexToward } from '../expeditions';
import { stepGame } from '../game';
import { checkInvariants } from '../invariants';
import { issue, ordersSystem } from '../orders';
import { addSurvivor, emptyWorld, travelFor } from '../testing/fixtures';
import { roadEvent } from './events';

/** Ana y Bea, de día, de camino 8 hexágonos al este; la horda, en el siguiente. */
function horde() {
  const w = emptyWorld(10, 10);
  const { atlas } = w.common;
  w.narrator.nextEventAt = 1e9;
  const ana = w.survivors[0]!;
  const bea = addSurvivor(w, { x: 1, y: 1 }, 'Bea');
  w.survivors = [];
  const to = hexToward(atlas, atlas.base, 3, 8);
  const t = travelFor(w, { kind: 'go', from: atlas.base, to, members: [ana, bea], hoursLeft: 1 });
  t.at = 2;
  t.nextEventAt = 1e9; // sin más sucesos
  w.common.expedition.travels.push(t);
  w.tick = dayStart(1) + 9 * TICKS_PER_HOUR;
  const ahead = t.path[t.at + 1]!;
  roadEvent(w, t, t.path[t.at]!, 'horde');
  const d = w.decisions.find((x) => x.kind === 'horde')!;
  return { w, t, d, ahead, ana, bea };
}

test('una horda delante: una decisión ligada al viaje, y el grupo espera sin avanzar', () => {
  const { w, t, d, ahead, ana, bea } = horde();
  expect(d).toMatchObject({ travelId: t.id, hex: ahead, survivorIds: [ana.id, bea.id] });
  expect(d.expiresAt).toBe(w.tick + ROAD_DECISION_HOURS * TICKS_PER_HOUR);
  expect(t.waiting).toBe(d.id);
  const at = t.at;
  const left = t.hoursLeft;
  for (let i = 0; i < TICKS_PER_HOUR; i++) stepGame(w);
  expect([t.at, t.hoursLeft]).toEqual([at, left]);
  expect(checkInvariants(w)).toEqual([]);
});

test('rodear: rehacen la ruta sin pasar por la horda ni sus vecinos, y siguen', () => {
  const { w, t, d, ahead } = horde();
  const here = t.path[t.at]!;
  issue(w, { type: 'decide', decisionId: d.id, option: 0 });
  ordersSystem(w);
  expect(t.waiting).toBeUndefined();
  expect(t.path[0]).toBe(here);
  const zone = new Set(hexesWithin(w.common.atlas, ahead, 1));
  expect(t.path.slice(1).some((i) => zone.has(i))).toBe(false);
  expect(t.path.at(-1)).toBe(t.target);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'roadHorde', around: true });
  expect(checkInvariants(w)).toEqual([]);
});

test('atravesar: pelean con muchos zombis y siguen por su ruta', () => {
  const { w, t, d } = horde();
  const path = [...t.path];
  issue(w, { type: 'decide', decisionId: d.id, option: 1 });
  ordersSystem(w);
  expect(t.waiting).toBeUndefined();
  expect(t.path).toEqual(path);
  const e = w.common.log.find((x) => x.kind === 'roadZombies')!;
  expect(e).toMatchObject({ horde: true });
  const n = e.kind === 'roadZombies' ? e.zombies : 0;
  expect(n).toBeGreaterThanOrEqual(ROAD_HORDE[0]);
  expect(n).toBeLessThanOrEqual(ROAD_HORDE[1]);
});

test('sin respuesta, rodean; y si no hay por dónde rodear, la atraviesan', () => {
  const a = horde();
  for (let i = 0; i <= ROAD_DECISION_HOURS * TICKS_PER_HOUR; i++) stepGame(a.w);
  expect(a.t.waiting).toBeUndefined();
  expect(a.w.common.log.some((e) => e.kind === 'roadHorde' && e.around)).toBe(true);
  const b = horde();
  b.t.target = b.ahead; // el destino está en la zona de la horda
  b.t.path = b.t.path.slice(0, b.t.at + 2);
  issue(b.w, { type: 'decide', decisionId: b.d.id, option: 0 });
  ordersSystem(b.w);
  expect(b.w.common.log.some((e) => e.kind === 'roadZombies' && e.horde)).toBe(true);
});

test('si mueren todos mientras esperan, la decisión se va con el viaje', () => {
  const { w, t, ana, bea } = horde();
  for (const s of [ana, bea]) s.dying = 'blood';
  stepGame(w);
  expect(w.common.expedition.travels).not.toContain(t);
  expect(w.decisions.filter((x) => x.kind === 'horde')).toEqual([]);
});

test('las comprobaciones del juego: un viaje que espera tiene su decisión', () => {
  const { w, t } = horde();
  expect(checkInvariants(w)).toEqual([]);
  t.waiting = 999;
  expect(checkInvariants(w).some((p) => p.includes('espera una decisión que no está'))).toBe(true);
});
