// Ropa (spec H5b §2–§5): prendas, capas, protección y lo que vale una prenda para alguien.
import {
  GARMENTS,
  HIT_WEIGHTS,
  HOLE_CHANCE,
  PAD_BONUS,
  PATCH_FACTOR,
  PROTECTION_MAX,
  DIRTY_HOURS,
  START_EXTRA_CHANCE,
  START_EXTRAS,
  ZOMBIE_CLOTHES,
  type GarmentSpec,
} from './balance';
import type { Inventory } from './items';
import { logEvent } from './log';
import { nextFloat, nextInt, pick, weightedPick, type RngState } from './rng';
import type {
  BodyPart,
  Garment,
  GarmentKind,
  Layer,
  Piece,
  Survivor,
  World,
  WoundKind,
} from './types';

/** Todas las prendas, en el orden del catálogo. */
export const GARMENT_KINDS = Object.keys(GARMENTS) as GarmentKind[];

const LAYER_RANK: Record<Layer, number> = { inner: 0, middle: 1, outer: 2 };

/** Lo que lleva la cuenta de las piezas (el mundo, o el contador mientras se crea). */
export type PieceCounter = Pick<World, 'nextPieceId' | 'pieceLog'>;

/** Una prenda nueva, limpia y sin agujeros (se apunta en las cuentas de las piezas). */
export function newGarment(w: PieceCounter, kind: GarmentKind): Garment {
  w.pieceLog.made++;
  return {
    id: w.nextPieceId++,
    kind,
    holes: [],
    patches: {},
    pads: {},
    dirtHours: 0,
    bloody: false,
    from: null,
  };
}

/** Las zonas que cubre. */
export const coversOf = (g: Garment): readonly BodyPart[] => GARMENTS[g.kind].covers;

/** ¿Chocan? Misma capa y alguna zona en común: no se llevan a la vez. */
export function clashes(a: Garment, b: Garment): boolean {
  const A: GarmentSpec = GARMENTS[a.kind];
  const B: GarmentSpec = GARMENTS[b.kind];
  return a.id !== b.id && A.layer === B.layer && A.covers.some((z) => B.covers.includes(z));
}

/** ¿Se la puede poner encima de lo que lleva sin quitarse nada? */
export const wearable = (worn: readonly Garment[], g: Garment): boolean =>
  worn.every((x) => !clashes(x, g));

/**
 * Probabilidad de que pare un golpe en esa zona (H5b §3): la suya (arañazos y cortes, o
 * mordiscos); con agujero, 0; con parche, por lo que conserve el material; con refuerzo, más.
 */
export function protection(g: Garment, part: BodyPart, kind: WoundKind): number {
  const spec: GarmentSpec = GARMENTS[g.kind];
  if (!spec.covers.includes(part) || g.holes.includes(part)) return 0;
  const bite = kind === 'bite';
  let p: number = bite ? spec.bite : spec.scratch;
  const patch = g.patches[part];
  if (patch) p *= PATCH_FACTOR[patch];
  const pad = g.pads[part];
  if (pad) p += PAD_BONUS[pad] * (bite ? 0.5 : 1);
  return Math.min(PROTECTION_MAX, p);
}

/** Lo que cubre esa zona, de fuera a dentro. */
export function layersOn(worn: readonly Garment[], part: BodyPart): Garment[] {
  return worn
    .filter((g) => coversOf(g).includes(part))
    .sort((a, b) => LAYER_RANK[GARMENTS[b.kind].layer] - LAYER_RANK[GARMENTS[a.kind].layer]);
}

/** Probabilidad de que lo puesto pare un golpe de ese tipo en esa zona (capa a capa). */
export function zoneBlock(worn: readonly Garment[], part: BodyPart, kind: WoundKind): number {
  let through = 1;
  for (const g of worn) through *= 1 - protection(g, part, kind);
  return 1 - through;
}

const ZONES = Object.keys(HIT_WEIGHTS) as BodyPart[];

/** Lo que protege lo puesto: lo que para cada zona (arañazos y mordiscos) por sus golpes. */
export function protectionScore(worn: readonly Garment[]): number {
  let total = 0;
  for (const z of ZONES)
    total += (HIT_WEIGHTS[z] * (zoneBlock(worn, z, 'scratch') + zoneBlock(worn, z, 'bite'))) / 2;
  return total;
}

/** Lo que vale para alguien llevar eso (H5b §4): su protección. */
export function outfitScore(_s: Survivor, worn: readonly Garment[]): number {
  return protectionScore(worn);
}

/** Lo que vale una prenda sola para alguien (para comparar con lo que lleva en su hueco). */
export function garmentValue(s: Survivor, g: Garment): number {
  return outfitScore(s, [g]);
}

/** Destrozada: con agujeros en todas las zonas que cubre. */
export const destroyed = (g: Garment): boolean => coversOf(g).every((z) => g.holes.includes(z));

/**
 * Un golpe de zombi que acierta en `part` (H5b §3): de fuera a dentro, cada prenda sin agujero ahí
 * puede pararlo con su protección (azar de los zombis). Si lo para, no hay herida (`true`) y la
 * prenda puede quedar agujereada ahí (y pierde el parche). Si no lo para nadie, las prendas de esa
 * zona se manchan de sangre (`false`: hay herida).
 */
export function blockHit(w: World, s: Survivor, part: BodyPart, kind: WoundKind): boolean {
  const rng = w.zombieRng;
  const layers = layersOn(s.worn, part);
  for (const g of layers) {
    const p = protection(g, part, kind);
    if (p <= 0 || nextFloat(rng) >= p) continue;
    if (nextFloat(rng) < HOLE_CHANCE[kind]) {
      g.holes.push(part);
      delete g.patches[part];
      if (w.survivors.includes(s))
        logEvent(w, { kind: 'clothesTorn', survivorId: s.id, garment: g.kind, part });
    }
    return true;
  }
  for (const g of layers) g.bloody = true;
  return false;
}

/** La ropa del principio (H5b §2): camiseta, vaqueros o chándal y, la mitad, algo más. */
export function starterClothes(w: PieceCounter, rng: RngState): Garment[] {
  const worn = [
    newGarment(w, 'tshirt'),
    newGarment(w, nextFloat(rng) < 0.5 ? 'jeans' : 'tracksuit'),
  ];
  if (nextFloat(rng) < START_EXTRA_CHANCE) worn.push(newGarment(w, pick(rng, START_EXTRAS)));
  return worn;
}

/**
 * La ropa de un zombi (H5b §7), con el azar de los zombis: camiseta o camisa, pantalón y, a veces,
 * chaqueta y gorra; sucia, con sangre y con 0–2 agujeros cada una.
 */
export function zombieClothes(w: World): Garment[] {
  const rng = w.zombieRng;
  const z = ZOMBIE_CLOTHES;
  const kinds: GarmentKind[] = [weightedPick(rng, { ...z.top }), weightedPick(rng, { ...z.legs })];
  if (nextFloat(rng) < z.jacketChance) kinds.push(weightedPick(rng, { ...z.jacket }));
  if (nextFloat(rng) < z.hatChance) kinds.push(weightedPick(rng, { ...z.hat }));
  return kinds.map((kind) => {
    const g = newGarment(w, kind);
    g.dirtHours = DIRTY_HOURS;
    g.bloody = true;
    g.from = 'zombie';
    const zones = [...coversOf(g)];
    const n = nextInt(rng, 0, Math.min(z.maxHoles, zones.length));
    for (let i = 0; i < n; i++)
      g.holes.push(zones.splice(nextInt(rng, 0, zones.length - 1), 1)[0]!);
    return g;
  });
}

/** Una prenda favorita y una odiada, distintas, al azar. */
export function rollPreferences(rng: RngState): { likes: GarmentKind; hates: GarmentKind } {
  const likes = pick(rng, GARMENT_KINDS);
  const hates = pick(
    rng,
    GARMENT_KINDS.filter((k) => k !== likes),
  );
  return { likes, hates };
}

/** Viste a alguien con la ropa del principio y le da sus preferencias. */
export function dressStarter(w: PieceCounter, s: Survivor, rng: RngState): void {
  s.worn = starterClothes(w, rng);
  Object.assign(s, rollPreferences(rng));
}

/** Se va del mundo (por el borde del mapa) con todo lo que lleva: se apunta en las cuentas. */
export function piecesGone(w: World, pieces: readonly Piece[]): void {
  w.pieceLog.gone += pieces.length;
}

/** Todos los inventarios del mundo con su nombre (para las invariantes y las cuentas). */
function inventories(w: World): [string, Inventory][] {
  return [
    ['almacén', w.storage.items],
    ...people(w).map((s): [string, Inventory] => [`carga de ${s.name}`, s.carrying]),
    ...w.containers.map((c): [string, Inventory] => [`contenedor #${c.id}`, c.items]),
    ...w.piles.map((p): [string, Inventory] => [`montón #${p.id}`, p.items]),
  ];
}

/** Las personas que están en el mundo (colonos, desconocidos, los que se van y los que vuelven). */
function people(w: World): Survivor[] {
  return [
    ...w.survivors,
    ...(w.stranger?.survivors ?? []),
    ...w.leaving,
    ...w.returning.flatMap((r) => (r.kind === 'stranger' ? [r.survivor] : [])),
  ];
}

/** Lo que lleva puesto cada uno (personas, zombis y los que vuelven como zombis). */
export function wornLists(w: World): [string, Garment[]][] {
  return [
    ...people(w).map((s): [string, Garment[]] => [`ropa de ${s.name}`, s.worn]),
    ...w.zombies.map((z): [string, Garment[]] => [`ropa del zombi #${z.id}`, z.worn]),
    ...w.returning.flatMap((r): [string, Garment[]][] =>
      r.kind === 'zombie' ? [[`ropa de ${r.name} (vuelve)`, r.worn]] : [],
    ),
  ];
}

/** Todas las piezas del mundo y dónde están. */
export function allPieces(w: World): { where: string; piece: Piece }[] {
  return [
    ...inventories(w).flatMap(([where, inv]) => inv.pieces.map((piece) => ({ where, piece }))),
    ...wornLists(w).flatMap(([where, worn]) => worn.map((piece) => ({ where, piece }))),
  ];
}
