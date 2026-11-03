// H5c3, tras la revisión: morir esperando una horda; cambiar de destino esperando; nada que pida
// respuesta en el último hexágono (ni horda con alguien esperando); y quien se une, como uno más.
import { expect, test } from 'vitest';
import { TICKS_PER_HOUR } from '../balance';
import { hexesWithin } from '../atlas/hex';
import { dayStart } from '../clock';
import { hexToward } from '../expeditions';
import { stepGame } from '../game';
import { checkInvariants } from '../invariants';
import { issue, ordersSystem } from '../orders';
import { addSurvivor, emptyWorld, travelFor } from '../testing/fixtures';
import { Tile } from '../types';
import { defaultWork } from '../world';
import { roadEvent } from './events';
import { roadWeights } from './roll';

function road(steps = 2) {
  const w = emptyWorld(10, 10);
  const { atlas } = w.common;
  w.narrator.nextEventAt = 1e9;
  w.grid.tiles.fill(Tile.Floor);
  const ana = w.survivors[0]!;
  const bea = addSurvivor(w, { x: 1, y: 1 }, 'Bea');
  w.survivors = [];
  const to = hexToward(atlas, atlas.base, 3, 8);
  const t = travelFor(w, { kind: 'go', from: atlas.base, to, members: [ana, bea], hoursLeft: 1 });
  t.at = steps;
  t.nextEventAt = 1e9;
  w.common.expedition.travels.push(t);
  w.tick = dayStart(1) + 9 * TICKS_PER_HOUR;
  return { w, t, ana, bea };
}

test('si alguien muere mientras esperan ante una horda, la decisión sigue con los demás', () => {
  const { w, t, ana, bea } = road();
  roadEvent(w, t, t.path[t.at]!, 'horde');
  ana.dying = 'blood';
  stepGame(w);
  expect(t.members).toEqual([bea]);
  expect(w.decisions[0]!.survivorIds).toEqual([bea.id]);
  expect(checkInvariants(w)).toEqual([]);
});

test('cambiar de destino esperando ante una horda: si la nueva ruta no pasa por ella, siguen sin más', () => {
  const { w, t } = road();
  roadEvent(w, t, t.path[t.at]!, 'horde');
  const horde = w.decisions[0]!;
  issue(w, { type: 'redirectTravel', travelId: t.id, siteId: null }); // a la base, hacia atrás
  ordersSystem(w);
  const zone = new Set(hexesWithin(w.common.atlas, horde.hex!, 1));
  expect(t.path.slice(1).some((i) => zone.has(i))).toBe(false);
  expect(t.waiting).toBeUndefined();
  expect(w.decisions).toEqual([]);
  expect(checkInvariants(w)).toEqual([]);
});

test('cambiar de destino esperando ante una horda: si la nueva ruta sigue pasando, siguen esperando', () => {
  const { w, t } = road();
  w.common.expedition.sites.push({
    id: 1,
    kind: 'farm',
    special: null,
    side: 3,
    hours: 8,
    state: 'known',
    visited: false,
    specialUntil: null,
    leftAt: null,
    extraZombies: 0,
    hex: t.target,
  });
  roadEvent(w, t, t.path[t.at]!, 'horde');
  const id = t.waiting;
  issue(w, { type: 'redirectTravel', travelId: t.id, siteId: 1 }); // el mismo destino
  ordersSystem(w);
  expect(t.waiting).toBe(id);
  expect(checkInvariants(w)).toEqual([]);
});

test('en el último hexágono no pide nada (salvo explorando); y sin horda mientras alguien espera', () => {
  const { w, t } = road();
  t.at = t.path.length - 1;
  expect(roadWeights(w, t, t.path[t.at]!)).toMatchObject({ horde: 0, joiner: 0 });
  t.kind = 'explore';
  expect(roadWeights(w, t, t.path[t.at]!).joiner).toBeGreaterThan(0);
  t.at = 2;
  t.kind = 'go';
  roadEvent(w, t, t.path[t.at]!, 'joiner');
  expect(roadWeights(w, t, t.path[t.at]!).horde).toBe(0);
});

test('quien se une por el camino: trabaja como uno más, cuenta como unido y tiene cama al llegar', () => {
  const { w, t } = road();
  roadEvent(w, t, t.path[t.at]!, 'joiner');
  const j = t.joiner!;
  issue(w, { type: 'decide', decisionId: w.decisions[0]!.id, option: 0 });
  ordersSystem(w);
  expect(j.work).toEqual(defaultWork(j.traits));
  expect(j.outfitId).toBe(w.common.outfits[0]!.id);
  expect(w.common.stats.joined).toContain(j.name);
  // Vuelven a la base: tiene cama.
  t.kind = 'back';
  t.at = t.path.length - 2;
  t.hoursLeft = 0.001;
  stepGame(w);
  expect(w.survivors).toContain(j);
  expect(j.bedId).not.toBeNull();
  expect(checkInvariants(w)).toEqual([]);
});
