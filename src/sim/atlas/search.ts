// El camino más barato entre dos hexágonos (A*), con el coste de entrar en cada uno.
import { hexDistance, neighbors, type HexSize } from './hex';

/**
 * Los hexágonos de `from` a `to` (los dos incluidos) por el camino más barato; `cost(i)` es lo que
 * cuesta entrar en `i` (`Infinity`: no se puede) y `minCost`, el menor coste posible (para estimar).
 * `null` si no hay camino.
 */
export function cheapestPath(
  size: HexSize,
  from: number,
  to: number,
  cost: (i: number) => number,
  minCost: number,
): number[] | null {
  if (from === to) return [from];
  const n = size.width * size.height;
  const g = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  // Montón binario de [f, índice].
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p]![0] <= heap[k]![0]) break;
      [heap[p], heap[k]] = [heap[k]!, heap[p]!];
      k = p;
    }
  };
  const pop = (): number => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k]!, heap[m]!];
        k = m;
      }
    }
    return top[1];
  };
  g[from] = 0;
  push(hexDistance(size, from, to) * minCost, from);
  while (heap.length > 0) {
    const i = pop();
    if (closed[i]) continue;
    if (i === to) break;
    closed[i] = 1;
    for (const j of neighbors(size, i)) {
      if (closed[j]) continue;
      const c = cost(j);
      if (!Number.isFinite(c)) continue;
      const ng = g[i]! + c;
      if (ng < g[j]!) {
        g[j] = ng;
        prev[j] = i;
        push(ng + hexDistance(size, j, to) * minCost, j);
      }
    }
  }
  if (!Number.isFinite(g[to]!)) return null;
  const path = [to];
  for (let i = prev[to]!; i !== -1; i = prev[i]!) path.push(i);
  return path.reverse();
}
