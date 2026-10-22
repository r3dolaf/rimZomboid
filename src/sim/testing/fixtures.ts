// Ayudas para los tests de la simulación.
import { emptyInventory } from '../items';
import { createGrid, setTile } from '../map/grid';
import { createRng } from '../rng';
import { SKILLS } from '../skills';
import { Tile, type Point, type Skill, type SkillId, type Survivor, type World } from '../types';

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
        work: { social: true, build: true, craft: true, haul: true, chop: true, loot: true },
        priorities: { social: 3, build: 3, craft: 3, haul: 3, chop: 3, loot: 3 },
        equipped: null,
        weaponLocked: false,
        health: 100,
        stance: 'decide',
        opinions: {},
        partnerId: null,
        nextChatAt: 0,
        bubble: null,
        sick: null,
        celebrated: false,
      },
    ],
    beds: [{ id: 1, pos: { x: width - 1, y: 0 }, ownerId: 1 }],
    storage: { tiles: [{ x: 0, y: height - 1 }], items: { ...emptyInventory(), food: 10 } },
    containers: [],
    seen: new Array<number>(width * height).fill(0),
    orders: [],
    log: [],
    nextId: 2,
    stranger: null,
    narrator: {
      style: 'balanced',
      phase: 'calm',
      phaseEndsAt: Number.MAX_SAFE_INTEGER,
      nextEventAt: Number.MAX_SAFE_INTEGER, // sin sucesos salvo que el test los pida
      lastAt: {},
    },
    decisions: [],
    stormUntil: 0,
    piles: [],
    blueprints: [],
    furniture: [],
    chopMarks: [],
    woodLog: { start: 0, chopped: 0, recovered: 0, spent: 0, wasted: 0 },
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
    weaponLog: { fromCorpses: 0, rotted: 0 },
    town: { x: 0, y: 0, w: width, h: height },
    hordes: [],
    nextHordeId: 1,
    siege: null,
  };
}

/** Añade un superviviente (sin cama) en el centro de la casilla `t`. */
export function addSurvivor(w: World, t: Point, name = 'Bea'): Survivor {
  const s: Survivor = {
    ...structuredClone(w.survivors[0]!),
    id: w.nextId++,
    name,
    pos: { x: t.x + 0.5, y: t.y + 0.5 },
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
    sick: null,
    celebrated: false,
  };
  w.survivors.push(s);
  return s;
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

/** Sin zombis ni llegadas: para los tests de lo que no tiene que ver con ellos (antes de H4b). */
export function withoutZombies(w: World): World {
  w.zombies = [];
  w.nextZombieAt = Number.MAX_SAFE_INTEGER;
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
