// Hexágonos del mapa del mundo (spec H5c2 §1): punta arriba, en filas; las impares, medio hexágono a
// la derecha. Cada hexágono es un índice `fila × ancho + columna`.
import type { MapSide, Point } from '../types';

export interface HexSize {
  width: number;
  height: number;
}

/** El índice de (columna, fila), o −1 si está fuera del mapa. */
export function hexIndex(size: HexSize, col: number, row: number): number {
  if (col < 0 || row < 0 || col >= size.width || row >= size.height) return -1;
  return row * size.width + col;
}

export function hexOf(size: HexSize, i: number): { col: number; row: number } {
  return { col: i % size.width, row: Math.floor(i / size.width) };
}

/** Los pasos a los seis vecinos desde una fila par y desde una impar. */
const EVEN: readonly [number, number][] = [
  [1, 0],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];
const ODD: readonly [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, 1],
];

/** Los vecinos dentro del mapa (6, o menos en los bordes). */
export function neighbors(size: HexSize, i: number): number[] {
  const { col, row } = hexOf(size, i);
  const out: number[] = [];
  for (const [dc, dr] of row % 2 === 0 ? EVEN : ODD) {
    const j = hexIndex(size, col + dc, row + dr);
    if (j >= 0) out.push(j);
  }
  return out;
}

/** Coordenadas cúbicas (para medir distancias). */
function cube(size: HexSize, i: number): [number, number, number] {
  const { col, row } = hexOf(size, i);
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  return [x, -x - z, z];
}

export function hexDistance(size: HexSize, a: number, b: number): number {
  const [ax, ay, az] = cube(size, a);
  const [bx, by, bz] = cube(size, b);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

/** El centro en el plano, con hexágonos de radio 1. */
export function hexCenter(size: HexSize, i: number): Point {
  const { col, row } = hexOf(size, i);
  return { x: Math.sqrt(3) * (col + 0.5 * (row & 1)), y: 1.5 * row };
}

/** Hacia qué lado (0 norte, 1 sur, 2 oeste, 3 este) queda `b` visto desde `a`. */
export function sideFrom(size: HexSize, a: number, b: number): MapSide {
  const p = hexCenter(size, a);
  const q = hexCenter(size, b);
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 3 : 2;
  return dy > 0 ? 1 : 0;
}

/** Los hexágonos a `r` o menos de `center`, dentro del mapa. */
export function hexesWithin(size: HexSize, center: number, r: number): number[] {
  const { col, row } = hexOf(size, center);
  const out: number[] = [];
  for (let y = row - r; y <= row + r; y++)
    for (let x = col - r - 1; x <= col + r + 1; x++) {
      const j = hexIndex(size, x, y);
      if (j >= 0 && hexDistance(size, center, j) <= r) out.push(j);
    }
  return out;
}
