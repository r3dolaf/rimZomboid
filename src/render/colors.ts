import { Tile } from '../sim/types';

/** Colores provisionales: primero que sea divertido, luego bonito. */
export const TILE_COLORS: Record<Tile, number> = {
  [Tile.Grass]: 0x4a5d3a,
  [Tile.Floor]: 0xa08a6a,
  [Tile.Road]: 0x5a5a5a,
  [Tile.Wall]: 0x2e2e33,
  [Tile.Door]: 0x7a4e2a,
  [Tile.Window]: 0x9cc7d9,
  [Tile.Tree]: 0x23361f,
};

export const SURVIVOR_COLOR = 0xf2c641;
export const SURVIVOR_OUTLINE = 0x111111;
export const BACKGROUND = 0x111111;
