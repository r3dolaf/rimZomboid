// Ayudas para los tests de la simulación.
import { newExpedition } from '../world';
import { bagFields, wornBags } from '../bags';
import { newGarment, piecesGone } from '../clothes';
import { DEFAULT_OUTFITS } from '../balance';
import { emptyInventory } from '../items';
import { defaultOutfits } from '../outfits';
import { createGrid, setTile } from '../map/grid';
import { createRng } from '../rng';
import { SKILLS } from '../skills';
import {
  Tile,
  type Garment,
  type GarmentKind,
  type Point,
  type Skill,
  type SkillId,
  type Survivor,
  type World,
} from '../types';

/** Una prenda nueva con ese id (para la ropa de serie de la fixture). */
const garment = (id: number, kind: GarmentKind): Garment => ({
  id,
  kind,
  holes: [],
  patches: {},
  pads: {},
  dirtHours: 0,
  bloody: false,
  from: null,
});

/** Todas las habilidades a `level` (con 5, rapidez, carga y acierto como antes de H4c). */
export function skillsAt(level: number): Record<SkillId, Skill> {
  return Object.fromEntries(SKILLS.map((k) => [k, { level, xp: 0 }])) as Record<SkillId, Skill>;
}

/** Pone a todos los colonos con todas las habilidades a `level`. */
export function withSkills(w: World, level = 5): World {
  for (const s of w.survivors) s.skills = skillsAt(level);
  return w;
}

/** Mundo de hierba sin edificios, con un superviviente en el centro de la casilla (0, 0). */
export function emptyWorld(width: number, height: number): World {
  const grid = createGrid(width, height, Tile.Grass);
  const building = {
    id: 0,
    kind: 'base' as const,
    rect: { x: 0, y: 0, w: width, h: height },
    door: { x: 0, y: 0 },
  };
  return {
    seed: 1,
    tick: 0,
    rng: createRng(1),
    grid,
    base: building,
    houses: [],
    survivors: [
      {
        id: 1,
        name: 'Ana',
        pos: { x: 0.5, y: 0.5 },
        brain: 'ai',
        action: { type: 'idle', ticksLeft: 0 },
        path: [],
        needs: { hunger: 100, sleep: 100, mood: 50, social: 100 },
        traits: [],
        skills: skillsAt(5), // nivel 5: todo va como antes de H4c
        memories: [],
        bedId: 1,
        carrying: emptyInventory(),
        work: {
          heal: true,
          social: true,
          build: true,
          craft: true,
          haul: true,
          chop: true,
          loot: true,
        },
        priorities: { heal: 1, social: 3, build: 3, craft: 3, haul: 3, chop: 3, loot: 3 },
        equipped: null,
        weaponLocked: false,
        health: 100,
        stance: 'decide',
        opinions: {},
        partnerId: null,
        nextChatAt: 0,
        bubble: null,
        fever: null,
        celebrated: false,
        drafted: false,
        carryingId: null,
        wounds: [],
        blood: 100,
        dying: null,
        painkillerUntil: 0,
        painkillerWanted: false,
        infection: null,
        // H5b: camiseta y vaqueros (las piezas 1 y 2).
        worn: [garment(1, 'tshirt'), garment(2, 'jeans')],
        likes: 'helmet',
        hates: 'chaps',
        outfitId: 1,
        dressCheckAt: 0,
        trip: null,
        ...bagFields(),
      },
    ],
    beds: [{ id: 1, pos: { x: width - 1, y: 0 }, ownerId: 1 }],
    storage: { tiles: [{ x: 0, y: height - 1 }], items: { ...emptyInventory(), food: 10 } },
    containers: [],
    seen: new Array<number>(width * height).fill(0),
    orders: [],
    common: {
      log: [],
      nextId: 2,
      stormUntil: 0,
      rainUntil: 0, // H5b
      bagLog: { found: 0, dropped: 0, recovered: 0 },
      woodLog: { start: 0, chopped: 0, recovered: 0, spent: 0, wasted: 0 },
      weaponLog: { fromCorpses: 0, fromSites: 0, rotted: 0 },
      nextWoundId: 1,
      dead: [],
      over: null,
      stats: { kills: 0, siegesRepelled: 0, looted: emptyInventory(), joined: [] },
      nextPieceId: 3,
      pieceLog: { made: 2, gone: 0 },
      outfits: defaultOutfits(),
      nextOutfitId: DEFAULT_OUTFITS.length + 1,
      expedition: newExpedition(1),
      departed: [],
    },
    mapId: 0,
    siteMaps: [],
    stranger: null,
    narrator: {
      style: 'balanced',
      phase: 'calm',
      phaseEndsAt: Number.MAX_SAFE_INTEGER,
      nextEventAt: Number.MAX_SAFE_INTEGER, // sin sucesos salvo que el test los pida
      lastAt: {},
    },
    decisions: [],
    piles: [],
    blueprints: [],
    furniture: [],
    chopMarks: [],
    zombies: [],
    zombieRng: createRng(2),
    zombieLevel: 'normal',
    nextZombieId: 1,
    nextZombieAt: Number.MAX_SAFE_INTEGER, // sin llegadas salvo que el test las pida
    damage: {},
    zombieSightedDay: 0,
    curtains: [],
    bills: [],
    nextBillId: 1,
    town: { x: 0, y: 0, w: width, h: height },
    hordes: [],
    nextHordeId: 1,
    siege: null,
    leaving: [],
    returning: [],
    mercy: [],
    gone: [],
    waterCutAt: Number.MAX_SAFE_INTEGER, // con agua corriente salvo que el test la corte
  };
}

/** Añade un superviviente (sin cama) en el centro de la casilla `t`. */
export function addSurvivor(w: World, t: Point, name = 'Bea'): Survivor {
  const s = fixturePerson(w, name);
  s.pos = { x: t.x + 0.5, y: t.y + 0.5 };
  w.survivors.push(s);
  return s;
}

/** Un superviviente nuevo (sin cama ni sitio), como el primero de algún mapa, con su ropa. */
export function fixturePerson(w: World, name = 'Bea'): Survivor {
  const template = [w, ...w.siteMaps.map((m) => m.world)].flatMap((m) => m.survivors)[0]!;
  return {
    ...structuredClone(template),
    id: w.common.nextId++,
    name,
    pos: { ...template.pos },
    action: { type: 'idle', ticksLeft: 0 },
    path: [],
    needs: { hunger: 100, sleep: 100, mood: 50, social: 100 },
    traits: [],
    memories: [],
    bedId: null,
    carrying: emptyInventory(),
    opinions: {},
    partnerId: null,
    nextChatAt: 0,
    bubble: null,
    fever: null,
    celebrated: false,
    drafted: false,
    carryingId: null,
    wounds: [],
    blood: 100,
    dying: null,
    painkillerUntil: 0,
    painkillerWanted: false,
    infection: null,
    worn: [newGarment(w, 'tshirt'), newGarment(w, 'jeans')],
  };
}

/**
 * Un sitio de prueba (H5c1) de `width`×`height` sin nadie, con la caja común de la base y su
 * campamento (el almacén) en las 3×3 casillas de la esquina; queda en `base.siteMaps`.
 */
export function siteForTest(base: World, siteId: number, width = 12, height = 12): World {
  const w = emptyWorld(width, height);
  w.common = base.common;
  w.mapId = siteId;
  w.survivors = [];
  w.beds = [];
  w.storage = { tiles: [], items: emptyInventory() };
  for (let y = 1; y <= 3; y++)
    for (let x = 1; x <= 3; x++) {
      w.storage.tiles.push({ x, y });
      setTile(w.grid, x, y, Tile.Floor); // el suelo del campamento
    }
  w.base = { ...w.base, rect: { x: 1, y: 1, w: 3, h: 3 }, door: { x: 2, y: 3 } };
  w.tick = base.tick;
  base.siteMaps.push({ siteId, world: w });
  return w;
}

/** Lleva a `s` de su mapa a `to`, al campamento o al almacén (sin viajar). */
export function moveTo(base: World, to: World, s: Survivor): void {
  for (const m of [base, ...base.siteMaps.map((x) => x.world)])
    m.survivors = m.survivors.filter((x) => x !== s);
  const t = to.storage.tiles[0]!;
  s.pos = { x: t.x + 0.5, y: t.y + 0.5 };
  s.action = { type: 'idle', ticksLeft: 0 };
  s.path = [];
  to.survivors.push(s);
}

/** Deja solo a esos colonos (los demás se van del mundo con su ropa, H5b). */
export function keepSurvivors(w: World, keep: Survivor[]): void {
  for (const s of w.survivors)
    if (!keep.includes(s)) piecesGone(w, [...s.worn, ...s.carrying.pieces, ...wornBags(s)]);
  w.survivors = w.survivors.filter((s) => keep.includes(s));
}

/** Pone muros en las 8 casillas vecinas. */
export function encloseTile(w: World, t: Point): void {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (dx !== 0 || dy !== 0) {
        setTile(w.grid, t.x + dx, t.y + dy, Tile.Wall);
        // Si era una ventana, sus cortinas se van con ella (H4d).
        const i = (t.y + dy) * w.grid.width + t.x + dx;
        w.curtains = w.curtains.filter((c) => c !== i);
      }
}

/**
 * Sin zombis, llegadas ni hordas del narrador (H4e): para los tests de lo que no tiene que ver con
 * ellos (antes de H4b). Las hordas, como si acabaran de salir para siempre.
 */
export function withoutZombies(w: World): World {
  for (const z of w.zombies) piecesGone(w, [...z.worn, ...z.bags]);
  w.zombies = [];
  w.nextZombieAt = Number.MAX_SAFE_INTEGER;
  w.narrator.lastAt.siege = Number.MAX_SAFE_INTEGER;
  w.narrator.lastAt.wanderers = Number.MAX_SAFE_INTEGER;
  return w;
}

/**
 * Una base de verdad en `rect` (muros alrededor, suelo dentro y la puerta en medio del muro de
 * abajo), con la cama y el almacén dentro: para los tests que necesitan un dentro y un fuera.
 */
export function addBase(w: World, rect: { x: number; y: number; w: number; h: number }): World {
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const edge =
        x === rect.x || y === rect.y || x === rect.x + rect.w - 1 || y === rect.y + rect.h - 1;
      setTile(w.grid, x, y, edge ? Tile.Wall : Tile.Floor);
    }
  const door = { x: rect.x + Math.floor(rect.w / 2), y: rect.y + rect.h - 1 };
  setTile(w.grid, door.x, door.y, Tile.Door);
  w.base = { id: 0, kind: 'base', rect: { ...rect }, door };
  for (const b of w.beds) b.pos = { x: rect.x + 1 + (b.id - 1), y: rect.y + 1 };
  w.storage.tiles = [{ x: door.x, y: door.y - 1 }];
  return w;
}
