import type { BuildingKind, GarmentKind, Terrain } from '../sim/types';

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

/**
 * Los muebles (A2): cada letra de los dibujos de `props.ts` y su color. Misma luz que el mapa:
 * arriba de cada mueble, más claro; su cara, más oscura.
 */
export const PROP_COLORS: Record<string, number> = {
  k: 0x1b1a1f, // el borde
  // Madera, de clara a oscura.
  v: 0xa8733e,
  w: 0x8a6236,
  W: 0x6b4a2e,
  q: 0x4a321c,
  // Blanco (neveras, botiquines, camas de hospital) y acero.
  i: 0xeef3f5,
  I: 0xccd5da,
  j: 0x9aa4aa,
  J: 0x6f7a80,
  // Metal (taquillas, cisternas).
  g: 0xa9b0b8,
  G: 0x5f6b78,
  h: 0x3e4650,
  // Cama: almohada y manta.
  p: 0xe8e6e3,
  P: 0xc9c6c1,
  n: 0x6f8fb6,
  b: 0x4f6f96,
  B: 0x3e5878,
  r: 0xc0392b,
  R: 0x8a2a20,
  // Mostradores y fregaderos.
  l: 0xc2b8a3,
  L: 0x8a7a68,
  d: 0x6a5c4c,
  // Cartón, y lo de las estanterías: rojo, amarillo, azul y verde.
  c: 0xc49a62,
  C: 0x9a7444,
  u: 0xe0c050,
  U: 0xb08f30,
  x: 0xd9534f,
  X: 0xa03a36,
  m: 0x6a8ac0,
  M: 0x4a6a9a,
  z: 0x5aa05a,
  Z: 0x3e7a3e,
  // Bolsas.
  O: 0x6b7040,
  Q: 0x4f5330,
  // Agua (y la pantalla del surtidor).
  a: 0x4a90c8,
  A: 0x9cc8e8,
  o: 0x2f6a9a,
  // Piedras y fuego.
  s: 0x8f8f8f,
  S: 0x6a6a6a,
  t: 0x4f4f4f,
  f: 0xff8c1a,
  F: 0xffd24a,
  y: 0xfff1a8,
  e: 0xe05a10,
  // Sangre seca bajo los cuerpos (A3).
  Y: 0x4e1414,
  V: 0x6e1c1c,
  // El huerto (V1): tierra labrada (seca, de clara a oscura; mojada, más oscura), hojas y frutos.
  D: 0x8a6a44,
  E: 0x6a4e30,
  H: 0x4a3420,
  N: 0x33240f,
  K: 0x9ccf5c,
  T: 0xe07a2a,
};
/** V1: lo sembrado que lleva un día sin agua se ve mustio. */
export const WILT_TINT = 0xd8c27a;

/** Personas y zombis (A3): tonos de piel y de pelo, ojos, sangre, zapatos y la ropa interior. */
export const SKIN_TONES = [0xf0c8a0, 0xe0b48c, 0xc89068, 0x9a6a48, 0x6e4a32];
export const HAIR_COLORS = [0x1e1a18, 0x3a2a1e, 0x5a3a22, 0x8a6a3a, 0xc9a040, 0xa0482a, 0x9a9a9a];
export const EYES = 0x1b1a1f;
/** La piel de un zombi: la de quien fue, tirando a este verde. */
export const ZOMBIE_SKIN = 0x7f9a62;
export const ZOMBIE_EYES = 0xc23a2a;
export const BLOOD = 0x8a2420;
export const SHOES = 0x2a2420;
export const UNDERWEAR = 0x6a6a70;
/** Las armas en la mano (A5): mango de madera, metal y la palanca. */
export const WEAPON_WOOD = 0x7a5230;
export const WEAPON_METAL = 0xb8c0c8;
export const CROWBAR = 0x8a3a30;
/** Los colores de cada prenda (H5b): cada una saca el suyo de su número. */
export const GARMENT_COLORS: Record<GarmentKind, readonly number[]> = {
  tshirt: [0xc8ccd0, 0x3f6aa0, 0xa0522d, 0x6b8e5a, 0x8a3a3a, 0xd9c46a, 0x2a2a2e],
  longSleeve: [0x5a6a7a, 0x7a4a5a, 0x4a6a4a, 0xb0a890],
  shirt: [0x9ab0c8, 0xc8b8a0, 0x8a4040, 0x5a7a5a],
  hoodie: [0x6a6a70, 0x2a3a5a, 0x5a2a2a, 0x3a4a3a],
  sweater: [0x7a6a5a, 0x4a5a7a, 0x8a7a4a, 0x5a4a6a],
  denimJacket: [0x4a6a9a],
  leatherJacket: [0x3a2a22],
  coat: [0x5a4a3a, 0x3a3e44, 0x4a5040],
  vest: [0x5a5a40, 0x3a3a3a],
  tracksuit: [0x2a4a8a, 0x8a2a2a, 0x2a2a2a],
  jeans: [0x3e5a8a, 0x2e4a7a, 0x4a6a9a],
  workPants: [0x7a6a4a, 0x5a5040],
  chaps: [0x5a3a22],
  cap: [0xc0392b, 0x2a4a8a, 0x2a2a2a, 0x6b8e5a],
  beanie: [0x3a3a3a, 0x8a3a3a, 0x4a5a7a],
  helmet: [0x5a6040, 0x6a6e74],
};

export const SURVIVOR_COLOR = 0xf2c641;
export const SURVIVOR_OUTLINE = 0x111111;
export const STRANGER_COLOR = 0x9a9a9a;
export const BACKGROUND = 0x111111;
export const SELECTION_RING = 0xffffff;
/** Las espadas sobre la cabeza de quien está en modo combate (H4e). */
export const DRAFT_MARK = 0xd9534f;
/** Lo que queda de cada color en plena noche (A4: la noche multiplica, así que oscurece y azulea). */
export const NIGHT_TINT = 0x141c3c;
/** Lo que queda de cada color junto a la hoguera de noche: el rojo entero, menos azul (cálido). */
export const FIRE_TINT = 0xffc890;
export const DESIGNATION = 0xe08a2c;
export const HOUSE_SELECTED = 0xffffff;

// H4a: planos y barras.
/** El destello de los relámpagos (A4). */
export const FLASH_COLOR = 0xe8f0ff;
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
export const CORPSE_COLOR = 0x3b4436;
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
export const LABEL_COLOR = '#f2ead8';
export const LABEL_SHADOW = '#1a1a1a';

/** El mapa del mundo (H5c2): el terreno de cada hexágono, la niebla, carreteras y pueblos. */
export const ATLAS_TERRAIN: Record<Terrain, number> = {
  field: 0x6f8a4a,
  forest: 0x2f4f2a,
  hills: 0x8a7a5a,
  water: 0x3a6ea5,
};
/** El mapa del mundo con relieve (A6): árboles, olas, casitas, la niebla y las carreteras. */
export const ATLAS_ART = {
  outline: 0x1b1a1f,
  canopy: [0x4f7f45, 0x3a6535, 0x24441f] as const,
  trunk: 0x4a3320,
  waveLight: 0x8cc0e8,
  roofs: [0xa8433a, 0x7a4a32, 0x5a5e66] as const,
  wall: 0xd8d0c0,
  door: 0x5a3a22,
  fog: 0x1e1e22,
  roadEdge: 0x6e6450,
} as const;
export const ATLAS_ROAD = 0xcfc4a8;
export const ATLAS_HOVER = 0xffffff;
export const ATLAS_GROUP = 0xf2c641;
export const ATLAS_SPECIAL = '#ffd34d';
/** La ruta que se planea y sus paradas. */
export const ATLAS_ROUTE = 0xffffff;
export const ATLAS_STOP = 0xf28c28;

/** H6c: el camino del colono elegido en el modo depuración. */
export const DEBUG_PATH = 0x66ff99;

/** V3: los tonos de la hierba en cada estación (el verano, los de siempre; en invierno, nieve). */
export const GRASS_BY_SEASON = {
  summer: MAP_ART.grass,
  autumn: [0x6b6236, 0x7a6d3a, 0x5a5230, 0x8a7a42],
  winter: [0xd5dbe0, 0xe6eaee, 0xc3cad1, 0xf1f3f5],
  spring: [0x4f6a38, 0x5a7840, 0x46602f, 0x6a8a4a],
} as const;
