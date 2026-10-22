import { Tile, type BuildingKind } from '../sim/types';

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
  [Tile.BrokenWindow]: 0x3c5560,
  [Tile.BrokenDoor]: 0x4a3420,
  [Tile.Rubble]: 0x6e6a64,
  [Tile.CurtainedWindow]: 0x6a4a5e, // H4d: cortinas corridas
  [Tile.LockedDoor]: 0x5e3a1e, // H4d: puerta atrancada
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
export const CONTAINER_COLORS = {
  fridge: 0xd8e4ea,
  wardrobe: 0x6b4a2e,
  shelf: 0x9a7b4f,
  corpse: 0x3b4436, // H4d: cuerpo de zombi
  // H4f
  counter: 0x8a7a68,
  locker: 0x5f6b78,
  crate: 0xa3824f,
  medicine: 0xe6eef0,
} as const;
export const CONTAINER_EDGE = 0x1a1a1a;
export const DESIGNATION = 0xe08a2c;
export const HOUSE_SELECTED = 0xffffff;

// H4a: madera, muebles, montones, planos y marcas de talar.
export const PLANK_COLOR = 0x8a6236;
export const PLANK_SEAM = 0x4a321c;
export const TABLE_COLOR = 0x8b5a2b;
export const TABLE_EDGE = 0x4a2f16;
export const CAMPFIRE_STONE = 0x6a6a6a;
export const CAMPFIRE_FLAME = 0xff8c1a;
export const CAMPFIRE_CORE = 0xffd24a;
export const FIRE_GLOW = 0xff9a3c;
export const PILE_OTHER = 0xc8c8c8;
export const BLUEPRINT = 0x7fc3ff;
export const BLUEPRINT_BAD = 0xd9534f;
export const BAR_BACK = 0x111111;
export const BAR_WOOD = 0xc08a4a;
export const BAR_PROGRESS = 0x8fd694;

/** Color de Phaser (0xRRGGBB) en CSS, para pintar en un lienzo. */
export const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

// H4b: zombis, derribados, lo roto y lo dañado.
export const ZOMBIE_COLOR = 0x86a072;
export const ZOMBIE_OUTLINE = 0x1d2a18;
export const ZOMBIE_HURT = 0xd9534f;
export const DOWNED_RING = 0xd9534f;
export const DAMAGE_BAR = 0xe0a030;
export const RUBBLE_BITS = 0x8f8a82;
export const BROKEN_GLASS = 0x1c2a30;

// H4d: cortinas, puertas atrancadas y cuerpos.
export const CURTAIN_DRAPE = 0x8a5a78;
export const CURTAIN_FOLD = 0x4e3446;
export const LOCK_BAR = 0x2a1a0c;
export const CORPSE_OUTLINE = 0x161b14;
export const CORPSE_STAIN = 0x4a2a24;

// H4f: suelo según el tipo de edificio, surtidores y letreros.
export type FloorStyle = 'tiles' | 'concrete' | 'planks';
export const FLOOR_COLORS: Record<FloorStyle, number> = {
  tiles: 0xc9c4b6, // baldosa clara
  concrete: 0x8c8b86,
  planks: 0x9a7346,
};
export const FLOOR_SEAM = 0x6e5232; // juntas de las tablas y de las baldosas
/** El suelo de cada tipo de edificio; `null`: el de siempre. */
export function floorOf(kind: BuildingKind): FloorStyle | null {
  switch (kind) {
    case 'supermarket':
    case 'pharmacy':
    case 'hardware':
    case 'clothes':
    case 'gas':
      return 'tiles';
    case 'police':
    case 'warehouse':
      return 'concrete';
    case 'farm':
      return 'planks';
    default:
      return null;
  }
}
export const PUMP_BODY = 0xb8b8b0;
export const PUMP_TOP = 0xc0392b;
export const LABEL_COLOR = '#f2ead8';
export const LABEL_SHADOW = '#1a1a1a';
export const CRATE_CROSS = 0x5e4422;
export const LOCKER_LINE = 0x3e4650;
export const MEDICINE_CROSS = 0xc0392b;
