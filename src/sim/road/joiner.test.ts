// H5c3 §2: alguien pide unirse por el camino: espera junto al grupo (que no se para); aceptar, se une;
// rechazar o sin respuesta, se va con lo suyo; si la colonia está llena, también.
import { expect, test } from 'vitest';
import { COLONY_MAX, ROAD_DECISION_HOURS, TICKS_PER_HOUR } from '../balance';
import { dayStart } from '../clock';
import { hexToward } from '../expeditions';
import { stepGame } from '../game';
import { checkInvariants } from '../invariants';
import { issue, ordersSystem } from '../orders';
import { addSurvivor, emptyWorld, travelFor } from '../testing/fixtures';
import { Tile } from '../types';
import { roadEvent } from './events';

/** Ana de camino, de día, a 8 hexágonos; alguien pide unirse. */
function joiner() {
  const w = emptyWorld(10, 10);
  const { atlas } = w.common;
  w.narrator.nextEventAt = 1e9;
  const ana = w.survivors[0]!;
  w.survivors = [];
  const to = hexToward(atlas, atlas.base, 3, 8);
  const t = travelFor(w, { kind: 'go', from: atlas.base, to, members: [ana], hoursLeft: 1 });
  t.at = 1;
  t.nextEventAt = 1e9;
  w.common.expedition.travels.push(t);
  w.tick = dayStart(1) + 9 * TICKS_PER_HOUR;
  roadEvent(w, t, t.path[t.at]!, 'joiner');
  const d = w.decisions.find((x) => x.kind === 'joiner')!;
  return { w, t, d, ana, j: t.joiner! };
}

test('alguien pide unirse: espera junto al grupo (con su ropa contada) y el grupo sigue', () => {
  const { w, t, d, j } = joiner();
  expect(j.worn.length).toBeGreaterThan(0);
  expect(d).toMatchObject({ travelId: t.id, survivorIds: [j.id] });
  expect(d.expiresAt).toBe(w.tick + ROAD_DECISION_HOURS * TICKS_PER_HOUR);
  expect(t.waiting).toBeUndefined();
  expect(checkInvariants(w)).toEqual([]);
  const at = t.at;
  for (let i = 0; i < TICKS_PER_HOUR + 1; i++) stepGame(w);
  expect(t.at).toBeGreaterThan(at);
});

test('aceptar: se une al grupo y viaja con ellos', () => {
  const { w, t, d, ana, j } = joiner();
  issue(w, { type: 'decide', decisionId: d.id, option: 0 });
  ordersSystem(w);
  expect(t.members).toEqual([ana, j]);
  expect(t.joiner).toBeUndefined();
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'roadJoined', name: j.name, names: ['Ana'] });
  expect(checkInvariants(w)).toEqual([]);
});

test('rechazar, o sin respuesta: se va con lo suyo (su ropa sale de las cuentas)', () => {
  const a = joiner();
  const gone = a.w.common.pieceLog.gone;
  issue(a.w, { type: 'decide', decisionId: a.d.id, option: 1 });
  ordersSystem(a.w);
  expect(a.t.joiner).toBeUndefined();
  expect(a.t.members).toEqual([a.ana]);
  expect(a.w.common.pieceLog.gone).toBeGreaterThan(gone);
  expect(a.w.common.log.at(-1)).toMatchObject({
    kind: 'roadJoinerLeft',
    name: a.j.name,
    full: false,
  });
  expect(checkInvariants(a.w)).toEqual([]);
  const b = joiner();
  for (let i = 0; i <= ROAD_DECISION_HOURS * TICKS_PER_HOUR; i++) stepGame(b.w);
  expect(b.t.joiner).toBeUndefined();
  expect(b.w.common.log.some((e) => e.kind === 'roadJoinerLeft')).toBe(true);
  expect(checkInvariants(b.w)).toEqual([]);
});

test('con la colonia llena, aunque se acepte, se va', () => {
  const { w, t, d, ana } = joiner();
  w.survivors = [ana];
  for (let i = 1; i < COLONY_MAX; i++) addSurvivor(w, { x: 1, y: 1 }, `P${i}`);
  w.survivors.shift(); // 7 en la base y Ana de viaje: 8
  issue(w, { type: 'decide', decisionId: d.id, option: 0 });
  ordersSystem(w);
  expect(t.members).toEqual([ana]);
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'roadJoinerLeft', full: true });
});

test('si el grupo llega o se queda sin nadie, quien esperaba se va y la decisión también', () => {
  const a = joiner();
  a.t.kind = 'back'; // (llegan a la base, que tiene suelo)
  a.w.grid.tiles.fill(Tile.Floor);
  a.t.at = a.t.path.length - 2;
  a.t.hoursLeft = 0.001;
  stepGame(a.w);
  expect(a.w.common.expedition.travels).not.toContain(a.t);
  expect(a.w.decisions).toEqual([]);
  expect(checkInvariants(a.w)).toEqual([]);
  const b = joiner();
  b.ana.dying = 'blood';
  stepGame(b.w);
  expect(b.w.common.expedition.travels).toEqual([]);
  expect(b.w.decisions).toEqual([]);
  expect(checkInvariants(b.w)).toEqual([]);
});
