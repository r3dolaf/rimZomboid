// Lo que suena de la partida (spec S1 §1.3): qué ha pasado desde el fotograma anterior, los sonidos
// al azar (gemidos y pájaros) y el ambiente. Solo lee el mapa que se ve; nunca lo cambia.
import { darkness } from '../sim/clock';
import { isRaining } from '../sim/water';
import { Tile, type Point, type World } from '../sim/types';
import { isLitFire } from '../sim/furniture';
import type { SfxId } from './catalog';
import { placeSound, type ListenerView } from './space';

/** Un efecto que suena en `at` (casillas). */
export interface Cue {
  id: SfxId;
  at: Point;
}

/** Cada cuánto suena quien tala, fuerza una puerta o construye. */
export const WORK_MS = { chop: 650, pry: 900, build: 420 } as const;

const WINDOWS: readonly number[] = [Tile.Window, Tile.CurtainedWindow, Tile.BoardedWindow];
const DOORS: readonly number[] = [Tile.Door, Tile.LockedDoor];
const WALLS: readonly number[] = [Tile.Wall, Tile.WoodWall];

/** Lo que suena al cambiar una casilla de `before` a `now`, o nada. */
function tileCue(before: number, now: number): SfxId | null {
  if (before === Tile.Tree && now !== Tile.Tree) return 'treeFall';
  if (now === Tile.BrokenWindow && WINDOWS.includes(before)) return 'glass';
  if (now === Tile.BrokenDoor && DOORS.includes(before)) return 'crash';
  if (now === Tile.Rubble && WALLS.includes(before)) return 'crash';
  return null;
}

interface Memo {
  world: World;
  version: number;
  tiles: Int8Array;
  wounds: Map<number, number>;
  health: Map<number, number>;
  damage: Map<string, number>;
  /** D1: el tick del último disparo de cada uno (−1 si no ha disparado). */
  shots: Map<number, number>;
}

function remember(w: World, version: number, tiles: Int8Array): Memo {
  return {
    world: w,
    version,
    tiles,
    wounds: new Map(w.survivors.map((s) => [s.id, s.wounds.length])),
    health: new Map(w.zombies.map((z) => [z.id, z.health])),
    damage: new Map(Object.entries(w.damage)),
    shots: new Map(w.survivors.map((s) => [s.id, s.shot?.tick ?? -1])),
  };
}

/**
 * Compara cada fotograma con el anterior (como `GameScene` para los golpes, A5): heridas nuevas,
 * zombis que pierden vida, golpes a puertas, ventanas y muros, casillas rotas y árboles talados, y
 * el ritmo de quien trabaja. Otro mapa (u otra partida) empieza de cero, sin sonar.
 */
export function createWatcher() {
  let memo: Memo | null = null;
  const nextWork = new Map<string, number>(); // por colono y trabajo
  return {
    /** Olvida lo anterior: el siguiente fotograma empieza de cero, sin sonar. */
    reset(): void {
      memo = null;
    },
    watch(w: World, now: number, advancing: boolean): Cue[] {
      const g = w.grid;
      if (!memo || memo.world !== w) {
        memo = remember(w, g.version, Int8Array.from(g.tiles));
        nextWork.clear();
        for (const s of w.survivors) nextWork.set(`${s.id}:${s.action.type}`, now);
        return [];
      }
      const cues: Cue[] = [];
      const center = (i: number) => ({ x: (i % g.width) + 0.5, y: Math.floor(i / g.width) + 0.5 });
      for (const s of w.survivors) {
        const before = memo.wounds.get(s.id);
        if (before !== undefined && s.wounds.length > before) cues.push({ id: 'hurt', at: s.pos });
        // D1: un disparo nuevo (quien acaba de llegar al mapa no cuenta).
        const shot = memo.shots.get(s.id);
        if (s.shot && shot !== undefined && s.shot.tick !== shot)
          cues.push({ id: s.shot.gun === 'shotgun' ? 'shotgunBlast' : 'gunshot', at: s.pos });
      }
      for (const z of w.zombies) {
        const before = memo.health.get(z.id);
        if (before !== undefined && z.health < before) cues.push({ id: 'hitZombie', at: z.pos });
      }
      for (const [k, v] of Object.entries(w.damage)) {
        const before = memo.damage.get(k);
        if (before === undefined || v < before) cues.push({ id: 'bang', at: center(Number(k)) });
      }
      let tiles = memo.tiles;
      if (g.version !== memo.version) {
        tiles = Int8Array.from(g.tiles);
        for (let i = 0; i < tiles.length; i++) {
          if (tiles[i] === memo.tiles[i]) continue;
          const id = tileCue(memo.tiles[i]!, tiles[i]!);
          if (id) cues.push({ id, at: center(i) });
        }
      }
      if (advancing)
        for (const s of w.survivors) {
          const type = s.action.type;
          if (type !== 'chop' && type !== 'pry' && type !== 'build') continue;
          const key = `${s.id}:${type}`;
          if (now < (nextWork.get(key) ?? now)) continue;
          nextWork.set(key, now + WORK_MS[type]);
          cues.push({ id: type, at: s.pos });
        }
      memo = remember(w, g.version, tiles);
      return cues;
    },
  };
}

/** Gemidos por segundo de cada zombi que se oye (más si persigue a alguien), y como mucho. */
const GROAN_RATE = 0.05;
const GROAN_CHASE_RATE = 0.2;
export const GROAN_MAX_RATE = 0.5;
/** Pájaros por segundo, de día y sin lluvia. */
const BIRD_RATE = 0.15;

/** Sonidos al azar en este rato (`dtMs`): gemidos de los zombis que se oyen y pájaros. */
export function randomCues(w: World, v: ListenerView, dtMs: number, rnd: () => number): Cue[] {
  const cues: Cue[] = [];
  const heard = w.zombies.filter((z) => placeSound(z.pos, v) !== null);
  const rate = Math.min(
    GROAN_MAX_RATE,
    heard.reduce((a, z) => a + (z.state === 'chase' ? GROAN_CHASE_RATE : GROAN_RATE), 0),
  );
  if (heard.length > 0 && rnd() < (rate * dtMs) / 1000) {
    const z = heard[Math.min(heard.length - 1, Math.floor(rnd() * heard.length))]!;
    cues.push({ id: 'groan', at: z.pos });
  }
  const birds = ambienceOf(w, v).birds;
  if (birds > 0 && rnd() < (BIRD_RATE * birds * dtMs) / 1000)
    cues.push({ id: 'bird', at: { x: v.x + rnd() * v.w, y: v.y + rnd() * v.h } });
  return cues;
}

/** Los sonidos que duran (spec S1 §1.2), de 0 a 1. */
export interface Ambience {
  rain: number;
  wind: number;
  fire: number;
  crickets: number;
  birds: number;
}

export function ambienceOf(w: World, v: ListenerView): Ambience {
  const storm = w.tick < w.common.stormUntil;
  const wet = storm || isRaining(w);
  const dark = darkness(w.tick);
  let fire = 0;
  for (const f of w.furniture) {
    if (!isLitFire(f)) continue; // V3: apagada no suena
    fire = Math.max(fire, placeSound({ x: f.pos.x + 0.5, y: f.pos.y + 0.5 }, v)?.gain ?? 0);
  }
  return {
    rain: storm ? 1 : wet ? 0.6 : 0,
    wind: storm ? 1 : 0,
    fire,
    crickets: dark * (wet ? 0.3 : 1),
    birds: (1 - dark) * (wet ? 0 : 1),
  };
}
