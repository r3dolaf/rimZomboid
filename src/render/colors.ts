import type { BuildingKind, Terrain } from '../sim/types';

/**
 * El mapa con textura (A1). La luz viene de arriba a la izquierda: los bordes de arriba y de la
 * izquierda, más claros; la cara de los muros y las sombras, abajo y a la derecha.
 */
export const MAP_ART = {
  grass: [0x4a5d3a, 0x526740, 0x425433, 0x5c7247], // el de siempre, uno más claro, uno más oscuro…
  tuft: 0x6a8250,
  tuftShade: 0x3a4a2d,
  flowers: [0xd9c46a, 0xc9d4e0, 0xc77a6a],
  dirt: 0x6b5a40,
  roots: 0x33402a, // al pie de los árboles
  asphalt: [0x48484c, 0x4f4f53, 0x414145],
  crack: 0x353538,
  lane: 0xb8a250, // la raya del centro, gastada
  shoulder: 0x5f5d58, // el borde de la carretera
  wood: [0x8a6a46, 0x84643f, 0x8f6e48], // el suelo de las casas y de la base
  woodGrain: 0x7a5c3b,
  woodSeam: 0x5e452b,
  rubble: [0x6e6a64, 0x666259, 0x75716a],
  stone: 0x8f8a82,
  stoneShade: 0x4f4c47,
  // Muros de ladrillo: arriba, los bordes y la cara.
  wallTop: [0x6f6a74, 0x68636d],
  wallLight: 0x8d8893,
  wallDark: 0x4b4751,
  wallFace: 0x4a4650,
  wallFaceTop: 0x3a3640,
  wallMortar: 0x3e3a44,
  // Muros de madera (H4a).
  woodWallTop: [0x7a5634, 0x72502f],
  woodWallLight: 0x93693f,
  woodWallDark: 0x4f3720,
  woodWallFace: 0x5a3d22,
  woodWallLine: 0x45301b,
  // Ventanas y puertas.
  frame: 0x2b2f36,
  glass: 0x7fa9bf,
  glassShine: 0xc8e2ee,
  brokenGlass: 0x1c2a30,
  shard: 0x9cc7d9,
  drape: 0x8a5a78, // cortinas (H4d)
  drapeFold: 0x4e3446,
  board: 0x8a6236, // tablas de tapiar
  boardSeam: 0x4a321c,
  doorFrame: 0x3a2618,
  door: 0x7a4e2a,
  doorLine: 0x61401f,
  knob: 0xd9c46a,
  lockBar: 0x2a1a0c,
  // Sombras (negro con transparencia).
  wallShadow: 0.3,
  // Árboles: la copa de lo más claro a lo más oscuro, con tres verdes, el borde y el tronco.
  canopies: [
    [0x5f8f45, 0x467535, 0x345c2a, 0x25441f],
    [0x4f7f45, 0x3a6535, 0x2a4f2a, 0x1d3a1f],
    [0x7a8f45, 0x5f7535, 0x4a5c2a, 0x34441f],
  ],
  canopyEdge: 0x16261a,
  trunk: 0x3a2818,
  trunkLight: 0x5a3f26,
  treeShadow: 0.28,
} as const;

export const SURVIVOR_COLOR = 0xf2c641;
export const SURVIVOR_OUTLINE = 0x111111;
export const STRANGER_COLOR = 0x9a9a9a;
export const BACKGROUND = 0x111111;
export const SELECTION_RING = 0xffffff;
/** Las espadas sobre la cabeza de quien está en modo combate (H4e). */
export const DRAFT_MARK = 0xd9534f;
export const BED_COLOR = 0x4f6f96;
export const PILLOW_COLOR = 0xe8e6e3;
/** Cama de hospital (H5): blanca con una cruz roja. */
export const MEDICAL_BED_COLOR = 0xd8dde3;
export const MEDICAL_CROSS = 0xd9534f;
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
// Agua (H5b): el barreño de madera, los fregaderos y las cisternas, y el agua.
export const TUB_COLOR = 0x7a5230;
export const WATER_COLOR = 0x4a90c8;
export const SINK_COLOR = 0xc8ccd0;
export const CISTERN_COLOR = 0x5a6e7a;
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

// H4b: zombis, derribados y lo dañado.
export const ZOMBIE_COLOR = 0x86a072;
export const ZOMBIE_OUTLINE = 0x1d2a18;
export const ZOMBIE_HURT = 0xd9534f;
export const DOWNED_RING = 0xd9534f;
export const DAMAGE_BAR = 0xe0a030;

// H4d: cuerpos.
export const CORPSE_OUTLINE = 0x161b14;
export const CORPSE_STAIN = 0x4a2a24;

// H4f: suelo según el tipo de edificio, surtidores y letreros.
export type FloorStyle = 'tiles' | 'concrete' | 'planks';
export const FLOOR_COLORS: Record<FloorStyle, number> = {
  tiles: 0xc9c4b6, // baldosa clara
  concrete: 0x8c8b86,
  planks: 0x9a7346,
};
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

/** El mapa del mundo (H5c2): el terreno de cada hexágono, la niebla, carreteras y pueblos. */
export const ATLAS_TERRAIN: Record<Terrain, number> = {
  field: 0x6f8a4a,
  forest: 0x2f4f2a,
  hills: 0x8a7a5a,
  water: 0x3a6ea5,
};
export const ATLAS_FOG = 0x1e1e22;
export const ATLAS_EDGE = 0x000000;
export const ATLAS_ROAD = 0xcfc4a8;
export const ATLAS_TOWN = 0xb8b0a0;
export const ATLAS_HOVER = 0xffffff;
export const ATLAS_GROUP = 0xf2c641;
export const ATLAS_SPECIAL = '#ffd34d';
/** La ruta que se planea y sus paradas. */
export const ATLAS_ROUTE = 0xffffff;
export const ATLAS_STOP = 0xf28c28;

/** H6c: el camino del colono elegido en el modo depuración. */
export const DEBUG_PATH = 0x66ff99;
