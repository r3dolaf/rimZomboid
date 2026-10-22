// Herramientas Talar y Construir: qué órdenes da cada clic o arrastre, teniendo en cuenta las aún
// pendientes (con el juego en pausa, la orden no se aplica hasta el siguiente tick).
import { canPlace, hasCurtains, markedTrees, repairKindAt, treeMarked } from '../sim/build';
import { getTile } from '../sim/map/grid';
import { issue } from '../sim/orders';
import { Tile, type Blueprint, type BuildKind, type Point, type World } from '../sim/types';

const seenTree = (w: World, x: number, y: number) =>
  w.seen[y * w.grid.width + x] === 1 && getTile(w.grid, x, y) === Tile.Tree;

/** Clic con Talar: marca o desmarca el árbol (si ya se ha visto). */
export function toggleTree(w: World, x: number, y: number): void {
  if (seenTree(w, x, y)) issue(w, { type: 'markTree', x, y, on: !treeMarked(w, x, y) });
}

/** Arrastrar con Talar: marca todos los árboles vistos del rectángulo entre `a` y `b`. */
export function markTreesIn(w: World, a: Point, b: Point): void {
  const marked = markedTrees(w);
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++)
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++)
      if (seenTree(w, x, y) && !marked.has(y * w.grid.width + x))
        issue(w, { type: 'markTree', x, y, on: true });
}

const cancelling = (w: World) =>
  new Set(w.orders.flatMap((o) => (o.type === 'cancelBlueprint' ? [o.id] : [])));

/** Planos que siguen en pie (sin los que tienen la cancelación pendiente). */
export function liveBlueprints(w: World): Blueprint[] {
  const gone = cancelling(w);
  return w.blueprints.filter((b) => !gone.has(b.id));
}

/** Planos pedidos que aún no se han puesto: los que se pondrán cuando se apliquen las órdenes. */
export function pendingPlacements(w: World): { kind: BuildKind; pos: Point }[] {
  const out: { kind: BuildKind; pos: Point }[] = [];
  for (const o of w.orders) {
    if (o.type !== 'placeBlueprint') continue;
    const pos = { x: o.x, y: o.y };
    if (out.some((p) => p.pos.x === o.x && p.pos.y === o.y) || !canPlace(w, o.kind, pos)) continue;
    out.push({ kind: o.kind, pos });
  }
  return out;
}

const pendingAt = (w: World, x: number, y: number) =>
  pendingPlacements(w).some((p) => p.pos.x === x && p.pos.y === y);

/** Qué plano pone una opción del menú en esa casilla: Reparar y Cortinas dependen de ella. */
export function buildKindAt(w: World, kind: BuildKind, p: Point): BuildKind | null {
  if (kind === 'repair') return repairKindAt(w, p); // spec H4b §4.2
  // Cortinas (spec H4d §3): con cortinas, correrlas o abrirlas; sin ellas, colgar unas.
  if (kind === 'curtains' && getTile(w.grid, p.x, p.y) === Tile.Window && !hasCurtains(w, p))
    return 'hangCurtains';
  return kind;
}

/**
 * Clic con Construir: en un plano, lo cancela; si no, pone ahí el plano elegido (si se puede).
 * Con Reparar y Cortinas, el plano lo elige la casilla.
 */
export function buildAt(w: World, kind: BuildKind, x: number, y: number): void {
  const b = w.blueprints.find((p) => p.pos.x === x && p.pos.y === y);
  if (b) {
    if (!cancelling(w).has(b.id)) issue(w, { type: 'cancelBlueprint', id: b.id });
    return;
  }
  const actual = buildKindAt(w, kind, { x, y });
  if (actual && !pendingAt(w, x, y) && canPlace(w, actual, { x, y }))
    issue(w, { type: 'placeBlueprint', kind: actual, x, y });
}

/** Casillas en línea recta desde `a`, por el eje en que más se ha arrastrado, hasta `b`. */
export function wallLine(a: Point, b: Point): Point[] {
  const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  const len = horizontal ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y);
  const dir = Math.sign(horizontal ? b.x - a.x : b.y - a.y);
  const out: Point[] = [];
  for (let i = 0; i <= len; i++)
    out.push(horizontal ? { x: a.x + i * dir, y: a.y } : { x: a.x, y: a.y + i * dir });
  return out;
}

/** Arrastrar con Construir: un plano en cada casilla libre de la línea (nunca cancela). */
export function buildLine(w: World, kind: BuildKind, a: Point, b: Point): void {
  for (const p of wallLine(a, b))
    if (!pendingAt(w, p.x, p.y) && canPlace(w, kind, p))
      issue(w, { type: 'placeBlueprint', kind, x: p.x, y: p.y });
}
