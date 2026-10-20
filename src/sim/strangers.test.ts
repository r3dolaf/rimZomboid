// Recién llegados (H3b §6): aparecen, esperan a la puerta y el jugador los acepta o rechaza.
import { expect, test } from 'vitest';
import { BED_SLOTS, TICKS_PER_DAY } from './balance';
import { checkInvariants } from './invariants';
import { getTile } from './map/grid';
import { issue } from './orders';
import { step } from './step';
import { doorOutside } from './systems/strangers';
import { Tile, type World } from './types';
import { createWorld, tileOf } from './world';

/** Hace que llegue el desconocido ya. */
function untilStranger(w: World): void {
  w.nextStrangerAt = w.tick + 1;
  for (let i = 0; i < 5 && w.stranger === null; i++) step(w);
}

/** Hasta que el desconocido espera a la puerta. */
function atDoor(w: World): void {
  const s = w.stranger!.survivor;
  for (let i = 0; i < TICKS_PER_DAY && s.action.type !== 'idle'; i++) step(w);
}

function runUntil(w: World, cond: () => boolean, max: number): boolean {
  for (let i = 0; i < max; i++) {
    if (cond()) return true;
    step(w);
  }
  return cond();
}

test('aparece en una carretera del borde del mapa, con lo suyo, y queda en el registro', () => {
  for (const seed of [1, 2, 3]) {
    const w = createWorld(seed);
    untilStranger(w);
    const st = w.stranger!;
    expect(st).not.toBeNull();
    const s = st.survivor;
    const t = tileOf(s.pos);
    const edge = t.x === 0 || t.y === 0 || t.x === w.grid.width - 1 || t.y === w.grid.height - 1;
    expect(edge).toBe(true);
    expect(getTile(w.grid, t.x, t.y)).toBe(Tile.Road);
    expect(w.survivors.map((x) => x.name)).not.toContain(s.name);
    expect(w.survivors.map((x) => x.id)).not.toContain(s.id);
    expect(s.carrying.food).toBeGreaterThanOrEqual(0);
    expect(s.carrying.food).toBeLessThanOrEqual(4);
    expect(s.carrying.bandage).toBeLessThanOrEqual(1);
    expect(s.bedId).toBeNull();
    expect(st.expiresAt).toBe(w.tick - 1 + TICKS_PER_DAY);
    expect(st.leaving).toBe(false);
    expect(w.log.at(-1)).toMatchObject({ kind: 'strangerArrived', name: s.name });
    expect(checkInvariants(w)).toEqual([]);
  }
});

test('camina hasta la puerta de la base y espera allí', () => {
  const w = createWorld(2);
  untilStranger(w);
  const s = w.stranger!.survivor;
  const door = doorOutside(w);
  expect(runUntil(w, () => s.action.type === 'idle', TICKS_PER_DAY / 2)).toBe(true);
  expect(tileOf(s.pos)).toEqual(door);
  for (let i = 0; i < 100; i++) step(w);
  expect(tileOf(s.pos)).toEqual(door);
  expect(w.stranger).not.toBeNull();
});

test('al aceptarlo pasa a la colonia con cama y permiso de saquear', () => {
  const w = createWorld(2);
  untilStranger(w);
  const s = w.stranger!.survivor;
  issue(w, { type: 'acceptStranger' });
  step(w);
  expect(w.stranger).toBeNull();
  const joined = w.survivors.find((x) => x.id === s.id)!;
  expect(joined).toBeDefined();
  expect(joined.opinions).toEqual({});
  expect(joined.work.loot).toBe(!joined.traits.includes('coward'));
  const bed = w.beds.find((b) => b.id === joined.bedId)!;
  const r = w.base.rect;
  expect(bed.pos).toEqual({ x: r.x + BED_SLOTS[3]!.dx, y: r.y + BED_SLOTS[3]!.dy });
  expect(bed.ownerId).toBe(joined.id);
  expect(w.log.at(-1)).toMatchObject({ kind: 'strangerAccepted', name: s.name });
  expect(w.nextStrangerAt).toBeGreaterThanOrEqual(w.tick - 1 + 3 * TICKS_PER_DAY);
  expect(w.nextStrangerAt).toBeLessThanOrEqual(w.tick - 1 + 6 * TICKS_PER_DAY);
  expect(checkInvariants(w)).toEqual([]);
});

test('con las 5 camas ocupadas, el siguiente duerme en el suelo; con 8 no llega nadie más', () => {
  const w = createWorld(2);
  for (let n = 4; n <= 8; n++) {
    untilStranger(w);
    expect(w.stranger).not.toBeNull();
    issue(w, { type: 'acceptStranger' });
    step(w);
    expect(w.survivors).toHaveLength(n);
    expect(w.survivors.at(-1)!.bedId === null).toBe(n > 5);
    expect(checkInvariants(w)).toEqual([]);
  }
  expect(w.beds).toHaveLength(5);
  expect(new Set(w.beds.map((b) => `${b.pos.x},${b.pos.y}`)).size).toBe(5);
  untilStranger(w);
  expect(w.stranger).toBeNull();
  expect(w.nextStrangerAt).toBeGreaterThan(w.tick);
  // Todos los nombres distintos.
  expect(new Set(w.survivors.map((s) => s.name)).size).toBe(8);
});

test('al rechazarlo se va al borde del mapa y desaparece', () => {
  const w = createWorld(2);
  untilStranger(w);
  atDoor(w);
  const name = w.stranger!.survivor.name;
  issue(w, { type: 'rejectStranger' });
  step(w);
  expect(w.stranger?.leaving).toBe(true);
  expect(w.log.at(-1)).toMatchObject({ kind: 'strangerRejected', name });
  // Ya no se le puede aceptar.
  issue(w, { type: 'acceptStranger' });
  step(w);
  expect(w.survivors).toHaveLength(3);
  expect(runUntil(w, () => w.stranger === null, TICKS_PER_DAY)).toBe(true);
  expect(w.nextStrangerAt).toBeGreaterThan(w.tick + 2 * TICKS_PER_DAY);
});

test('si nadie contesta en un día, se marcha', () => {
  const w = createWorld(2);
  untilStranger(w);
  atDoor(w);
  const name = w.stranger!.survivor.name;
  w.tick = w.stranger!.expiresAt - 1;
  step(w);
  expect(w.stranger?.leaving).toBe(false);
  step(w);
  expect(w.stranger?.leaving).toBe(true);
  expect(w.log.at(-1)).toMatchObject({ kind: 'strangerLeft', name });
});

test('sin desconocido, aceptar o rechazar no hace nada', () => {
  const w = createWorld(2);
  issue(w, { type: 'acceptStranger' });
  issue(w, { type: 'rejectStranger' });
  step(w);
  expect(w.survivors).toHaveLength(3);
  expect(w.log).toEqual([]);
});

test('el mundo con un desconocido sobrevive a JSON', () => {
  const w = createWorld(2);
  untilStranger(w);
  expect(JSON.parse(JSON.stringify(w))).toEqual(w);
});
