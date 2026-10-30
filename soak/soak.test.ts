// Partida larga sin pantalla: solo IA, a toda velocidad. Comprueba que nada se rompe.
// Las de antes de H4b, sin zombis (prueban lo suyo); las de H4b, al final, con zombis.
import { describe, expect, test } from 'vitest';
import {
  ACTIVE_SITES_MAX,
  EXPLORE_DIST,
  FAINT_UNTIL,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from '../src/sim/balance';
import { isBag, wornBags } from '../src/sim/bags';
import { forEachPieceList, forEachTravelerPieceList } from '../src/sim/clothes';
import { activeSiteIds, canGo, hexToward } from '../src/sim/expeditions';
import { allMaps, stepGame } from '../src/sim/game';
import { gameTime } from '../src/sim/clock';
import { checkInvariants } from '../src/sim/invariants';
import { step } from '../src/sim/step';
import { isEmpty } from '../src/sim/items';
import { hasCargo } from '../src/sim/jobs/medical';
import { issue } from '../src/sim/orders';
import { createRng, nextInt } from '../src/sim/rng';
import { canPlace } from '../src/sim/build';
import { contains } from '../src/sim/geom';
import { WEAPONS } from '../src/sim/jobs/weapons';
import {
  Tile,
  type BuildKind,
  type Decision,
  type EventId,
  type NarratorStyle,
  type Survivor,
  type World,
  type ZombieLevel,
} from '../src/sim/types';
import { regionOf } from '../src/sim/path/astar';
import { addSurvivor, moveTo, withoutZombies } from '../src/sim/testing/fixtures';
import { discoverSite, siteMap } from '../src/sim/sites';
import { createWorld, tileOf } from '../src/sim/world';
import { targetContainerId } from '../src/sim/work';

const DAYS = Number(process.env.SOAK_DAYS || 30);

/** Descansando o derribado (H5): no moverse en todo el día no es estar bloqueado. */
const lying = (s: Survivor) => s.action.type === 'rest' || s.action.type === 'downed';

/** Una respuesta al azar (la fiebre, H5, tiene tres opciones). */
const answer = (r: ReturnType<typeof createRng>, d: Decision) =>
  nextInt(r, 0, d.kind === 'fever' ? 2 : 1) as 0 | 1 | 2;

test('SOAK_DAYS es un número de días válido', () => {
  expect(Number.isInteger(DAYS) && DAYS > 0).toBe(true);
});

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días sin romper invariantes ni bloquearse`,
  (seed) => {
    const w = withoutZombies(createWorld(seed));
    for (let day = 1; day <= DAYS; day++) {
      const present = new Set(w.survivors.map((s) => s.id));
      const moved = new Set<number>();
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
        step(w);
        const problems = checkInvariants(w);
        if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
        for (const s of w.survivors) {
          const b = before.get(s.id);
          if (lying(s) || (b && (b.x !== s.pos.x || b.y !== s.pos.y))) moved.add(s.id);
        }
      }
      // H2: con ~10 días de comida, el almacén está vacío antes del día 15
      if (day === 15) expect(w.storage.items.food, 'comida el día 15').toBe(0);
      // sin bloqueos: cada superviviente se ha movido en algún momento del día (o ha estado
      // acostado: descansando o derribado, H5)
      for (const s of w.survivors)
        if (present.has(s.id))
          expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
    }
    expect(w.tick).toBe(DAYS * TICKS_PER_DAY);
  },
  120_000,
);

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días con todas las casas marcadas — el mapa se vacía (salvo lo atrancado sin palanca) sin romper nada`,
  (seed) => {
    const w = withoutZombies(createWorld(seed));
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
    // H4d: una casa con la puerta aún atrancada no se puede saquear (nadie ha tenido palanca).
    const locked = (h: (typeof w.houses)[number]) =>
      w.grid.tiles[h.door.y * w.grid.width + h.door.x] === Tile.LockedDoor;
    const shut = new Set(w.houses.filter(locked).map((h) => h.id));
    if (shut.size > 0) expect(allCrowbars(w), 'atrancadas habiendo palanca').toBe(0);
    for (const c of w.containers)
      if (!shut.has(c.houseId)) expect(isEmpty(c.items), `contenedor ${c.id}`).toBe(true);
    // (salvo sus 2 vendas, H5)
    for (const s of w.survivors) expect(hasCargo(s), s.name).toBe(false);
  },
  120_000,
);

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días aceptando a todos los desconocidos — relaciones sanas y sin bloqueos`,
  (seed) => {
    const w = withoutZombies(createWorld(seed));
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
          if (lying(s) || (b && (b.x !== s.pos.x || b.y !== s.pos.y))) moved.add(s.id);
        }
      }
      for (const s of w.survivors)
        if (present.has(s.id))
          expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
    }
    // Los que se han unido en toda la partida (al final pueden haber muerto de hambre: el pueblo
    // se vacía y sin zombis acaba sin comida para tantos).
    if (DAYS >= 10)
      expect(w.common.stats.joined.length, 'han llegado y se han unido').toBeGreaterThan(0);
  },
  240_000,
);

/** ¿Hay algún árbol marcado al lado de una casilla a la que se llega desde el almacén? */
function markedTreeReachable(w: World): boolean {
  const st = w.storage.tiles[0]!;
  const region = regionOf(w.grid, st.x, st.y);
  return w.chopMarks.some((i) => {
    const [x, y] = [i % w.grid.width, Math.floor(i / w.grid.width)];
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => regionOf(w.grid, x + dx!, y + dy!) === region);
  });
}

/** Palancas que tiene la colonia (almacén, carga o mano) o hay en el suelo. */
function allCrowbars(w: World): number {
  return (
    w.storage.items.crowbar +
    w.piles.reduce((n, p) => n + p.items.crowbar, 0) +
    w.survivors.reduce((n, s) => n + s.carrying.crowbar + (s.equipped === 'crowbar' ? 1 : 0), 0)
  );
}

const STYLES: NarratorStyle[] = ['calm', 'balanced', 'chaotic'];
const eventsBy: Record<NarratorStyle, number> = { calm: 0, balanced: 0, chaotic: 0 };

describe.each(STYLES)('narrador %s', (style) => {
  test.each([1, 2, 3])(
    `semilla %i: ${DAYS} días saqueando y contestando al azar — sin romper nada ni bloquearse`,
    (seed) => {
      const w = withoutZombies(createWorld(seed, style));
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
            issue(w, { type: 'decide', decisionId: d.id, option: answer(answers, d) });
          const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
          step(w);
          const problems = checkInvariants(w);
          if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
          for (const id of Object.keys(w.narrator.lastAt) as EventId[])
            if (w.narrator.lastAt[id] === w.tick - 1) events++;
          if (w.narrator.phase === 'tension') tension = true;
          for (const s of w.survivors) {
            const b = before.get(s.id);
            if (lying(s) || (b && (b.x !== s.pos.x || b.y !== s.pos.y))) moved.add(s.id);
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
    people.reduce((n, s) => n + s.carrying.axe + (s.equipped === 'axe' ? 1 : 0), 0) +
    inBags(w, 'axe') // H5b2
  );
}

/** Lo que hay de `k` dentro de las bolsas (H5b2), estén donde estén. */
function inBags(w: World, k: 'axe'): number {
  let n = 0;
  forEachPieceList(w, (list) => {
    for (const p of list) if (isBag(p)) n += p.items[k];
  });
  return n;
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
      issue(w, { type: 'decide', decisionId: d.id, option: answer(r, d) });
    const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
    step(w);
    const problems = checkInvariants(w);
    if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
    for (const s of w.survivors) {
      const b = before.get(s.id);
      if (lying(s) || (b && (b.x !== s.pos.x || b.y !== s.pos.y))) moved.add(s.id);
    }
  }
  // Quien ha quedado encerrado (sin camino al almacén, ver la hoja de ruta) tampoco.
  const store = w.storage.tiles[0]!;
  const cut = (s: Survivor) =>
    regionOf(w.grid, Math.floor(s.pos.x), Math.floor(s.pos.y)) !==
    regionOf(w.grid, store.x, store.y);
  for (const s of w.survivors)
    if (present.has(s.id) && !excused(s) && !cut(s))
      expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
}

test.each([1, 2, 3])(
  `semilla %i: ${DAYS} días talando y construyendo al azar — la madera cuadra y nadie se bloquea`,
  (seed) => {
    const w = withoutZombies(createWorld(seed));
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    const r = createRng(seed * 131);
    const cx = w.base.rect.x + Math.floor(w.base.rect.w / 2);
    const cy = w.base.rect.y + Math.floor(w.base.rect.h / 2);
    const axesAtStart = axes(w);
    const startLevels = new Map(w.survivors.map((s) => [s.id, skillSum(s)]));
    let choppedHalf = 0;
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
      if (day === Math.floor(DAYS / 2)) choppedHalf = w.common.woodLog.chopped;
    }
    // H4d: se sigue talando (antes, el machete y la palanca le quitaban el hacha a quien tala).
    // (H5: si los muros al azar han dejado fuera todos los árboles marcados, no se puede. H5c1: ni
    // si no queda nadie: las respuestas al azar echan o rematan a alguno y los muros encierran.)
    const lasted = !w.common.over || gameTime(w.common.over.tick).day > DAYS / 2 + 3;
    if (DAYS >= 10 && markedTreeReachable(w) && lasted)
      expect(w.common.woodLog.chopped, 'se tala también en la segunda mitad').toBeGreaterThan(
        choppedHalf,
      );
    if (DAYS >= 10) {
      expect(w.common.woodLog.chopped, 'se ha talado').toBeGreaterThan(0);
      expect(w.common.woodLog.spent, 'se ha construido').toBeGreaterThan(0);
      expect(
        w.grid.tiles.includes(Tile.BoardedWindow) || w.common.woodLog.recovered > 0,
        'se ha tapiado',
      ).toBe(true);
      // H4c: practicando se mejora (los que siguen desde el principio: contestando al azar se
      // echa a gente y los muros al azar pueden encerrar a alguien hasta morir de hambre), y los
      // fallos al construir no se comen la madera.
      const still = w.survivors.filter((s) => startLevels.has(s.id));
      if (still.length > 0)
        expect(
          still.reduce((n, s) => n + skillSum(s), 0),
          'las habilidades han subido',
        ).toBeGreaterThan(still.reduce((n, s) => n + startLevels.get(s.id)!, 0));
      expect(w.common.woodLog.wasted, 'madera perdida al fallar').toBeLessThan(
        w.common.woodLog.spent / 2,
      );
    }
  },
  240_000,
);

/** La suma de los niveles de las habilidades de un colono. */
function skillSum(s: Survivor): number {
  return Object.values(s.skills).reduce((m, k) => m + k.level, 0);
}

const WALL_DAYS = Math.min(DAYS, 10);

test.each([1, 2, 3])(
  `semilla %i: ${WALL_DAYS} días levantando muros en línea por la base y alrededor — nadie los atraviesa ni se queda dentro`,
  (seed) => {
    const w = withoutZombies(createWorld(seed));
    w.seen.fill(1);
    w.storage.items.wood += 300; // madera de sobra: que se construya deprisa
    w.common.woodLog.start += 300;
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

/** Armas en un mapa: solo aparecen en los cuerpos y desaparecen al pudrirse (H4d). */
function allWeapons(w: World): number {
  const kinds = WEAPONS; // con la palanca y el machete (H4d)
  const people = [...w.survivors, ...(w.stranger?.survivors ?? [])];
  let n = 0;
  for (const k of kinds) {
    n += w.storage.items[k];
    n += w.containers.reduce((a, c) => a + c.items[k], 0);
    n += w.piles.reduce((a, p) => a + p.items[k], 0);
    n += people.reduce((a, s) => a + s.carrying[k] + (s.equipped === k ? 1 : 0), 0);
  }
  // H5b2: y las de dentro de las bolsas, estén donde estén.
  forEachPieceList(w, (list) => {
    for (const p of list) if (isBag(p)) for (const k of kinds) n += p.items[k];
  });
  return n;
}

/**
 * H5c1: armas en todo el juego (la base, los sitios y los que viajan). Aparecen en los cuerpos y
 * en el botín de los sitios; se pierden al pudrirse, quemarse un sitio o morir por el camino.
 */
function gameWeapons(base: World): number {
  let n = allMaps(base).reduce((a, m) => a + allWeapons(m), 0);
  for (const t of base.common.expedition.travels)
    for (const s of t.members)
      for (const k of WEAPONS) n += s.carrying[k] + (s.equipped === k ? 1 : 0);
  forEachTravelerPieceList(base, (list) => {
    for (const p of list) if (isBag(p)) for (const k of WEAPONS) n += p.items[k];
  });
  return n;
}

/** Las armas que debería haber: las del principio, más las que han aparecido, menos las perdidas. */
const weaponsDue = (w: World, start: number) => {
  const log = w.common.weaponLog;
  return start + log.fromCorpses + log.fromSites - log.rotted;
};

// H4b: un juego por narrador, cada uno con una opción de Zombis (los 3 narradores y las 3 opciones).
const ZOMBIE_GAMES: [NarratorStyle, ZombieLevel][] = [
  ['calm', 'few'],
  ['balanced', 'normal'],
  ['chaotic', 'many'],
];
const zombieTotals = {
  kills: 0,
  downs: 0,
  broken: 0,
  crafted: 0,
  corpses: 0,
  // H4e
  sieges: 0,
  wanderers: 0,
  healed: 0,
  strangersFled: 0,
  // H5: muertos y hasta qué día se llega en cada partida
  dead: 0,
  survived: [] as number[],
  // H5b: ropa rota por golpes parados, cambios de ropa, costura y lavado
  torn: 0,
  dressed: 0,
  sewn: 0,
  washed: 0,
  // H5b2: bolsas encontradas (y puestas), soltadas, recogidas y puestas al final
  bagsFound: 0,
  bagsDropped: 0,
  bagsRecovered: 0,
  bagsWorn: 0,
};

/**
 * H4e: cada día, a mediodía, el jugador pone a dos en modo combate, los manda a la puerta, ataca
 * al zombi que vean y, una hora después, lo quita.
 */
function drill(w: World, inDay: number): void {
  const ids = w.survivors.slice(0, 2).map((s) => s.id);
  const noon = TICKS_PER_DAY / 6; // 12:00 (se empieza a las 8)
  if (inDay === noon) {
    issue(w, { type: 'draft', survivorIds: ids, on: true });
    const d = w.base.door;
    issue(w, { type: 'draftMove', survivorIds: ids, x: d.x, y: d.y });
  } else if (inDay === noon + 150) {
    const z = w.zombies.find((x) =>
      w.survivors.some((s) => (s.pos.x - x.pos.x) ** 2 + (s.pos.y - x.pos.y) ** 2 < 64),
    );
    if (z) issue(w, { type: 'draftAttack', survivorIds: ids, zombieId: z.id });
  } else if (inDay === noon + 300) {
    issue(w, { type: 'draft', survivorIds: ids, on: false });
  }
}

/**
 * H4d, desde el primer día: una mesa (con su madera), pedidos de vendas (hasta 10), unas cortinas
 * y deshacer otras, y las cortinas de la base corridas.
 */
function clothSetup(w: World): void {
  w.storage.items.wood += 4;
  w.common.woodLog.start += 4;
  const r = w.base.rect;
  const spot = [];
  for (let y = r.y + 1; y < r.y + r.h - 1; y++)
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) spot.push({ x, y });
  const table = spot.find((p) => canPlace(w, 'table', p));
  if (table) issue(w, { type: 'placeBlueprint', kind: 'table', ...table });
  const id = w.nextBillId;
  for (const recipe of ['bandages', 'curtains', 'unpick'] as const)
    issue(w, { type: 'addBill', recipe });
  issue(w, { type: 'setBill', billId: id, target: 10 });
  issue(w, { type: 'setBill', billId: id + 1, mode: 'count', target: 2 });
  issue(w, { type: 'setBill', billId: id + 2, mode: 'count', target: 1 });
  // H5b: remendar, reforzar, descoser y lavar ("siempre que haya") y un barreño fuera de la base,
  // junto a la puerta (con su madera).
  for (const recipe of ['mend', 'pad', 'unpickGarment', 'wash'] as const)
    issue(w, { type: 'addBill', recipe });
  w.storage.items.wood += 4;
  w.common.woodLog.start += 4;
  const d = w.base.door;
  const outside = [
    { x: d.x + 2, y: d.y + 2 },
    { x: d.x - 2, y: d.y + 2 },
    { x: d.x + 2, y: d.y - 2 },
    { x: d.x - 2, y: d.y - 2 },
  ].find((p) => !contains(r, p) && canPlace(w, 'tub', p));
  if (outside) issue(w, { type: 'placeBlueprint', kind: 'tub', ...outside });
  for (const i of w.curtains) {
    const p = { x: i % w.grid.width, y: Math.floor(i / w.grid.width) };
    if (contains(r, p) && canPlace(w, 'curtains', p))
      issue(w, { type: 'placeBlueprint', kind: 'curtains', ...p });
  }
}

/** Cada mañana, marcar los cuerpos que se ven (H4d). */
function markCorpses(w: World): void {
  for (const c of w.containers)
    if (c.kind === 'corpse' && w.seen[c.pos.y * w.grid.width + c.pos.x] === 1 && !c.designated)
      issue(w, { type: 'designateContainer', containerId: c.id, on: true });
}

describe.each(ZOMBIE_GAMES)('zombis: narrador %s, %s', (style, level) => {
  test(`${DAYS} días saqueando con zombis, fabricando, con cortinas y cuerpos — sin romper nada, sin bloqueos, las armas cuadran y cada tick va rápido`, () => {
    const w = createWorld(1, style, level);
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    clothSetup(w);
    const r = createRng(17);
    const weapons = gameWeapons(w);
    const startLevels = new Map(w.survivors.map((s) => [s.id, skillSum(s)]));
    const wasDressing = new Map<number, boolean>();
    let ms = 0;
    for (let day = 1; day <= DAYS; day++) {
      const present = new Set(w.survivors.map((s) => s.id));
      const moved = new Set<number>();
      const down = new Map<number, number>();
      markCorpses(w);
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        const d = w.decisions[0];
        if (d && !w.orders.some((o) => o.type === 'decide'))
          issue(w, { type: 'decide', decisionId: d.id, option: answer(r, d) });
        const before = new Map(w.survivors.map((s) => [s.id, { ...s.pos }]));
        const last = w.common.log.at(-1);
        drill(w, i);
        const t0 = performance.now();
        stepGame(w); // como en el juego (H5c1): con los avisos de sitios
        ms += performance.now() - t0;
        const problems = checkInvariants(w);
        if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
        for (const e of w.common.log.slice(last ? w.common.log.lastIndexOf(last) + 1 : 0)) {
          if (e.kind === 'zombieKilled') zombieTotals.kills++;
          if (e.kind === 'downed') zombieTotals.downs++;
          if (e.kind === 'broken') zombieTotals.broken++;
          if (e.kind === 'crafted') zombieTotals.crafted++;
          if (e.kind === 'corpseSearched') zombieTotals.corpses++;
          if (e.kind === 'siegeArrived') zombieTotals.sieges++;
          if (e.kind === 'wanderersSighted') zombieTotals.wanderers++;
          if (e.kind === 'rescued' || e.kind === 'bandaged') zombieTotals.healed++;
          if (e.kind === 'strangersFled') zombieTotals.strangersFled++;
          if (e.kind === 'clothesTorn') zombieTotals.torn++;
          if (e.kind === 'crafted' && e.recipe === 'wash') zombieTotals.washed++;
          else if (e.kind === 'crafted' && e.garment) zombieTotals.sewn++;
        }
        for (const s of w.survivors) {
          const b = before.get(s.id);
          if (lying(s) || (b && (b.x !== s.pos.x || b.y !== s.pos.y))) moved.add(s.id);
          if (s.action.type === 'downed') down.set(s.id, (down.get(s.id) ?? 0) + 1);
          if (s.action.type === 'dress' && wasDressing.get(s.id) !== true) zombieTotals.dressed++;
          wasDressing.set(s.id, s.action.type === 'dress');
        }
      }
      const store = w.storage.tiles[0]!;
      for (const s of w.survivors) {
        if (!present.has(s.id)) continue;
        // Nadie se pasa el día entero en el suelo (cayendo una y otra vez entre zombis).
        expect(down.get(s.id) ?? 0, `día ${day}: ${s.name}, todo el día en el suelo`).toBeLessThan(
          TICKS_PER_DAY,
        );
        // Nadie se queda quieto un día entero, salvo derribados o encerrados (spec H4b §10).
        const t = tileOf(s.pos);
        const cut = regionOf(w.grid, t.x, t.y) !== regionOf(w.grid, store.x, store.y);
        if (!down.has(s.id) && !cut)
          expect(moved.has(s.id), `día ${day}: ${s.name} no se ha movido`).toBe(true);
      }
      // Las de los cuerpos (H4d) entran al morir el zombi y salen si el cuerpo se pudre.
      expect(gameWeapons(w), `día ${day}: armas`).toBe(weaponsDue(w, weapons));
    }
    // Límite generoso (en local va por 0,1–0,2 ms por tick).
    expect(ms / (DAYS * TICKS_PER_DAY), 'ms por tick').toBeLessThan(1);
    // H5: ¿cuánto se sobrevive? (Sin nadie, las habilidades ya no cuentan.)
    zombieTotals.survived.push(w.common.over ? gameTime(w.common.over.tick).day : DAYS);
    zombieTotals.dead += w.common.dead.length;
    zombieTotals.bagsFound += w.common.bagLog.found;
    zombieTotals.bagsDropped += w.common.bagLog.dropped;
    zombieTotals.bagsRecovered += w.common.bagLog.recovered;
    zombieTotals.bagsWorn += w.survivors.reduce((n, s) => n + wornBags(s).length, 0);
    // Los que siguen desde el principio han mejorado (los que llegan no cuentan: si muere alguien
    // con niveles altos, la suma baja aunque se aprenda).
    const still = w.survivors.filter((s) => startLevels.has(s.id));
    if (DAYS >= 10 && still.length > 0)
      expect(
        still.reduce((n, s) => n + skillSum(s), 0),
        'las habilidades han subido',
      ).toBeGreaterThan(still.reduce((n, s) => n + startLevels.get(s.id)!, 0));
  }, 600_000);
});

/** H5c1: lo que pasa en las partidas con expediciones. */
const tripTotals = {
  explores: 0,
  sent: 0,
  siteToSite: 0, // H5c2
  redirected: 0, // H5c2
  arrived: 0,
  returned: 0,
  sitesFound: 0,
  foundOnSites: 0,
  dead: 0,
  maxActive: 0,
  survived: [] as number[],
};

/**
 * H5c1: el jugador de las expediciones, cada mañana: los que llevan dos días en un sitio vuelven;
 * si hay un sitio por visitar, manda a uno o dos con comida y vendas (siempre se queda alguien
 * libre); si no, manda a uno a explorar (cada día hacia un lado). H5c2: los que llevan un día en
 * un sitio siguen a otro sin visitar, y cada tres días un grupo de camino cambia de idea y vuelve.
 */
function expeditionPlan(base: World, day: number, since: Map<number, number>): void {
  const ex = base.common.expedition;
  for (const m of base.siteMaps) {
    if (m.world.survivors.length === 0) {
      since.delete(m.siteId);
      continue;
    }
    if (!since.has(m.siteId)) since.set(m.siteId, base.tick);
    const stay = base.tick - since.get(m.siteId)!;
    if (stay >= 2 * TICKS_PER_DAY) issue(base, { type: 'returnHome', siteId: m.siteId });
    else if (stay >= TICKS_PER_DAY) {
      const next = ex.sites.find(
        (x) => x.state === 'known' && !x.visited && !activeSiteIds(base).has(x.id),
      );
      const ids = m.world.survivors.filter((s) => canGo(s, m.world)).map((s) => s.id);
      if (next && ids.length > 0) {
        issue(base, {
          type: 'sendExpedition',
          from: m.siteId,
          siteId: next.id,
          survivorIds: ids,
          items: {},
        });
        tripTotals.siteToSite++;
      }
    }
  }
  const going = ex.travels.find((t) => t.kind === 'go' && t.members.length > 0);
  if (day % 3 === 0 && going) {
    issue(base, { type: 'redirectTravel', travelId: going.id, siteId: null });
    tripTotals.redirected++;
  }
  const busy = new Set(ex.travels.flatMap((t) => [...t.pending, ...t.members.map((s) => s.id)]));
  const free = base.survivors.filter((s) => canGo(s, base) && !busy.has(s.id) && s.health > 60);
  const active = activeSiteIds(base);
  const target = ex.sites
    .filter((x) => x.state === 'known' && !active.has(x.id))
    .sort((a, b) => a.hours - b.hours)[0];
  if (target && free.length >= 2) {
    const items = {
      food: Math.min(4, base.storage.items.food),
      bandage: Math.min(2, base.storage.items.bandage),
    };
    // Dos si se puede; siempre se queda alguien libre (así hay varios sitios a la vez).
    const survivorIds = free.slice(0, Math.min(2, free.length - 1)).map((s) => s.id);
    issue(base, { type: 'sendExpedition', from: 0, siteId: target.id, survivorIds, items });
    tripTotals.sent++;
  } else if (free.length >= 2 && !ex.travels.some((t) => t.kind === 'explore')) {
    const { atlas } = base.common;
    const zone = hexToward(atlas, atlas.base, (day % 4) as 0 | 1 | 2 | 3, EXPLORE_DIST + day);
    issue(base, { type: 'explore', target: zone, survivorIds: [free[0]!.id] });
    tripTotals.explores++;
  }
}

test.each([1, 2])(
  `semilla %i: ${DAYS} días con expediciones (explorar, ir, saquear, volver) — sin romper nada, las armas cuadran y cada tick va rápido`,
  (seed) => {
    const w = createWorld(seed, 'balanced', 'normal');
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    const r = createRng(23);
    const weapons = gameWeapons(w);
    const since = new Map<number, number>();
    let ms = 0;
    for (let day = 1; day <= DAYS && !w.common.over; day++) {
      expeditionPlan(w, day, since);
      for (let i = 0; i < TICKS_PER_DAY; i++) {
        // Las decisiones de todos los mapas (las de los atrapados, en su sitio).
        for (const m of allMaps(w)) {
          const d = m.decisions[0];
          if (d && !m.orders.some((o) => o.type === 'decide'))
            issue(m, { type: 'decide', decisionId: d.id, option: answer(r, d) });
        }
        const last = w.common.log.at(-1);
        const t0 = performance.now();
        stepGame(w);
        ms += performance.now() - t0;
        const problems = checkInvariants(w);
        if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
        for (const e of w.common.log.slice(last ? w.common.log.lastIndexOf(last) + 1 : 0)) {
          if (e.kind === 'expeditionArrived') {
            if (e.site) tripTotals.arrived++;
            else tripTotals.returned++;
          }
          if (e.kind === 'siteFound') tripTotals.sitesFound++;
          if (e.kind === 'found' && e.mapId !== undefined) tripTotals.foundOnSites++;
        }
        tripTotals.maxActive = Math.max(tripTotals.maxActive, activeSiteIds(w).size);
      }
      expect(gameWeapons(w), `día ${day}: armas`).toBe(weaponsDue(w, weapons));
    }
    // Con varios mapas a la vez, cada tick sigue yendo rápido (en local, unas décimas de ms).
    expect(ms / (w.tick || 1), 'ms por tick').toBeLessThan(1.5);
    tripTotals.survived.push(w.common.over ? gameTime(w.common.over.tick).day : DAYS);
    tripTotals.dead += w.common.dead.length;
  },
  600_000,
);

test('con 4 sitios con gente a la vez, cada tick sigue yendo rápido y todo cuadra', () => {
  const w = createWorld(4, 'balanced', 'normal');
  while (w.survivors.length < ACTIVE_SITES_MAX) addSurvivor(w, w.storage.tiles[0]!);
  const kinds = ['village', 'farm', 'warehouse', 'gas'] as const;
  kinds.forEach((kind, i) => {
    const info = discoverSite(w, {
      how: 'roadMap',
      side: (i % 4) as 0 | 1 | 2 | 3,
      special: null,
    })!;
    info.kind = kind;
    moveTo(w, siteMap(w, info), w.survivors[0]!);
  });
  expect(activeSiteIds(w).size).toBe(ACTIVE_SITES_MAX);
  let ms = 0;
  for (let i = 0; i < TICKS_PER_DAY; i++) {
    const t0 = performance.now();
    stepGame(w);
    ms += performance.now() - t0;
  }
  expect(checkInvariants(w)).toEqual([]);
  console.log('H5c1, ms por tick con 4 sitios:', (ms / TICKS_PER_DAY).toFixed(3));
  // Límite generoso (en local va por 0,7 ms: unas 4 veces la base sola).
  expect(ms / TICKS_PER_DAY, 'ms por tick').toBeLessThan(4);
}, 120_000);

test('con expediciones se explora, se descubren sitios, se va, se saquea allí y se vuelve', () => {
  if (DAYS < 10) return;
  console.log('H5c1, en las partidas con expediciones:', tripTotals);
  expect(tripTotals.explores, 'exploraciones').toBeGreaterThan(0);
  expect(tripTotals.sitesFound, 'sitios descubiertos').toBeGreaterThan(0);
  expect(tripTotals.sent, 'grupos mandados').toBeGreaterThan(0);
  expect(tripTotals.arrived, 'llegadas a un sitio').toBeGreaterThan(0);
  expect(tripTotals.foundOnSites, 'cosas encontradas en los sitios').toBeGreaterThan(0);
  expect(tripTotals.returned, 'vueltas a la base').toBeGreaterThan(0);
  expect(tripTotals.siteToSite, 'de un sitio a otro (H5c2)').toBeGreaterThan(0);
  expect(tripTotals.redirected, 'cambios de destino (H5c2)').toBeGreaterThan(0);
});

test.each([1, 2, 3])(
  'semilla %i: un asedio de 25 a la hora de empezar, sin defender — nadie se pasa un día en el suelo ni cae sin parar',
  (seed) => {
    const w = createWorld(seed, 'balanced', 'normal');
    for (const h of w.houses) issue(w, { type: 'designateHouse', houseId: h.id, on: true });
    w.siege = { at: TICKS_PER_DAY / 24, side: (seed % 4) as 0 | 1 | 2 | 3, size: 25 };
    const downs = new Map<number, number>();
    const streak = new Map<number, number>();
    const downTicks = new Map<number, number>();
    let arrived = false;
    for (let i = 0; i < 2 * TICKS_PER_DAY; i++) {
      const last = w.common.log.at(-1);
      step(w);
      const problems = checkInvariants(w);
      if (problems.length > 0) expect(problems, `tick ${w.tick}`).toEqual([]);
      for (const e of w.common.log.slice(last ? w.common.log.lastIndexOf(last) + 1 : 0)) {
        if (e.kind === 'downed') downs.set(e.survivorId, (downs.get(e.survivorId) ?? 0) + 1);
        if (e.kind === 'siegeArrived') arrived = true;
      }
      for (const s of w.survivors) {
        const n = s.action.type === 'downed' ? (streak.get(s.id) ?? 0) + 1 : 0;
        streak.set(s.id, n);
        // (H5: el desmayado por falta de sangre no cuenta: no es caer una y otra vez.)
        if (n > 0 && s.blood >= FAINT_UNTIL) downTicks.set(s.id, (downTicks.get(s.id) ?? 0) + 1);
        expect(n, `${s.name}, un día entero en el suelo`).toBeLessThan(TICKS_PER_DAY);
      }
    }
    expect(arrived, 'ha llegado el asedio').toBe(true);
    // Antes de la revisión de H4e caían 4–7 veces cada uno y pasaban 35–43 de las 48 h en el
    // suelo: se levantaban entre los zombis, que luego se quedaban rondando la base.
    for (const [id, n] of downs) expect(n, `#${id} ha caído ${n} veces`).toBeLessThanOrEqual(4);
    for (const [id, t] of downTicks)
      expect(t / TICKS_PER_HOUR, `#${id}, horas en el suelo`).toBeLessThan(30);
  },
  300_000,
);

test('con zombis se pelea, alguien cae, algo se rompe, se fabrica y se registran cuerpos', () => {
  if (DAYS < 10) return;
  expect(zombieTotals.kills).toBeGreaterThan(0);
  expect(zombieTotals.downs).toBeGreaterThan(0);
  expect(zombieTotals.broken).toBeGreaterThan(0);
  expect(zombieTotals.crafted, 'fabricado').toBeGreaterThan(0);
  expect(zombieTotals.corpses, 'cuerpos registrados').toBeGreaterThan(0);
  // H4e: llegan asedios, se rescata o se venda a alguien.
  expect(zombieTotals.sieges, 'asedios').toBeGreaterThan(0);
  expect(zombieTotals.healed, 'rescates y vendajes').toBeGreaterThan(0);
  // H5b: la ropa para golpes (y se rompe), se cambian de ropa y se cose.
  expect(zombieTotals.torn, 'ropa rota al parar golpes').toBeGreaterThan(0);
  expect(zombieTotals.dressed, 'cambios de ropa').toBeGreaterThan(0);
  expect(zombieTotals.sewn, 'ropa cosida').toBeGreaterThan(0);
  // H5b2: se encuentran bolsas y se las ponen.
  expect(zombieTotals.bagsFound, 'bolsas encontradas').toBeGreaterThan(0);
  console.log('H4e, en las 3 partidas con zombis:', zombieTotals);
});
