// Talar (spec H4a §3.2): coger el hacha, ir al árbol marcado más cercano y talarlo.
import { CHOP_TICKS, CHOP_WOOD_MAX, CHOP_WOOD_MIN, HATCHET_CHOP } from '../balance';
import { workSpeed } from '../skills';
import { emptyInventory } from '../items';
import { getTile, setTile } from '../map/grid';
import { dropPile } from '../piles';
import { nextInt, pick } from '../rng';
import { Tile, type Action, type Point, type Survivor, type World } from '../types';
import { tileOf } from '../world';
import { standBeside } from './stand';
import { canChop, chopsWith, takeBest } from './weapons';

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

/**
 * Quien lleva el hacha y no puede talar (sin permiso, con gripe y descansando…) la devuelve si hay
 * árboles marcados, para que otro la use; salvo que la tenga fijada (spec H4b §6.2).
 */
export function returnAxeJob(s: Survivor, w: World): Action | null {
  if (s.equipped !== 'axe' || s.weaponLocked || w.chopMarks.length === 0 || canChop(s)) return null;
  return toStorage(w, { type: 'storeAxe' });
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
  // Con la hachuela en la mano tala sin ir a por el hacha (H5b2 §4).
  if (!chopsWith(s.equipped)) {
    if (s.weaponLocked) return null; // con otra arma fijada no tala
    // Hachas libres en el almacén: las que no va a coger ya otro.
    const others = w.survivors.filter((o) => o !== s && goingFor(o, 'takeAxe')).length;
    return w.storage.items.axe > others ? toStorage(w, { type: 'takeAxe' }) : null;
  }
  return { type: 'moveTo', target: best.stand, then: { type: 'chop', tree: best.tree } };
}

/** ¿Sigue teniendo sentido lo que hace? */
export function chopStillWorth(s: Survivor, w: World): boolean {
  if (goingFor(s, 'takeAxe'))
    return canChop(s) && s.equipped !== 'axe' && w.storage.items.axe > 0 && w.chopMarks.length > 0;
  if (goingFor(s, 'storeAxe')) return s.equipped === 'axe';
  const tree = chopTarget(s);
  return tree !== null && s.work.chop && chopsWith(s.equipped) && marked(w, tree);
}

/** Al llegar: coge o deja el hacha, o empieza a talar si sigue teniendo sentido. */
export function startChopActivity(
  s: Survivor,
  w: World,
  activity: { type: 'takeAxe' } | { type: 'storeAxe' } | { type: 'chop'; tree: number },
): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  if (activity.type === 'takeAxe') {
    // Deja en el almacén lo que llevara y coge el hacha.
    if (s.equipped !== 'axe' && !s.weaponLocked && w.storage.items.axe > 0) {
      if (s.equipped) w.storage.items[s.equipped]++;
      w.storage.items.axe--;
      s.equipped = 'axe';
    }
    return idle;
  }
  if (activity.type === 'storeAxe') {
    // Deja el hacha y coge lo mejor que quede (spec H4b §6.2).
    if (s.equipped === 'axe') takeBest(s, w);
    return idle;
  }
  const t = tileOf(s.pos);
  const tx = activity.tree % w.grid.width;
  const ty = Math.floor(activity.tree / w.grid.width);
  const next = Math.max(Math.abs(t.x - tx), Math.abs(t.y - ty)) === 1;
  if (!next || !chopsWith(s.equipped) || !marked(w, activity.tree)) return idle;
  // Con más habilidad, antes (spec H4c §3.2); con la hachuela, más despacio (H5b2).
  const slow = s.equipped === 'hatchet' ? HATCHET_CHOP : 1;
  const ticksLeft = Math.round((CHOP_TICKS * slow) / workSpeed(s, 'chop'));
  return { type: 'chop', tree: activity.tree, ticksLeft };
}

/** Árbol talado: hierba, sin marca y un montón de madera en su casilla. */
export function finishChop(w: World, tree: number): void {
  const x = tree % w.grid.width;
  const y = Math.floor(tree / w.grid.width);
  w.chopMarks = w.chopMarks.filter((k) => k !== tree);
  if (getTile(w.grid, x, y) !== Tile.Tree) return;
  setTile(w.grid, x, y, Tile.Grass);
  const wood = nextInt(w.rng, CHOP_WOOD_MIN, CHOP_WOOD_MAX);
  w.common.woodLog.chopped += wood;
  dropPile(w, { x, y }, { ...emptyInventory(), wood });
}
