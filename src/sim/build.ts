// Construir (spec H4a §4): dónde se puede, marcas de talar y planos.
import { emptyInventory } from './items';
import { getTile, inBounds } from './map/grid';
import { dropPile, pileAt } from './piles';
import { Tile, type BuildKind, type Point, type World } from './types';

const BUILDABLE_GROUND: ReadonlySet<Tile> = new Set([Tile.Grass, Tile.Floor, Tile.Road]);
/** Muros y puertas también se levantan sobre escombros (así se reparan los muros rotos). */
const WALL_GROUND: ReadonlySet<Tile> = new Set([...BUILDABLE_GROUND, Tile.Rubble]);

/** Lo que al terminarse ocupa la casilla: no se termina con alguien encima, y para construir otra
 * cosa es mejor no ponerse encima de su plano. */
export const WALL_KINDS: ReadonlySet<BuildKind> = new Set([
  'woodWall',
  'woodDoor',
  'fixDoor',
  'board',
]);

/** ¿Hay un plano de muro o puerta en esa casilla? */
export function wallPlanAt(w: World, x: number, y: number): boolean {
  return w.blueprints.some((b) => b.pos.x === x && b.pos.y === y && WALL_KINDS.has(b.kind));
}

/**
 * ¿Hay algo en esa casilla que impida construir? (mueble, cama, contenedor, almacén, montón, plano)
 * Un cuerpo de zombi no (H4d): suelen caer en los boquetes, y al terminar el muro se aparta.
 */
function occupied(w: World, x: number, y: number): boolean {
  const at = (p: Point) => p.x === x && p.y === y;
  return (
    w.furniture.some((f) => at(f.pos)) ||
    w.beds.some((b) => at(b.pos)) ||
    w.containers.some((c) => c.kind !== 'corpse' && at(c.pos)) ||
    w.storage.tiles.some(at) ||
    pileAt(w, x, y) !== undefined ||
    w.blueprints.some((b) => at(b.pos))
  );
}

/** ¿Es suelo de la casa sin nada encima? (Para las camas de serie de los recién llegados.) */
export function freeFloor(w: World, p: Point): boolean {
  return getTile(w.grid, p.x, p.y) === Tile.Floor && !occupied(w, p.x, p.y);
}

/** ¿Se puede poner un plano de `kind` en `p`? (spec H4a §4.1 y H4b §4.2) */
export function canPlace(w: World, kind: BuildKind, p: Point): boolean {
  if (!inBounds(w.grid, p.x, p.y) || w.seen[p.y * w.grid.width + p.x] !== 1) return false;
  if (w.blueprints.some((b) => b.pos.x === p.x && b.pos.y === p.y)) return false;
  if (!tileFits(w, kind, p)) return false;
  return !GROUND_KINDS.has(kind) || !occupied(w, p.x, p.y);
}

/** Lo que se construye sobre suelo libre (el resto va sobre una ventana, una puerta…). */
const GROUND_KINDS: ReadonlySet<BuildKind> = new Set([
  'bed',
  'table',
  'campfire',
  'woodWall',
  'woodDoor',
  'tub', // H5b
]);

/** ¿Tiene cortinas esa ventana? (H4d) */
export function hasCurtains(w: World, p: Point): boolean {
  return w.curtains.includes(p.y * w.grid.width + p.x);
}

/** ¿Encaja `kind` con la casilla tal como está? (sin mirar lo que haya encima) */
export function tileFits(w: World, kind: BuildKind, p: Point): boolean {
  const t = getTile(w.grid, p.x, p.y);
  switch (kind) {
    case 'board':
      return t === Tile.Window || t === Tile.CurtainedWindow || t === Tile.BrokenWindow;
    // Cortinas (H4d): en ventanas sin tapiar, con o sin cortinas según el plano.
    case 'curtains':
    case 'takeDownCurtains':
      return (t === Tile.Window || t === Tile.CurtainedWindow) && hasCurtains(w, p);
    case 'hangCurtains':
      return t === Tile.Window && !hasCurtains(w, p);
    case 'smashWindow':
      return t === Tile.Window || t === Tile.CurtainedWindow;
    case 'unboard':
      return t === Tile.BoardedWindow;
    case 'repair':
      return w.damage[String(p.y * w.grid.width + p.x)] !== undefined;
    case 'fixDoor':
      return t === Tile.BrokenDoor;
    case 'woodWall':
    case 'woodDoor':
      return WALL_GROUND.has(t);
    default:
      return BUILDABLE_GROUND.has(t);
  }
}

/**
 * Qué plano pone "Reparar" en esa casilla (spec H4b §4.2): lo dañado se repara, la puerta rota se
 * arregla, la ventana rota se tapia y los escombros pasan a muro de madera. `null` si no hay nada.
 */
export function repairKindAt(w: World, p: Point): BuildKind | null {
  if (w.damage[String(p.y * w.grid.width + p.x)] !== undefined) return 'repair';
  const t = getTile(w.grid, p.x, p.y);
  if (t === Tile.BrokenDoor) return 'fixDoor';
  if (t === Tile.BrokenWindow) return 'board';
  if (t === Tile.Rubble) return 'woodWall';
  return null;
}

/** ¿Es un plano de reparar? (van antes que los demás, spec H4b §4.2) */
export function isRepairPlan(w: World, b: { kind: BuildKind; pos: Point }): boolean {
  const t = getTile(w.grid, b.pos.x, b.pos.y);
  return (
    b.kind === 'repair' ||
    b.kind === 'fixDoor' ||
    (b.kind === 'board' && t === Tile.BrokenWindow) ||
    (b.kind === 'woodWall' && t === Tile.Rubble)
  );
}

/** ¿Está marcado para talar, contando órdenes pendientes? (Para la interfaz en pausa.) */
export function treeMarked(w: World, x: number, y: number): boolean {
  const i = y * w.grid.width + x;
  let on = w.chopMarks.includes(i);
  for (const o of w.orders) if (o.type === 'markTree' && o.x === x && o.y === y) on = o.on;
  return on && getTile(w.grid, x, y) === Tile.Tree;
}

/** Todos los árboles marcados (índices), contando órdenes pendientes; en un solo recorrido. */
export function markedTrees(w: World): Set<number> {
  const on = new Set(w.chopMarks);
  for (const o of w.orders) {
    if (o.type !== 'markTree' || !inBounds(w.grid, o.x, o.y)) continue;
    const i = o.y * w.grid.width + o.x;
    if (o.on) on.add(i);
    else on.delete(i);
  }
  for (const i of on) if (w.grid.tiles[i] !== Tile.Tree) on.delete(i);
  return on;
}

export function markTree(w: World, x: number, y: number, on: boolean): void {
  const i = y * w.grid.width + x;
  const has = w.chopMarks.includes(i);
  if (!on) {
    if (has) w.chopMarks = w.chopMarks.filter((k) => k !== i);
    return;
  }
  if (has || !inBounds(w.grid, x, y) || w.seen[i] !== 1) return;
  if (getTile(w.grid, x, y) === Tile.Tree) w.chopMarks.push(i);
}

export function placeBlueprint(w: World, kind: BuildKind, x: number, y: number): void {
  if (!canPlace(w, kind, { x, y })) return;
  w.blueprints.push({
    id: w.common.nextId++,
    kind,
    pos: { x, y },
    wood: 0,
    progress: 0,
    curtains: 0,
  });
}

/** Quita el plano; la madera (y las cortinas) que tuviera quedan en un montón. */
export function cancelBlueprint(w: World, id: number): void {
  const b = w.blueprints.find((x) => x.id === id);
  if (!b) return;
  w.blueprints = w.blueprints.filter((x) => x !== b);
  dropPile(w, b.pos, { ...emptyInventory(), wood: b.wood, curtains: b.curtains ?? 0 });
}
