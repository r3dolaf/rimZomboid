// Generar el mapa del mundo (spec H5c2 §1): manchas de bosque y colinas, ríos de borde a borde, la
// base en el centro, pueblos separados y carreteras que los unen (con puentes al cruzar el agua).
import {
  ATLAS_BLOB,
  ATLAS_FOREST,
  ATLAS_HILLS,
  ATLAS_RIVERS,
  ATLAS_SALT,
  ATLAS_SIZE,
  ATLAS_TOWNS,
  ROAD_BUILD_COST,
  TOWN_MIN_DIST,
} from '../balance';
import { createRng, nextFloat, nextInt, pick, type RngState } from '../rng';
import type { Atlas, Terrain } from '../types';
import { hexDistance, hexesWithin, hexIndex, hexOf, neighbors, type HexSize } from './hex';
import { cheapestPath } from './search';

/** Manchas de `t` hasta cubrir `share` del mundo: paseos al azar desde un hexágono cualquiera. */
function blobs(size: HexSize, terrain: Terrain[], t: Terrain, share: number, rng: RngState): void {
  const target = Math.round(terrain.length * share);
  let count = terrain.filter((x) => x === t).length;
  for (let guard = 0; count < target && guard < 10_000; guard++) {
    let i = nextInt(rng, 0, terrain.length - 1);
    for (let k = nextInt(rng, ATLAS_BLOB[0], ATLAS_BLOB[1]); k > 0 && count < target; k--) {
      if (terrain[i] !== t) {
        terrain[i] = t;
        count++;
      }
      i = pick(rng, neighbors(size, i));
    }
  }
}

/** Un río de un borde al de enfrente (de arriba abajo o de izquierda a derecha), serpenteando. */
function river(size: HexSize, terrain: Terrain[], rng: RngState): void {
  const down = nextFloat(rng) < 0.5;
  let col = down ? nextInt(rng, 2, size.width - 3) : 0;
  let row = down ? 0 : nextInt(rng, 2, size.height - 3);
  for (let guard = 0; guard < size.width * size.height; guard++) {
    const i = hexIndex(size, col, row);
    if (i < 0) return;
    terrain[i] = 'water';
    if (down) {
      // Abajo, a la izquierda o a la derecha (sin salirse).
      row++;
      if (row % 2 === 0) col -= nextFloat(rng) < 0.5 ? 1 : 0;
      else col += nextFloat(rng) < 0.5 ? 1 : 0;
      col = Math.max(0, Math.min(size.width - 1, col));
    } else {
      col++;
      row += nextFloat(rng) < 0.25 ? 1 : nextFloat(rng) < 0.33 ? -1 : 0;
      row = Math.max(0, Math.min(size.height - 1, row));
    }
  }
}

/** El mundo de la semilla `seed` (todo con niebla). */
export function generateAtlas(seed: number): Atlas {
  const rng = createRng((seed ^ ATLAS_SALT) >>> 0);
  const size = { width: ATLAS_SIZE.width, height: ATLAS_SIZE.height };
  const n = size.width * size.height;
  const terrain: Terrain[] = new Array<Terrain>(n).fill('field');
  blobs(size, terrain, 'forest', ATLAS_FOREST, rng);
  blobs(size, terrain, 'hills', ATLAS_HILLS, rng);
  for (let k = nextInt(rng, ATLAS_RIVERS[0], ATLAS_RIVERS[1]); k > 0; k--)
    river(size, terrain, rng);
  // La base, en el centro, en campo y sin agua alrededor.
  const base = hexIndex(size, size.width >> 1, size.height >> 1);
  for (const i of hexesWithin(size, base, 1)) if (terrain[i] === 'water') terrain[i] = 'field';
  terrain[base] = 'field';
  const town = new Array<number>(n).fill(0);
  town[base] = 1;
  // Los pueblos: separados entre sí y de la base, fuera del agua y no pegados al borde.
  const towns: number[] = [];
  const wanted = nextInt(rng, ATLAS_TOWNS[0], ATLAS_TOWNS[1]);
  for (let guard = 0; towns.length < wanted && guard < 5000; guard++) {
    const i = nextInt(rng, 0, n - 1);
    const { col, row } = hexOf(size, i);
    if (col < 2 || row < 2 || col > size.width - 3 || row > size.height - 3) continue;
    if (terrain[i] === 'water') continue;
    if ([base, ...towns].some((t) => hexDistance(size, t, i) < TOWN_MIN_DIST)) continue;
    towns.push(i);
    town[i] = 1;
    terrain[i] = 'field';
  }
  // Las carreteras: de la base a cada pueblo y de cada pueblo al más cercano.
  const road = new Array<number>(n).fill(0);
  const cost = (i: number) => (road[i] === 1 ? ROAD_BUILD_COST.road : ROAD_BUILD_COST[terrain[i]!]);
  const lay = (a: number, b: number) => {
    const path = cheapestPath(size, a, b, cost, ROAD_BUILD_COST.road);
    if (path) for (const i of path) if (i !== base) road[i] = 1;
  };
  for (const t of towns) lay(base, t);
  for (const t of towns) {
    const others = towns.filter((u) => u !== t);
    if (others.length === 0) continue;
    const near = others.reduce((a, b) =>
      hexDistance(size, t, a) <= hexDistance(size, t, b) ? a : b,
    );
    lay(t, near);
  }
  return { ...size, terrain, road, town, seen: new Array<number>(n).fill(0), base };
}
