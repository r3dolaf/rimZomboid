// Ropa (spec H5b §2–§5): prendas, capas, protección y lo que vale una prenda para alguien.
import {
  CLOTHES_MOOD,
  GARMENTS,
  HIT_WEIGHTS,
  HOLE_CHANCE,
  PAD_BONUS,
  PATCH_FACTOR,
  PROTECTION_MAX,
  DIRTY_HOURS,
  START_EXTRA_CHANCE,
  START_EXTRAS,
  TICKS_PER_HOUR,
  ZOMBIE_CLOTHES,
  type GarmentSpec,
} from './balance';
import { logEvent } from './log';
import type { MoodModifier } from './mood';
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

export type ClothesMoodId = keyof typeof CLOTHES_MOOD;

const dirty = (g: Garment) => g.dirtHours >= DIRTY_HOURS;

/** Lo que dice cada prenda de por sí (rota, sucia, con sangre, de muertos, favorita, odiada). */
function marksOf(s: Survivor, g: Garment): ClothesMoodId[] {
  const out: ClothesMoodId[] = [];
  if (g.holes.length > 0) out.push('tornClothes');
  if (dirty(g)) out.push('dirtyClothes');
  if (g.bloody) out.push('bloodyClothes');
  if (g.from === 'colonist') out.push('deadClothes');
  if (g.from === 'zombie') out.push('zombieClothes');
  if (g.kind === s.likes) out.push('favoriteGarment');
  if (g.kind === s.hates) out.push('hatedGarment');
  return out;
}

/** Lo que no le importa a un Práctico (H5b §5). */
const PRACTICAL_IGNORES: readonly ClothesMoodId[] = [
  'tornClothes',
  'dirtyClothes',
  'bloodyClothes',
  'deadClothes',
  'zombieClothes',
];

/** Cuánto le cuenta un motivo de la ropa según sus rasgos (0: no le afecta). */
function weight(s: Survivor, id: ClothesMoodId): number {
  if (s.traits.includes('slob')) return id === 'naked' || id === 'halfNaked' ? 1 : 0;
  if (s.traits.includes('practical') && PRACTICAL_IGNORES.includes(id)) return 0;
  return s.traits.includes('vain') ? 2 : 1;
}

/**
 * La ropa en el ánimo (H5b §5): medio desnudo o desnudo; rota, sucia, con sangre, de un muerto o
 * de un zombi (una vez cada cosa, lleve las que lleve); bien vestido; su favorita y la odiada.
 */
export function clothesMood(s: Survivor, worn: readonly Garment[] = s.worn): MoodModifier[] {
  const covers = (z: BodyPart) => worn.some((g) => coversOf(g).includes(z));
  const torso = covers('torso');
  const legs = covers('leftLeg') || covers('rightLeg');
  const ids: ClothesMoodId[] = [];
  if (!torso && !legs) ids.push('naked');
  else if (!torso || !legs) ids.push('halfNaked');
  const marks = new Set(worn.flatMap((g) => marksOf(s, g)));
  const bad = PRACTICAL_IGNORES.filter((id) => marks.has(id) && weight(s, id) > 0);
  if (torso && legs && bad.length === 0) ids.push('wellDressed');
  ids.push(...bad);
  if (marks.has('favoriteGarment')) ids.push('favoriteGarment');
  if (marks.has('hatedGarment')) ids.push('hatedGarment');
  return ids
    .map((id) => ({ id, value: CLOTHES_MOOD[id] * weight(s, id) }))
    .filter((m) => m.value !== 0);
}

const sum = (mods: MoodModifier[]) => mods.reduce((n, m) => n + m.value, 0);

/** Lo que vale para alguien llevar eso (H5b §4): su protección (Práctico, el doble) y su ánimo. */
export function outfitScore(s: Survivor, worn: readonly Garment[]): number {
  const protect = protectionScore(worn) * (s.traits.includes('practical') ? 2 : 1);
  return protect + sum(clothesMood(s, worn));
}

/** Lo que vale una prenda sola para alguien (para comparar con lo que lleva en su hueco). */
export function garmentValue(s: Survivor, g: Garment): number {
  const protect = protectionScore([g]) * (s.traits.includes('practical') ? 2 : 1);
  return protect + marksOf(s, g).reduce((n, id) => n + CLOTHES_MOOD[id] * weight(s, id), 0);
}

/** Cada hora, la ropa puesta se ensucia (H5b §5). */
export function clothesSystem(w: World): void {
  if (w.tick % TICKS_PER_HOUR !== 0) return;
  for (const s of [...w.survivors, ...(w.stranger?.survivors ?? [])])
    for (const g of s.worn) g.dirtHours++;
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

/** Las personas que están en el mundo (colonos, desconocidos, los que se van y los que vuelven). */
function people(w: World): Survivor[] {
  return [
    ...w.survivors,
    ...(w.stranger?.survivors ?? []),
    ...w.leaving,
    ...w.returning.flatMap((r) => (r.kind === 'stranger' ? [r.survivor] : [])),
  ];
}

/** Todas las piezas del mundo y dónde están. */
export function allPieces(w: World): { where: string; piece: Piece }[] {
  const out: { where: string; piece: Piece }[] = [];
  forEachPieceList(w, (list, where) => {
    for (const piece of list) out.push({ where: where(), piece });
  });
  return out;
}

/**
 * Cada lista de piezas del mundo (inventarios y ropa puesta) con su sitio, que se calcula solo si
 * hace falta: las invariantes lo recorren en cada tick de la partida larga. `worn`: es ropa puesta.
 */
export function forEachPieceList(
  w: World,
  fn: (list: readonly Piece[], where: () => string, worn: boolean) => void,
): void {
  const each = (list: readonly Piece[], where: () => string, worn = false) => {
    if (list.length > 0) fn(list, where, worn);
  };
  each(w.storage.items.pieces, () => 'almacén');
  for (const s of people(w)) {
    each(s.carrying.pieces, () => `carga de ${s.name}`);
    each(s.worn, () => `ropa de ${s.name}`, true);
  }
  for (const z of w.zombies) each(z.worn, () => `ropa del zombi #${z.id}`, true);
  for (const r of w.returning)
    if (r.kind === 'zombie') each(r.worn, () => `ropa de ${r.name} (vuelve)`, true);
  for (const c of w.containers) each(c.items.pieces, () => `contenedor #${c.id}`);
  for (const p of w.piles) each(p.items.pieces, () => `montón #${p.id}`);
}
