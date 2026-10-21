// Talar (spec H4a §3.2): coger el hacha, ir al árbol marcado más cercano y talarlo.
import { CHOP_TICKS, CHOP_WOOD_MAX, CHOP_WOOD_MIN } from '../balance';
import { emptyInventory } from '../items';
import { getTile, setTile } from '../map/grid';
import { dropPile } from '../piles';
import { nextInt, pick } from '../rng';
import { Tile, type Action, type Point, type Survivor, type World } from '../types';
import { tileOf } from '../world';
import { standBeside } from './stand';

/** Árbol (índice de casilla) al que va o que está talando, o `null`. */
export function chopTarget(s: Survivor): number | null {
  const a = s.action;
  if (a.type === 'chop') return a.tree;
  if (a.type === 'moveTo' && a.then?.type === 'chop') return a.then.tree;
  return null;
}

const goingFor = (s: Survivor, kind: 'takeAxe' | 'storeAxe') =>
  s.action.type === 'moveTo' && s.action.then?.type === kind;

/** ¿Sigue marcado y siendo un árbol? */
function marked(w: World, tree: number): boolean {
  return w.chopMarks.includes(tree) && w.grid.tiles[tree] === Tile.Tree;
}

function toStorage(w: World, then: { type: 'takeAxe' } | { type: 'storeAxe' }): Action {
  return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then };
}

/** Quien tiene el hacha y no puede talar la devuelve, para que otro la use. */
export function returnAxeJob(s: Survivor, w: World): Action | null {
  return s.equipped === 'axe' && !s.work.chop ? toStorage(w, { type: 'storeAxe' }) : null;
}

/** El árbol marcado más cercano que nadie más va a talar y al que puede llegar, o `null`. */
function treeToChop(s: Survivor, w: World): { tree: number; stand: Point } | null {
  const claimed = new Set(w.survivors.filter((o) => o !== s).map(chopTarget));
  const at = tileOf(s.pos);
  let best: { tree: number; stand: Point } | null = null;
  let bestD = Infinity;
  for (const tree of w.chopMarks) {
    if (claimed.has(tree) || w.grid.tiles[tree] !== Tile.Tree) continue;
    const p = { x: tree % w.grid.width, y: Math.floor(tree / w.grid.width) };
    const d = (p.x - at.x) ** 2 + (p.y - at.y) ** 2;
    if (d >= bestD) continue;
    const stand = standBeside(w, s, p);
    if (!stand) continue;
    best = { tree, stand };
    bestD = d;
  }
  return best;
}

export function chopJob(s: Survivor, w: World): Action | null {
  if (w.chopMarks.length === 0) return null;
  const best = treeToChop(s, w);
  if (!best) return null;
  if (s.equipped !== 'axe') {
    // Hachas libres en el almacén: las que no va a coger ya otro.
    const others = w.survivors.filter((o) => o !== s && goingFor(o, 'takeAxe')).length;
    return w.storage.items.axe > others ? toStorage(w, { type: 'takeAxe' }) : null;
  }
  return { type: 'moveTo', target: best.stand, then: { type: 'chop', tree: best.tree } };
}

/** ¿Sigue teniendo sentido lo que hace? */
export function chopStillWorth(s: Survivor, w: World): boolean {
  if (goingFor(s, 'takeAxe'))
    return s.work.chop && s.equipped === null && w.storage.items.axe > 0 && w.chopMarks.length > 0;
  if (goingFor(s, 'storeAxe')) return s.equipped === 'axe';
  const tree = chopTarget(s);
  return tree !== null && s.work.chop && s.equipped === 'axe' && marked(w, tree);
}

/** Al llegar: coge o deja el hacha, o empieza a talar si sigue teniendo sentido. */
export function startChopActivity(
  s: Survivor,
  w: World,
  activity: { type: 'takeAxe' } | { type: 'storeAxe' } | { type: 'chop'; tree: number },
): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  if (activity.type === 'takeAxe') {
    if (s.equipped === null && w.storage.items.axe > 0) {
      w.storage.items.axe--;
      s.equipped = 'axe';
    }
    return idle;
  }
  if (activity.type === 'storeAxe') {
    if (s.equipped === 'axe') {
      w.storage.items.axe++;
      s.equipped = null;
    }
    return idle;
  }
  const t = tileOf(s.pos);
  const tx = activity.tree % w.grid.width;
  const ty = Math.floor(activity.tree / w.grid.width);
  const next = Math.max(Math.abs(t.x - tx), Math.abs(t.y - ty)) === 1;
  if (!next || s.equipped !== 'axe' || !marked(w, activity.tree)) return idle;
  return { type: 'chop', tree: activity.tree, ticksLeft: CHOP_TICKS };
}

/** Árbol talado: hierba, sin marca y un montón de madera en su casilla. */
export function finishChop(w: World, tree: number): void {
  const x = tree % w.grid.width;
  const y = Math.floor(tree / w.grid.width);
  w.chopMarks = w.chopMarks.filter((k) => k !== tree);
  if (getTile(w.grid, x, y) !== Tile.Tree) return;
  setTile(w.grid, x, y, Tile.Grass);
  const wood = nextInt(w.rng, CHOP_WOOD_MIN, CHOP_WOOD_MAX);
  w.woodLog.chopped += wood;
  dropPile(w, { x, y }, { ...emptyInventory(), wood });
}
