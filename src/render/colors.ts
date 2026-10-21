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
  [Tile.WoodWall]: 0x6b4a2a,
  [Tile.BoardedWindow]: 0x7a5a36,
};

export const SURVIVOR_COLOR = 0xf2c641;
export const SURVIVOR_OUTLINE = 0x111111;
export const STRANGER_COLOR = 0x9a9a9a;
export const BACKGROUND = 0x111111;
export const SELECTION_RING = 0xffffff;
export const BED_COLOR = 0x4f6f96;
export const PILLOW_COLOR = 0xe8e6e3;
export const STORAGE_COLOR = 0x8a6a3a;
export const STORAGE_EDGE = 0x5a4424;
export const NIGHT_COLOR = 0x0a1030;
export const CONTAINER_COLORS = { fridge: 0xd8e4ea, wardrobe: 0x6b4a2e, shelf: 0x9a7b4f } as const;
export const CONTAINER_EDGE = 0x1a1a1a;
export const DESIGNATION = 0xe08a2c;
export const HOUSE_SELECTED = 0xffffff;
