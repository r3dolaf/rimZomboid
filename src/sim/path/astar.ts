import { isWalkable } from '../map/grid';
import { regionCache } from '../map/regionCache';
import type { Grid, Point } from '../types';

const SQRT2 = Math.SQRT2;
const DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

interface Node {
  idx: number;
  f: number;
  seq: number; // desempate determinista: con igual f, sale primero el insertado antes
}

/** Montículo binario mínimo por (f, seq). */
class Heap {
  private items: Node[] = [];
  get size(): number {
    return this.items.length;
  }
  push(n: Node): void {
    const a = this.items;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(a[i]!, a[p]!)) break;
      [a[i], a[p]] = [a[p]!, a[i]!];
      i = p;
    }
  }
  pop(): Node {
    const a = this.items;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && less(a[l]!, a[m]!)) m = l;
        if (r < a.length && less(a[r]!, a[m]!)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m]!, a[i]!];
        i = m;
      }
    }
    return top;
  }
}

function less(a: Node, b: Node): boolean {
  return a.f < b.f || (a.f === b.f && a.seq < b.seq);
}

function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

// --- Regiones conectadas -------------------------------------------------------------
// Cada casilla transitable recibe el número de su región (por movimiento en 8 direcciones sin
// cortar esquinas, igual que A*). Si origen y destino están en regiones distintas, no hay camino
// y se sabe al momento sin explorar todo el mapa.

/** `setTile` ya la llama; solo hace falta si se tocan `grid.tiles` directamente. */
export function invalidateRegions(g: Grid): void {
  regionCache.delete(g);
}

/** Región de una casilla, o -1 si no es transitable o está fuera del mapa. */
export function regionOf(g: Grid, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= g.width || y >= g.height) return -1;
  return regions(g)[y * g.width + x]!;
}

function regions(g: Grid): Int32Array {
  let r = regionCache.get(g);
  if (r) return r;
  const w = g.width;
  r = new Int32Array(w * g.height).fill(-1);
  const stack: number[] = [];
  let next = 0;
  for (let i = 0; i < r.length; i++) {
    if (r[i] !== -1 || !isWalkable(g, i % w, Math.floor(i / w))) continue;
    r[i] = next;
    stack.push(i);
    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % w;
      const y = (idx - x) / w;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isWalkable(g, nx, ny)) continue;
        if (dx !== 0 && dy !== 0 && (!isWalkable(g, x + dx, y) || !isWalkable(g, x, y + dy)))
          continue;
        const n = ny * w + nx;
        if (r[n] !== -1) continue;
        r[n] = next;
        stack.push(n);
      }
    }
    next++;
  }
  regionCache.set(g, r);
  return r;
}

// --- Búferes reutilizados ----------------------------------------------------------------
// En vez de reservar y rellenar arrays en cada búsqueda, cada búsqueda tiene un sello: un valor
// de `cost`/`came`/`closed` solo vale si `stamp[i]` es el sello de la búsqueda actual.

let buf = {
  size: 0,
  stamp: new Uint32Array(0),
  cost: new Float64Array(0),
  came: new Int32Array(0),
  closed: new Uint32Array(0),
};
let search = 0;

function buffers(size: number) {
  if (buf.size !== size) {
    buf = {
      size,
      stamp: new Uint32Array(size),
      cost: new Float64Array(size),
      came: new Int32Array(size),
      closed: new Uint32Array(size),
    };
    search = 0;
  }
  search++;
  return buf;
}

/**
 * Camino de casillas desde la siguiente a `from` hasta `to` (incluida).
 * `[]` si ya está en el destino; `null` si no hay camino.
 * 8 direcciones; las diagonales no cortan esquinas de muros.
 */
export function findPath(g: Grid, from: Point, to: Point): Point[] | null {
  if (!isWalkable(g, to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];
  if (regionOf(g, from.x, from.y) !== regionOf(g, to.x, to.y)) return null;

  const w = g.width;
  const start = from.y * w + from.x;
  const goal = to.y * w + to.x;
  const { stamp, cost, came, closed } = buffers(w * g.height);
  const id = search;
  const costOf = (i: number) => (stamp[i] === id ? cost[i]! : Infinity);
  const open = new Heap();
  let seq = 0;

  stamp[start] = id;
  cost[start] = 0;
  open.push({ idx: start, f: octile(from.x, from.y, to.x, to.y), seq: seq++ });

  while (open.size > 0) {
    const { idx } = open.pop();
    if (closed[idx] === id) continue;
    if (idx === goal) return rebuild(came, goal, start, w);
    closed[idx] = id;
    const x = idx % w;
    const y = (idx - x) / w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isWalkable(g, nx, ny)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && (!isWalkable(g, x + dx, y) || !isWalkable(g, x, y + dy))) continue;
      const n = ny * w + nx;
      if (closed[n] === id) continue;
      const c = cost[idx]! + (diagonal ? SQRT2 : 1);
      if (c < costOf(n)) {
        stamp[n] = id;
        cost[n] = c;
        came[n] = idx;
        open.push({ idx: n, f: c + octile(nx, ny, to.x, to.y), seq: seq++ });
      }
    }
  }
  return null;
}

function rebuild(came: Int32Array, goal: number, start: number, w: number): Point[] {
  const path: Point[] = [];
  for (let i = goal; i !== start; i = came[i]!) path.push({ x: i % w, y: Math.floor(i / w) });
  return path.reverse();
}
