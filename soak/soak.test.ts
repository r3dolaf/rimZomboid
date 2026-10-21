// Partida larga sin pantalla: solo IA, a toda velocidad. Comprueba que nada se rompe.
import { describe, expect, test } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/balance';
import { checkInvariants } from '../src/sim/invariants';
import { step } from '../src/sim/step';
import { isEmpty } from '../src/sim/items';
import { issue } from '../src/sim/orders';
import { createRng, nextInt } from '../src/sim/rng';
import { canPlace } from '../src/sim/build';
import {
  Tile,
  type BuildKind,
  type EventId,
  type NarratorStyle,
  type Survivor,
  type World,
} from '../src/sim/types';
import { regionOf } from '../src/sim/path/astar';
import { createWorld, tileOf } from '../src/sim/world';
import { targetContainerId } from '../src/sim/work';

const DAYS = Number(process.env.SOAK_DAYS || 30);

test('SOAK_DAYS es un número de días válido', () => {
  expect(Number.isInteger(DAYS) && DAYS > 0).toBe(true);
});

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días sin romper invariantes ni bloquearse`,
  (seed) => {
    const w = createWorld(seed);
    for (let day = 1; day <= DAYS; day++) {
      const moved = w.survivors.map(() => false);
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        const before = w.survivors.map((s) => ({ ...s.pos }));
        step(w);
        const problems = checkInvariants(w);
        if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
        w.survivors.forEach((s, j) => {
          if (s.pos.x !== before[j]!.x || s.pos.y !== before[j]!.y) moved[j] = true;
        });
      }
      // H2: con ~10 días de comida, el almacén está vacío antes del día 15
      if (day === 15) expect(w.storage.items.food, 'comida el día 15').toBe(0);
      // sin bloqueos: cada superviviente se ha movido en algún momento del día
      w.survivors.forEach((s, j) =>
        expect(moved[j], `día ${day}: ${s.name} no se ha movido`).toBe(true),
      );
    }
    expect(w.tick).toBe(DAYS * TICKS_PER_DAY);
  },
  120_000,
);

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días con todas las casas marcadas — el mapa se vacía sin romper nada`,
  (seed) => {
    const w = createWorld(seed);
    // Sin narrador: un alijo de última hora dejaría comida en un mueble sin marcar.
    w.narrator.nextEventAt = Number.MAX_SAFE_INTEGER;
    w.narrator.phaseEndsAt = Number.MAX_SAFE_INTEGER; // si no, el cambio de fase lo adelanta
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    for (let i = 0; i < DAYS * TICKS_PER_DAY; i++) {
      step(w);
      const problems = checkInvariants(w);
      if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
      const targets = w.survivors.map(targetContainerId).filter((id) => id !== null);
      if (new Set(targets).size !== targets.length)
        expect(targets, `tick ${w.tick}`).toEqual('únicos');
    }
    for (const c of w.containers) expect(isEmpty(c.items), `contenedor ${c.id}`).toBe(true);
    for (const s of w.survivors) expect(isEmpty(s.carrying), s.name).toBe(true);
  },
  120_000,
);

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días aceptando a todos los desconocidos — relaciones sanas y sin bloqueos`,
  (seed) => {
    const w = createWorld(seed);
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    for (let day = 1; day <= DAYS; day++) {
      const present = new Set(w.survivors.map((s) => s.id));
      const moved = new Set<number>();
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        const d = w.decisions.find((x) => x.kind === 'stranger');
        if (d && w.orders.length === 0) issue(w, { type: 'decide', decisionId: d.id, option: 0 });
        const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
        step(w);
        const problems = checkInvariants(w);
        if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
        for (const s of w.survivors) {
          const b = before.get(s.id);
          if (b && (b.x !== s.pos.x || b.y !== s.pos.y)) moved.add(s.id);
        }
      }
      for (const s of w.survivors)
        if (present.has(s.id))
          expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
    }
    if (DAYS >= 10) expect(w.survivors.length, 'han llegado y se han unido').toBeGreaterThan(3);
  },
  240_000,
);

const STYLES: NarratorStyle[] = ['calm', 'balanced', 'chaotic'];
const eventsBy: Record<NarratorStyle, number> = { calm: 0, balanced: 0, chaotic: 0 };

describe.each(STYLES)('narrador %s', (style) => {
  test.each([1, 2, 3])(
    `semilla %i: ${DAYS} días saqueando y contestando al azar — sin romper nada ni bloquearse`,
    (seed) => {
      const w = createWorld(seed, style);
      for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
      const answers = createRng(seed * 77);
      let events = 0;
      let tension = false;
      let edge = false;
      let negative = false;
      for (let day = 1; day <= DAYS; day++) {
        const present = new Set(w.survivors.map((s) => s.id));
        const moved = new Set<number>();
        for (let i = 0; i < TICKS_PER_DAY; i++) {
          const d = w.decisions[0];
          if (d && w.orders.length === 0)
            issue(w, { type: 'decide', decisionId: d.id, option: nextInt(answers, 0, 1) as 0 | 1 });
          const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
          step(w);
          const problems = checkInvariants(w);
          if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
          for (const id of Object.keys(w.narrator.lastAt) as EventId[])
            if (w.narrator.lastAt[id] === w.tick - 1) events++;
          if (w.narrator.phase === 'tension') tension = true;
          for (const s of w.survivors) {
            const b = before.get(s.id);
            if (b && (b.x !== s.pos.x || b.y !== s.pos.y)) moved.add(s.id);
            if (s.needs.mood < 25) edge = true;
            if (Object.values(s.opinions).some((v) => v < 0)) negative = true;
          }
        }
        for (const s of w.survivors)
          if (present.has(s.id))
            expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
      }
      eventsBy[style] += events;
      if (style === 'balanced' && DAYS >= 30) {
        expect(events, 'sucesos en el Equilibrado').toBeGreaterThanOrEqual(8);
        expect(tension, 'alguna fase de tensión').toBe(true);
        expect(edge, 'alguien al límite').toBe(true);
        expect(negative, 'alguna opinión negativa').toBe(true);
      }
    },
    240_000,
  );
});

test('en total, el Tranquilo saca menos sucesos que el Caótico', () => {
  if (DAYS < 30) return;
  expect(eventsBy.calm).toBeLessThan(eventsBy.chaotic);
});

const BUILDS: BuildKind[] = [
  'bed',
  'table',
  'campfire',
  'woodWall',
  'woodDoor',
  'board',
  'unboard',
];

/** Hachas en todo el mundo: nunca se crean ni se pierden (spec H4a, Review Focus 2). */
function axes(w: World): number {
  const people = [...w.survivors, ...(w.stranger?.survivors ?? [])];
  return (
    w.storage.items.axe +
    w.containers.reduce((n, c) => n + c.items.axe, 0) +
    w.piles.reduce((n, p) => n + p.items.axe, 0) +
    people.reduce((n, s) => n + s.carrying.axe + (s.equipped === 'axe' ? 1 : 0), 0)
  );
}

/**
 * Un día de partida contestando las decisiones al azar; comprueba las invariantes en cada tick y
 * que todos los que estaban se han movido (salvo a quien `excused` disculpe).
 */
function playDay(
  w: World,
  r: ReturnType<typeof createRng>,
  day: number,
  excused: (s: Survivor) => boolean = () => false,
): void {
  const present = new Set(w.survivors.map((s) => s.id));
  const moved = new Set<number>();
  for (let i = 0; i < TICKS_PER_DAY; i++) {
    const d = w.decisions[0];
    if (d && !w.orders.some((o) => o.type === 'decide'))
      issue(w, { type: 'decide', decisionId: d.id, option: nextInt(r, 0, 1) as 0 | 1 });
    const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
    step(w);
    const problems = checkInvariants(w);
    if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
    for (const s of w.survivors) {
      const b = before.get(s.id);
      if (b && (b.x !== s.pos.x || b.y !== s.pos.y)) moved.add(s.id);
    }
  }
  for (const s of w.survivors)
    if (present.has(s.id) && !excused(s))
      expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
}

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días talando y construyendo al azar — la madera cuadra y nadie se bloquea`,
  (seed) => {
    const w = createWorld(seed);
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    const r = createRng(seed * 131);
    const cx = w.base.rect.x + Math.floor(w.base.rect.w / 2);
    const cy = w.base.rect.y + Math.floor(w.base.rect.h / 2);
    const axesAtStart = axes(w);
    for (let day = 1; day <= DAYS; day++) {
      // Cada mañana: marcar algunos árboles vistos y poner unos planos cerca de la base.
      for (let k = 0; k < 40; k++) {
        const x = cx + nextInt(r, -14, 14);
        const y = cy + nextInt(r, -14, 14);
        if (w.seen[y * w.grid.width + x] === 1 && w.grid.tiles[y * w.grid.width + x] === Tile.Tree)
          issue(w, { type: 'markTree', x, y, on: true });
      }
      // Y tapiar (o destapiar) una ventana de las que se ven cerca.
      const windows: { x: number; y: number }[] = [];
      for (let y = cy - 12; y <= cy + 12; y++)
        for (let x = cx - 12; x <= cx + 12; x++) {
          const t = w.grid.tiles[y * w.grid.width + x];
          if (t === Tile.Window || t === Tile.BoardedWindow) windows.push({ x, y });
        }
      if (windows.length > 0) {
        const win = windows[nextInt(r, 0, windows.length - 1)]!;
        for (const kind of ['board', 'unboard'] as const)
          if (canPlace(w, kind, win)) issue(w, { type: 'placeBlueprint', kind, ...win });
      }
      for (let k = 0; k < 60; k++) {
        const kind = BUILDS[nextInt(r, 0, BUILDS.length - 1)]!;
        const p = { x: cx + nextInt(r, -10, 10), y: cy + nextInt(r, -10, 10) };
        if (canPlace(w, kind, p)) issue(w, { type: 'placeBlueprint', kind, ...p });
        if (w.orders.length >= 3) break;
      }
      playDay(w, r, day);
      expect(axes(w), `día ${day}: hachas`).toBe(axesAtStart);
    }
    if (DAYS >= 10) {
      expect(w.woodLog.chopped, 'se ha talado').toBeGreaterThan(0);
      expect(w.woodLog.spent, 'se ha construido').toBeGreaterThan(0);
      expect(
        w.grid.tiles.includes(Tile.BoardedWindow) || w.woodLog.recovered > 0,
        'se ha tapiado',
      ).toBe(true);
    }
  },
  240_000,
);

const WALL_DAYS = Math.min(DAYS, 10);

test.each([1, 2, 3])(
  `semilla %i: ${WALL_DAYS} días levantando muros en línea por la base y alrededor — nadie los atraviesa ni se queda dentro`,
  (seed) => {
    const w = createWorld(seed);
    w.seen.fill(1);
    w.storage.items.wood += 300; // madera de sobra: que se construya deprisa
    w.woodLog.start += 300;
    const r = createRng(seed * 977);
    const rect = w.base.rect;
    for (let day = 1; day <= WALL_DAYS; day++) {
      // Cada mañana, dos líneas de muro (con una puerta en medio): una por dentro de la base y
      // otra justo fuera, en horizontal o en vertical.
      for (const inside of [true, false]) {
        const horizontal = nextInt(r, 0, 1) === 0;
        const len = nextInt(r, 5, 9);
        const x0 = inside ? nextInt(r, rect.x + 1, rect.x + rect.w - 2) : rect.x - 2;
        const y0 = inside ? nextInt(r, rect.y + 1, rect.y + rect.h - 2) : rect.y - 2;
        for (let i = 0; i < len; i++) {
          const p = horizontal ? { x: x0 + i, y: y0 } : { x: x0, y: y0 + i };
          const kind = i === Math.floor(len / 2) ? 'woodDoor' : 'woodWall';
          if (canPlace(w, kind, p)) issue(w, { type: 'placeBlueprint', kind, ...p });
        }
      }
      // Encerrarse es decisión del jugador: quien ha quedado separado del almacén (sin poder ir a
      // comer) puede pasarse el día esperando un camino.
      const store = w.storage.tiles[0]!;
      const cutOff = (s: Survivor) => {
        const t = tileOf(s.pos);
        return regionOf(w.grid, t.x, t.y) !== regionOf(w.grid, store.x, store.y);
      };
      playDay(w, r, day, cutOff);
    }
    expect(w.grid.tiles.filter((t) => t === Tile.WoodWall).length, 'muros').toBeGreaterThan(10);
  },
  240_000,
);
