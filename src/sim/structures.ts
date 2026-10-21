// Lo que pueden romper los zombis (spec H4b §4.1): resistencia, romper y reparar.
import { RESISTANCE } from './balance';
import { cancelBlueprint, tileFits } from './build';
import { contains } from './geom';
import { logEvent } from './log';
import { getTile, inBounds, setTile } from './map/grid';
import { Tile, type World } from './types';

/** En qué se convierte cada cosa al romperse. */
const BROKEN: Partial<Record<Tile, Tile>> = {
  [Tile.Window]: Tile.BrokenWindow,
  [Tile.BoardedWindow]: Tile.BrokenWindow,
  [Tile.Door]: Tile.BrokenDoor,
  [Tile.WoodWall]: Tile.Rubble,
  [Tile.Wall]: Tile.Rubble,
};

const WHAT: Partial<Record<Tile, 'door' | 'window' | 'wall'>> = {
  [Tile.Window]: 'window',
  [Tile.BoardedWindow]: 'window',
  [Tile.Door]: 'door',
  [Tile.WoodWall]: 'wall',
  [Tile.Wall]: 'wall',
};

const key = (w: World, x: number, y: number) => String(y * w.grid.width + x);

/** Resistencia que le queda a la casilla, o `undefined` si no se puede romper. */
export function resistanceOf(w: World, x: number, y: number): number | undefined {
  if (!inBounds(w.grid, x, y)) return undefined;
  const full = RESISTANCE[getTile(w.grid, x, y)];
  if (full === undefined) return undefined;
  return w.damage[key(w, x, y)] ?? full;
}

/** ¿Está dañada (sin llegar a romperse)? */
export function isDamaged(w: World, x: number, y: number): boolean {
  return w.damage[key(w, x, y)] !== undefined;
}

/**
 * Le quita `amount` de resistencia. Si llega a 0, se rompe: la casilla cambia, se cancelan los
 * planos que ya no tienen sentido y queda en el registro. Devuelve si se ha roto.
 */
export function damageTile(w: World, x: number, y: number, amount: number): boolean {
  const left = resistanceOf(w, x, y);
  if (left === undefined) return false;
  const k = key(w, x, y);
  if (left - amount > 0) {
    w.damage[k] = left - amount;
    return false;
  }
  const tile = getTile(w.grid, x, y);
  delete w.damage[k];
  setTile(w.grid, x, y, BROKEN[tile]!);
  for (const b of w.blueprints.filter((p) => p.pos.x === x && p.pos.y === y))
    if (!tileFits(w, b.kind, { x, y })) cancelBlueprint(w, b.id);
  logEvent(w, { kind: 'broken', what: WHAT[tile]!, x, y, inBase: contains(w.base.rect, { x, y }) });
  return true;
}

/** Como nueva: sin daños. */
export function repairTile(w: World, x: number, y: number): void {
  delete w.damage[key(w, x, y)];
}
