import {
  CLOTHES_SALT,
  ATLAS_START_SEEN,
  EXPEDITION_SALT,
  SITES_SALT,
  DEFAULT_OUTFITS,
  BANDAGES_CARRIED,
  BUILDINGS,
  CALM_DAYS_MAX,
  CALM_DAYS_MIN,
  CHAT_EVERY_MAX,
  EVENTS_START,
  INITIAL_REVEAL,
  LOCKED_DOOR_SALT,
  NEED_START_MAX,
  NEED_START_MIN,
  SEEDS_SALT,
  RADIO_SALT,
  GUN_SALT,
  POWER_SALT,
  START_ANTIBIOTICS,
  START_FOOD,
  START_SEEDS,
  START_WATER_BOTTLES,
  START_OPINION_MAX,
  START_OPINION_MIN,
  START_WEAPON,
  SCENARIOS,
  SETUP_MULT,
  TICKS_PER_DAY,
} from './balance';
import { generateAtlas } from './atlas/generate';
import { hexesWithin } from './atlas/hex';
import { placeSites } from './atlas/place';
import { bagFields } from './bags';
import { baseLayout } from './base';
import { dressStarter } from './clothes';
import { defaultOutfits } from './outfits';
import { baseSink, placeFixtures, rollWaterCut } from './water';
import { emptyInventory } from './items';
import {
  fillBags,
  fillFindings,
  fillGarments,
  fillHatchets,
  fillSeeds,
  fillBatteries,
  fillGuns,
  fillPower,
  placeContainers,
} from './loot';
import { revealFromSurvivors } from './vision';
import { generateMap } from './map/generate';
import { getTile, setTile } from './map/grid';
import { moodTarget } from './mood';
import { NAMES } from './names';
import { createRng, nextFloat, nextInt, type RngState } from './rng';
import { firstEdgeArrival, placeStartZombies } from './zombies/spawn';
import { rollSkills, skillRng } from './skills';
import { rollTraits } from './traits';
import { firstSiegeAt } from './narrator';
import { DEFAULT_SETUP, scaleLoot } from './setup';
import {
  Tile,
  type Atlas,
  type Expedition,
  type SiteInfo,
  type Bed,
  type GameSetup,
  type NarratorStyle,
  type Point,
  type Stance,
  type Storage,
  type Survivor,
  type TraitId,
  type WorkType,
  type World,
  type ZombieLevel,
} from './types';

/** Casilla en la que está una posición continua. */
export function tileOf(p: Point): Point {
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

/** Salt del azar de los zombis: se deriva de la semilla, pero va aparte. */
export const ZOMBIE_RNG_SALT = 0x2f6b9d1;

/**
 * El mapa del mundo y sus sitios al empezar (H5c2): se conoce lo de alrededor de la base; los sitios,
 * ocultos.
 */
export function newAtlas(seed: number): { atlas: Atlas; sites: SiteInfo[] } {
  const atlas = generateAtlas(seed);
  for (const i of hexesWithin(atlas, atlas.base, ATLAS_START_SEEN)) atlas.seen[i] = 1;
  return { atlas, sites: placeSites(atlas, createRng((seed ^ SITES_SALT) >>> 0)) };
}

/** Las expediciones al empezar (H5c1): sin sitios conocidos, con su propio azar. */
export function newExpedition(seed: number): Expedition {
  return { sites: [], travels: [], nextSiteId: 1, rng: createRng((seed ^ EXPEDITION_SALT) >>> 0) };
}

export function createWorld(
  seed: number,
  style: NarratorStyle = 'balanced',
  zombieLevel: ZombieLevel = 'normal',
  setup: GameSetup = DEFAULT_SETUP, // C2: el comienzo y los ajustes
): World {
  const scenario = SCENARIOS[setup.scenario];
  const people = scenario.people;
  const rng = createRng(seed);
  const { grid, base, houses, town, furniture } = generateMap(rng);

  const floor: Point[] = [];
  for (let y = base.rect.y; y < base.rect.y + base.rect.h; y++)
    for (let x = base.rect.x; x < base.rect.x + base.rect.w; x++)
      if (getTile(grid, x, y) === Tile.Floor) floor.push({ x, y });

  const spots = takeDistinct(rng, floor, people);
  const names = takeDistinct(rng, NAMES, people);
  const survivors: Survivor[] = spots.map((t, i) => ({
    id: i + 1,
    name: names[i]!,
    pos: { x: t.x + 0.5, y: t.y + 0.5 },
    brain: 'ai',
    action: { type: 'idle', ticksLeft: 0 },
    path: [],
    needs: {
      hunger: nextInt(rng, NEED_START_MIN, NEED_START_MAX),
      thirst: 100, // V2: se iguala al hambre abajo (sin tocar el azar)
      sleep: nextInt(rng, NEED_START_MIN, NEED_START_MAX),
      mood: 0, // se fija abajo con su objetivo
      social: 0, // se sortea abajo, después de los contenedores
    },
    traits: rollTraits(rng),
    skills: rollSkills(skillRng(seed, i + 1), []), // se sortea abajo con los rasgos
    memories: [],
    bedId: i + 1,
    // H5: salen con sus vendas (C2: con lo puesto, sin nada)
    carrying: { ...emptyInventory(), bandage: scenario.bare ? 0 : BANDAGES_CARRIED },
    work: defaultWork([]), // se ajusta abajo con los rasgos
    priorities: defaultPriorities(),
    equipped: scenario.bare ? null : START_WEAPON,
    weaponLocked: false,
    health: 100,
    stance: 'decide', // se ajusta abajo con los rasgos
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
    worn: [], // H5b: se viste abajo, con su propio azar
    likes: 'tshirt',
    hates: 'cap',
    outfitId: 1, // Cualquiera
    dressCheckAt: 0,
    trip: null,
    ...bagFields(), // H5b2: nadie empieza con bolsa
  }));
  // La ropa del principio y las preferencias (H5b), con su propio azar.
  const clothesRng = createRng((seed ^ CLOTHES_SALT) >>> 0);
  const pieces = { nextPieceId: 1, pieceLog: { made: 0, gone: 0 } };
  const { atlas, sites } = newAtlas(seed); // H5c2: el mapa del mundo
  for (const s of survivors) dressStarter(pieces, s, clothesRng);
  for (const s of survivors) {
    s.needs.thirst = s.needs.hunger; // V2: empieza con la misma sed que hambre
    s.work = defaultWork(s.traits);
    s.stance = defaultStance(s.traits);
    s.skills = rollSkills(skillRng(seed, s.id), s.traits);
  }

  // Muebles de la base (spec H2 §7): camas al fondo, almacén junto a la puerta (girados, H4f).
  const r = base.rect;
  const layout = baseLayout(base);
  const beds: Bed[] = survivors.map((s, i) => ({
    id: i + 1,
    pos: layout.beds[i]!,
    ownerId: s.id,
  }));
  const storage: Storage = {
    tiles: layout.storage,
    // C2: con lo puesto, vacío.
    items: scenario.bare
      ? emptyInventory()
      : {
          ...emptyInventory(),
          food: START_FOOD,
          antibiotics: START_ANTIBIOTICS,
          seeds: START_SEEDS, // V1
          waterBottle: START_WATER_BOTTLES, // V2
        },
  };
  scaleLoot(storage.items, SETUP_MULT.loot[setup.loot]); // C2: el ajuste Botín

  // Después de los supervivientes, para no cambiar partidas anteriores con la misma semilla.
  const containers = placeContainers(houses, furniture, rng);
  fillGarments(pieces, houses, containers, clothesRng); // H5b: la ropa, con su azar
  // H5b: fregaderos y cisternas, y cuándo se corta el agua (con el mismo azar).
  const firstId = Math.max(survivors.length, ...containers.map((c) => c.id)) + 1;
  const fixtures = placeFixtures(grid, houses, containers, clothesRng, firstId);
  // V2: el fregadero de la base, sin azar y con el último id (no cambia lo de antes).
  const sink = baseSink(grid, base, firstId + fixtures.length);
  if (sink) fixtures.push(sink);
  const waterCutAt = rollWaterCut(clothesRng);
  // H5b2: las bolsas y las hachuelas, con el mismo azar y al final (no cambia lo de antes).
  fillBags(pieces, houses, containers, clothesRng);
  fillHatchets(houses, containers, clothesRng);
  fillFindings(houses, containers, clothesRng); // H5c1: mapas de carreteras y notas
  fillSeeds(houses, containers, createRng((seed ^ SEEDS_SALT) >>> 0)); // V1, con su azar
  fillBatteries(houses, containers, createRng((seed ^ RADIO_SALT) >>> 0)); // C1, con su azar
  fillGuns(houses, containers, createRng((seed ^ GUN_SALT) >>> 0)); // D1, con su azar
  fillPower(houses, containers, createRng((seed ^ POWER_SALT) >>> 0)); // E1, con su azar
  for (const c of containers) scaleLoot(c.items, SETUP_MULT.loot[setup.loot]); // C2, sin azar

  // Relaciones (H3b), también después para no cambiar partidas anteriores.
  for (const s of survivors) {
    s.needs.social = nextInt(rng, NEED_START_MIN, NEED_START_MAX);
    s.nextChatAt = nextInt(rng, 0, CHAT_EVERY_MAX);
    for (const o of survivors)
      if (o !== s) s.opinions[o.id] = nextInt(rng, START_OPINION_MIN, START_OPINION_MAX);
  }
  for (const s of survivors) s.needs.mood = moodTarget(s, 0, base.rect);
  // Narrador (H3c), lo último: el estilo no cambia nada de lo anterior.
  const calmEndsAt = nextInt(rng, CALM_DAYS_MIN * TICKS_PER_DAY, CALM_DAYS_MAX * TICKS_PER_DAY);
  // Puertas atrancadas (H4d), con su propio azar, según el tipo de edificio (H4f).
  const lockRng = createRng((seed ^ LOCKED_DOOR_SALT) >>> 0);
  for (const h of houses)
    if (h.kind !== 'base' && nextFloat(lockRng) < BUILDINGS[h.kind].locked)
      setTile(grid, h.door.x, h.door.y, Tile.LockedDoor);

  const world: World = {
    seed,
    tick: 0,
    rng,
    grid,
    base,
    houses,
    survivors,
    beds,
    storage,
    containers,
    seen: new Array<number>(grid.width * grid.height).fill(0),
    orders: [],
    common: {
      log: [],
      nextId: firstId + fixtures.length,
      stormUntil: 0,
      rainUntil: 0, // H5b
      bagLog: { found: 0, dropped: 0, recovered: 0 }, // H5b2
      woodLog: {
        start: containers.reduce((acc, c) => acc + c.items.wood, 0),
        chopped: 0,
        recovered: 0,
        spent: 0,
        wasted: 0,
      },
      weaponLog: { fromCorpses: 0, fromSites: 0, rotted: 0 },
      nextWoundId: 1,
      dead: [],
      over: null,
      stats: { kills: 0, siegesRepelled: 0, looted: emptyInventory(), joined: [], harvested: 0 },
      nextPieceId: pieces.nextPieceId,
      pieceLog: pieces.pieceLog,
      outfits: defaultOutfits(),
      nextOutfitId: DEFAULT_OUTFITS.length + 1,
      expedition: { ...newExpedition(seed), sites, nextSiteId: sites.length + 1 },
      atlas,
      departed: [],
      usedNames: survivors.map((s) => s.name), // H6c
      setup: { ...setup }, // C2
    },
    mapId: 0,
    siteMaps: [],
    // Por encima de los muebles (H5): un cuerpo con el id de un mueble no se podía marcar.
    stranger: null,
    narrator: {
      style,
      phase: 'calm',
      phaseEndsAt: calmEndsAt,
      nextEventAt: EVENTS_START,
      lastAt: {},
      nextSiegeAt: firstSiegeAt(seed, style, setup), // N1 (C2: con el ajuste Asedios)
    },
    decisions: [],
    piles: [],
    blueprints: [],
    furniture: fixtures,
    chopMarks: [],
    plots: [], // V1
    zombies: [],
    zombieRng: createRng((seed ^ ZOMBIE_RNG_SALT) >>> 0),
    zombieLevel,
    nextZombieId: 1,
    nextZombieAt: firstEdgeArrival(),
    damage: {},
    zombieSightedDay: 0,
    // Al empezar, todas las ventanas tienen las cortinas abiertas (H4d).
    curtains: grid.tiles.flatMap((t, i) => (t === Tile.Window ? [i] : [])),
    bills: [],
    nextBillId: 1,
    town,
    hordes: [],
    nextHordeId: 1,
    siege: null,
    leaving: [],
    returning: [],
    mercy: [],
    gone: [],
    waterCutAt,
  };
  // Zombis (H4b), con su propio azar: no cambian nada de lo anterior.
  placeStartZombies(world);
  // Los supervivientes conocen su base y los alrededores.
  for (let y = r.y - INITIAL_REVEAL; y < r.y + r.h + INITIAL_REVEAL; y++)
    for (let x = r.x - INITIAL_REVEAL; x < r.x + r.w + INITIAL_REVEAL; x++)
      if (x >= 0 && y >= 0 && x < grid.width && y < grid.height) world.seen[y * grid.width + x] = 1;
  // Se conoce el pueblo (spec general §5.1): carreteras y exterior de los edificios.
  // Lo de dentro y lo que pasa fuera solo se ve con la línea de visión.
  const reveal = (x: number, y: number) => (world.seen[y * grid.width + x] = 1);
  for (let i = 0; i < grid.tiles.length; i++) if (grid.tiles[i] === Tile.Road) world.seen[i] = 1;
  for (const b of [base, ...houses]) {
    const { x, y, w, h } = b.rect;
    for (let i = x; i < x + w; i++) {
      reveal(i, y);
      reveal(i, y + h - 1);
    }
    for (let j = y; j < y + h; j++) {
      reveal(x, j);
      reveal(x + w - 1, j);
    }
  }
  revealFromSurvivors(world);
  return world;
}

/** Elige `n` elementos distintos al azar. */
function takeDistinct<T>(rng: RngState, items: readonly T[], n: number): T[] {
  if (items.length < n) throw new Error(`takeDistinct: faltan elementos (${items.length} < ${n})`);
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(pool.splice(nextInt(rng, 0, pool.length - 1), 1)[0]!);
  return out;
}

/** Trabajos por defecto: todos, salvo que el Cobarde no sale de la base (ni saquea ni tala). */
export function defaultWork(traits: readonly TraitId[]): Record<WorkType, boolean> {
  const out = !traits.includes('coward');
  // Sanar (H4e), también el Cobarde: rescatar es urgente.
  // Cultivar (V1), también el Cobarde: el huerto está junto a la base.
  return {
    heal: true,
    social: true,
    build: true,
    craft: true,
    haul: true,
    farm: true,
    chop: out,
    loot: out,
  };
}

/** Prioridades al empezar (H4d): todo a 3, y así se trabaja como antes; Sanar (H4e), a 1. */
export function defaultPriorities(): Record<WorkType, number> {
  return { heal: 1, social: 3, build: 3, craft: 3, haul: 3, farm: 3, chop: 3, loot: 3 };
}

/** Postura por defecto (spec H4b §7): el Cobarde huye, el Valiente pelea y el resto decide. */
export function defaultStance(traits: readonly TraitId[]): Stance {
  if (traits.includes('coward')) return 'flee';
  if (traits.includes('brave')) return 'fight';
  return 'decide';
}
