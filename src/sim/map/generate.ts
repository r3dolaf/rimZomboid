// Generación del mapa (spec H4f §2–3): el trazado (carreteras, pueblo, campo y dónde va cada
// edificio), cada edificio con su receta y sus muebles, y la comprobación de que todo se alcanza.
import { findPath } from '../path/astar';
import type { RngState } from '../rng';
import type { Building, ContainerKind, Grid, Point, Rect } from '../types';
import { planMap } from './layout';
import { buildBuilding, furnish } from './recipes';

export interface GeneratedMap {
  grid: Grid;
  base: Building;
  /** Todos los edificios que se saquean (de cualquier tipo), con ids desde 1. */
  houses: Building[];
  /** Dónde está el pueblo (H4f). */
  town: Rect;
  /** Muebles de saqueo por colocar como contenedores. */
  furniture: { houseId: number; pos: Point; kind: ContainerKind }[];
}

const MAX_RETRIES = 20;

/** Genera el mapa. Si sale inválido, vuelve a intentarlo con el azar ya avanzado. */
export function generateMap(rng: RngState): GeneratedMap {
  for (let i = 0; i <= MAX_RETRIES; i++) {
    const m = tryGenerate(rng);
    if (validate(m)) return m;
  }
  throw new Error('generateMap: no se pudo generar un mapa válido');
}

function tryGenerate(rng: RngState): GeneratedMap {
  const { grid, town, lots } = planMap(rng);
  const baseLot = lots.find((l) => l.kind === 'base')!;
  const base = buildBuilding(grid, rng, 0, baseLot);
  const houses = lots
    .filter((l) => l !== baseLot)
    .map((lot, i) => buildBuilding(grid, rng, i + 1, lot));
  const furniture = houses.flatMap((h) =>
    furnish(grid, rng, h).map((f) => ({ houseId: h.id, ...f })),
  );
  return { grid, base, houses, town, furniture };
}

/** Todo edificio se alcanza andando desde la puerta de la base. */
function validate(m: GeneratedMap): boolean {
  return m.houses.every((h) => findPath(m.grid, m.base.door, h.door) !== null);
}
