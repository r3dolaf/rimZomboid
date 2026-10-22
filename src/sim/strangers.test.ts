// Recién llegados (H3b §6, H3c §3.3): el narrador los trae y el jugador decide.
import { expect, test } from 'vitest';
import { COLONY_MAX, TICKS_PER_DAY } from './balance';
import { baseLayout } from './base';
import { strangersEvent } from './events/strangers';
import { checkInvariants } from './invariants';
import { getTile } from './map/grid';
import { narratorSystem } from './narrator';
import { issue } from './orders';
import { opinionOf } from './social';
import { step } from './step';
import { doorOutside } from './systems/strangers';
import { Tile, type World } from './types';
import { createWorld, tileOf } from './world';

/** Mundo a partir del día 3, sin sucesos del narrador. */
function world(seed = 2): World {
  const w = createWorld(seed);
  w.tick = 3 * TICKS_PER_DAY;
  w.narrator.nextEventAt = 1e9;
  w.narrator.phaseEndsAt = 1e9; // si no, el cambio de fase adelanta el siguiente suceso
  return w;
}

/** Hace que lleguen ya (uno solo, o dos con `pair`). */
function arrive(w: World, pair = false): void {
  for (let i = 0; ; i++) {
    const copy = structuredClone(w);
    copy.rng = { s: i * 9973 + 1 };
    strangersEvent.happen(copy);
    if ((copy.stranger!.survivors.length === 2) === pair) {
      Object.assign(w, copy);
      return;
    }
    if (i > 500) throw new Error('no salió lo pedido');
  }
}

const decision = (w: World) => w.decisions.find((d) => d.kind === 'stranger')!;

function atDoor(w: World): void {
  const ss = w.stranger!.survivors;
  for (let i = 0; i < TICKS_PER_DAY && ss.some((s) => s.action.type !== 'idle'); i++) step(w);
}

function runUntil(w: World, cond: () => boolean, max: number): boolean {
  for (let i = 0; i < max; i++) {
    if (cond()) return true;
    step(w);
  }
  return cond();
}

test('se pueden dar: desde el día 3, con sitio y sin otro esperando', () => {
  const w = world();
  expect(strangersEvent.tone).toBe('mixed');
  expect(strangersEvent.cooldownDays).toBe(3);
  expect(strangersEvent.canHappen(w)).toBe(true);
  w.tick = 3 * TICKS_PER_DAY - 1;
  expect(strangersEvent.canHappen(w)).toBe(false);
  w.tick = 3 * TICKS_PER_DAY;
  arrive(w);
  expect(strangersEvent.canHappen(w)).toBe(false);
  const full = world();
  while (full.survivors.length < COLONY_MAX)
    full.survivors.push({ ...structuredClone(full.survivors[0]!), id: full.nextId++, bedId: null });
  expect(strangersEvent.canHappen(full)).toBe(false);
});

test('aparece en una carretera del borde, con lo suyo, con una decisión y en el registro', () => {
  for (const seed of [1, 2, 3]) {
    const w = world(seed);
    arrive(w);
    const [s] = w.stranger!.survivors;
    const t = tileOf(s!.pos);
    const edge = t.x === 0 || t.y === 0 || t.x === w.grid.width - 1 || t.y === w.grid.height - 1;
    expect(edge).toBe(true);
    expect(getTile(w.grid, t.x, t.y)).toBe(Tile.Road);
    expect(w.survivors.map((x) => x.name)).not.toContain(s!.name);
    expect(s!.carrying.food).toBeLessThanOrEqual(4);
    expect(s!.carrying.bandage).toBeLessThanOrEqual(1);
    expect(s!.bedId).toBeNull();
    expect(decision(w)).toMatchObject({ survivorIds: [s!.id], expiresAt: w.tick + TICKS_PER_DAY });
    expect(w.log.at(-1)).toMatchObject({ kind: 'strangerArrived', names: [s!.name] });
    expect(checkInvariants(w)).toEqual([]);
  }
});

test('a veces llegan dos, ya en pareja; si solo cabe uno, llega uno', () => {
  const w = world();
  arrive(w, true);
  const [a, b] = w.stranger!.survivors;
  expect(a!.partnerId).toBe(b!.id);
  expect(b!.partnerId).toBe(a!.id);
  for (const [x, y] of [
    [a!, b!],
    [b!, a!],
  ] as const) {
    expect(opinionOf(x, y.id)).toBeGreaterThanOrEqual(60);
    expect(opinionOf(x, y.id)).toBeLessThanOrEqual(80);
  }
  expect(a!.name).not.toBe(b!.name);
  expect(decision(w).survivorIds).toEqual([a!.id, b!.id]);
  expect(checkInvariants(w)).toEqual([]);

  const seven = world();
  while (seven.survivors.length < COLONY_MAX - 1)
    seven.survivors.push({
      ...structuredClone(seven.survivors[0]!),
      id: seven.nextId++,
      bedId: null,
    });
  for (let i = 0; i < 200; i++) {
    const c = structuredClone(seven);
    c.rng = { s: i };
    strangersEvent.happen(c);
    expect(c.stranger!.survivors).toHaveLength(1);
  }
});

test('caminan hasta la puerta de la base y esperan allí', () => {
  const w = world();
  arrive(w, true);
  atDoor(w);
  for (const s of w.stranger!.survivors) expect(tileOf(s.pos)).toEqual(doorOutside(w));
  for (let i = 0; i < 100; i++) step(w);
  for (const s of w.stranger!.survivors) expect(tileOf(s.pos)).toEqual(doorOutside(w));
});

test('Aceptar (opción 0): todos pasan a la colonia con cama mientras quede', () => {
  const w = world();
  arrive(w, true);
  const ids = w.stranger!.survivors.map((s) => s.id);
  issue(w, { type: 'decide', decisionId: decision(w).id, option: 0 });
  step(w);
  expect(w.stranger).toBeNull();
  expect(w.decisions).toEqual([]);
  const slots = baseLayout(w.base).beds;
  ids.forEach((id, i) => {
    const s = w.survivors.find((x) => x.id === id)!;
    expect(s.work.loot).toBe(!s.traits.includes('coward'));
    const bed = w.beds.find((b) => b.id === s.bedId)!;
    expect(bed.pos).toEqual(slots[3 + i]);
  });
  expect(w.log.at(-1)).toMatchObject({ kind: 'strangerAccepted' });
  expect(checkInvariants(w)).toEqual([]);
});

test('con las 5 camas ocupadas, los siguientes duermen en el suelo; nunca más de 8', () => {
  const w = world();
  for (let n = 0; n < 10 && strangersEvent.canHappen(w); n++) {
    arrive(w, n % 2 === 0 && w.survivors.length + 2 <= COLONY_MAX);
    issue(w, { type: 'decide', decisionId: decision(w).id, option: 0 });
    step(w);
    expect(w.survivors.length).toBeLessThanOrEqual(COLONY_MAX);
    expect(checkInvariants(w)).toEqual([]);
  }
  expect(w.survivors).toHaveLength(COLONY_MAX);
  expect(w.beds).toHaveLength(5);
  expect(w.survivors.filter((s) => s.bedId === null)).toHaveLength(3);
  expect(new Set(w.survivors.map((s) => s.name)).size).toBe(COLONY_MAX);
});

test('Rechazar (opción 1): se van al borde y desaparecen', () => {
  const w = world();
  arrive(w);
  atDoor(w);
  const name = w.stranger!.survivors[0]!.name;
  issue(w, { type: 'decide', decisionId: decision(w).id, option: 1 });
  step(w);
  expect(w.stranger?.leaving).toBe(true);
  expect(w.decisions).toEqual([]);
  expect(w.log.at(-1)).toMatchObject({ kind: 'strangerRejected', names: [name] });
  expect(runUntil(w, () => w.stranger === null, TICKS_PER_DAY)).toBe(true);
  expect(w.survivors).toHaveLength(3);
});

test('si nadie contesta en un día, se marchan', () => {
  const w = world();
  arrive(w);
  atDoor(w);
  const d = decision(w);
  w.tick = d.expiresAt - 1;
  narratorSystem(w);
  expect(w.stranger?.leaving).toBe(false);
  w.tick = d.expiresAt;
  narratorSystem(w);
  expect(w.stranger?.leaving).toBe(true);
  expect(w.decisions).toEqual([]);
  expect(w.log.at(-1)).toMatchObject({ kind: 'strangerLeft' });
});

test('contestar a una decisión que ya no existe no hace nada', () => {
  const w = world();
  issue(w, { type: 'decide', decisionId: 12345, option: 0 });
  step(w);
  expect(w.survivors).toHaveLength(3);
  expect(w.log).toEqual([]);
});

test('el mundo con desconocidos sobrevive a JSON', () => {
  const w = world();
  arrive(w, true);
  expect(JSON.parse(JSON.stringify(w))).toEqual(w);
});
