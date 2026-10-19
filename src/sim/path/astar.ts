import { isWalkable } from '../map/grid';
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

/**
 * Camino de casillas desde la siguiente a `from` hasta `to` (incluida).
 * `[]` si ya está en el destino; `null` si no hay camino.
 * 8 direcciones; las diagonales no cortan esquinas de muros.
 */
export function findPath(g: Grid, from: Point, to: Point): Point[] | null {
  if (!isWalkable(g, to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];

  const w = g.width;
  const start = from.y * w + from.x;
  const goal = to.y * w + to.x;
  const cost = new Float64Array(w * g.height).fill(Infinity);
  const came = new Int32Array(w * g.height).fill(-1);
  const closed = new Uint8Array(w * g.height);
  const open = new Heap();
  let seq = 0;

  cost[start] = 0;
  open.push({ idx: start, f: octile(from.x, from.y, to.x, to.y), seq: seq++ });

  while (open.size > 0) {
    const { idx } = open.pop();
    if (closed[idx]) continue;
    if (idx === goal) return rebuild(came, goal, start, w);
    closed[idx] = 1;
    const x = idx % w;
    const y = (idx - x) / w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isWalkable(g, nx, ny)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && (!isWalkable(g, x + dx, y) || !isWalkable(g, x, y + dy))) continue;
      const n = ny * w + nx;
      if (closed[n]) continue;
      const c = cost[idx]! + (diagonal ? SQRT2 : 1);
      if (c < cost[n]!) {
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
