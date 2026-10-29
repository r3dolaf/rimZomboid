// Fabricar (spec H4d §4): pedidos en la mesa — coger los materiales, trabajarlos y llevar lo hecho.
import {
  DIRTY_HOURS,
  GARMENTS,
  HIT_WEIGHTS,
  ITEM_WEIGHT_KG,
  RECIPES,
  type Recipe,
} from '../balance';
import { garments } from '../bags';
import { coversOf, destroyed, piecesGone } from '../clothes';
import { emptyInventory, pieceKg, weightOf, type ItemKind } from '../items';
import { logEvent } from '../log';
import { findPath } from '../path/astar';
import { nextFloat, pick } from '../rng';
import { buildFailChance, capacityKg, workSpeed } from '../skills';
import type {
  Action,
  Bill,
  BodyPart,
  Furniture,
  Garment,
  Material,
  RecipeId,
  Survivor,
  World,
} from '../types';
import { tileOf } from '../world';
import { hasCargo } from './medical';
import { atOrBeside, standOnOrBeside } from './stand';

const entries = (part: Partial<Record<ItemKind, number>>) =>
  Object.entries(part) as [ItemKind, number][];

/** Pedido que va a hacer o está haciendo, o `null`. */
export function craftTarget(s: Survivor): number | null {
  const a = s.action;
  if (a.type === 'craft') return a.billId;
  if (a.type === 'moveTo' && (a.then?.type === 'fetchCraft' || a.then?.type === 'craft'))
    return a.then.billId;
  return null;
}

/** ¿Tiene a mano la herramienta? (La aguja, en el almacén; el cuchillo, también en la mano o la carga.) */
function hasTool(s: Survivor, w: World, r: Recipe): boolean {
  if (r.tool === null) return true;
  if (w.storage.items[r.tool] > 0) return true;
  return r.tool === 'knife' && (s.equipped === 'knife' || s.carrying.knife > 0);
}

/** De mejor a peor (H5b §3). */
const MATERIALS: readonly Material[] = ['leather', 'denim', 'cloth'];

/** El mejor material que haya en `from`, o `null`. */
export const bestMaterial = (from: Record<ItemKind, number>): Material | null =>
  MATERIALS.find((m) => from[m] > 0) ?? null;

/** ¿Hay en `from` todo lo que gasta la receta (y, si lleva material, alguno)? */
const hasInputs = (r: Recipe, from: Record<ItemKind, number>) =>
  entries(r.input).every(([k, n]) => from[k] >= n) &&
  (r.material === undefined || MATERIALS.some((m) => from[m] >= r.material!));

/** De esas zonas, la que más golpes recibe (a igualdad, la primera). */
function mostHit(zones: readonly BodyPart[]): BodyPart | null {
  let best: BodyPart | null = null;
  for (const z of zones) if (best === null || HIT_WEIGHTS[z] > HIT_WEIGHTS[best]) best = z;
  return best;
}

/** Dónde se remienda: el agujero de la zona más golpeada. */
export const mendZone = (g: Garment): BodyPart | null => mostHit(g.holes);

/** Dónde se refuerza: la zona más golpeada sin agujero ni refuerzo. */
export const padZone = (g: Garment): BodyPart | null =>
  mostHit(coversOf(g).filter((z) => !g.holes.includes(z) && g.pads[z] === undefined));

/** ¿Le sirve esa prenda a la receta? */
function fits(r: Recipe, g: Garment): boolean {
  if (r.piece === 'holed') return g.holes.length > 0;
  if (r.piece === 'paddable') return padZone(g) !== null;
  if (r.piece === 'dirty') return g.dirtHours >= DIRTY_HOURS || g.bloody;
  return destroyed(g) && Object.keys(GARMENTS[g.kind].unpick).length > 0;
}

/** La primera prenda del almacén que le sirve a la receta (H5b), o `null`. */
export function pieceFor(w: World, r: Recipe): Garment | null {
  if (r.piece === undefined) return null;
  return garments(w.storage.items.pieces).find((g) => fits(r, g)) ?? null;
}

/** ¿Hay sobre qué trabajar? (Las que no son sobre prendas, siempre.) */
const hasPiece = (w: World, r: Recipe) => r.piece === undefined || pieceFor(w, r) !== null;

/** ¿Toca hacer el pedido? (contando lo que ya se está haciendo y lo que va camino del almacén) */
export function billWanted(w: World, b: Bill): boolean {
  if (b.mode === 'always') return true; // H5b: mientras haya prenda (lo mira quien lo coge)
  const busy = w.survivors.filter((s) => craftTarget(s) === b.id).length;
  if (b.mode === 'count') return b.done + busy < b.target;
  const r = RECIPES[b.recipe];
  return entries(r.output).some(([k, n]) => {
    const have = w.storage.items[k] + w.survivors.reduce((acc, s) => acc + s.carrying[k], 0);
    return have + busy * n < b.target;
  });
}

/** ¿Sirve ese mueble para la receta? (La mesa; el barreño, con agua bastante, H5b.) */
const isStation = (r: Recipe, f: Furniture) =>
  f.kind === (r.station ?? 'table') && (f.water ?? 0) >= (r.water ?? 0);

/** La mesa (o el barreño) más cercana a la que puede llegar, con dónde ponerse. */
function nearestTable(
  s: Survivor,
  w: World,
  r: Recipe,
): { table: Furniture; stand: { x: number; y: number } } | null {
  const at = tileOf(s.pos);
  let best: { table: Furniture; stand: { x: number; y: number }; d: number } | null = null;
  for (const f of w.furniture) {
    if (!isStation(r, f)) continue;
    const d = (f.pos.x - at.x) ** 2 + (f.pos.y - at.y) ** 2;
    if (best && d >= best.d) continue;
    const stand = standOnOrBeside(w, s, f.pos);
    if (stand) best = { table: f, stand, d };
  }
  return best;
}

/** El primer pedido de la lista que toca y que se puede hacer: va al almacén a por los materiales. */
export function craftJob(s: Survivor, w: World): Action | null {
  for (const b of w.bills) {
    const r = RECIPES[b.recipe];
    if (!billWanted(w, b) || !hasInputs(r, w.storage.items) || !hasTool(s, w, r)) continue;
    if (!hasPiece(w, r) || !nearestTable(s, w, r)) continue;
    return {
      type: 'moveTo',
      target: pick(w.rng, w.storage.tiles),
      then: { type: 'fetchCraft', billId: b.id },
    };
  }
  return null;
}

/** ¿Sigue teniendo sentido? */
export function craftStillWorth(s: Survivor, w: World): boolean {
  if (!s.work.craft) return false;
  const a = s.action;
  if (a.type !== 'moveTo') return true; // trabajando: lo termina
  const b = w.bills.find((x) => x.id === craftTarget(s));
  if (a.then?.type === 'fetchCraft') {
    if (!b) return false;
    const r = RECIPES[b.recipe];
    return (
      hasInputs(r, w.storage.items) &&
      hasTool(s, w, r) &&
      hasPiece(w, r) &&
      nearestTable(s, w, r) !== null
    );
  }
  if (a.then?.type === 'craft') {
    const { tableId, pieceId } = a.then;
    return (
      !!b &&
      w.furniture.some((f) => f.id === tableId && isStation(RECIPES[b.recipe], f)) &&
      hasInputs(RECIPES[b.recipe], s.carrying) &&
      (pieceId === undefined || s.carrying.pieces.some((p) => p.id === pieceId))
    );
  }
  return true;
}

/** Al llegar: en el almacén coge los materiales y va a la mesa; en la mesa, empieza a trabajar. */
export function startCraftActivity(
  s: Survivor,
  w: World,
  activity:
    | { type: 'fetchCraft'; billId: number }
    | { type: 'craft'; billId: number; tableId: number; pieceId?: number; material?: Material },
): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  const b = w.bills.find((x) => x.id === activity.billId);
  if (!b) return idle;
  const r = RECIPES[b.recipe];
  if (activity.type === 'fetchCraft') {
    const t = nearestTable(s, w, r);
    if (!t || !hasInputs(r, w.storage.items) || !hasTool(s, w, r)) return idle;
    // Sobre prendas (H5b): la prenda y el mejor material que haya.
    const g = pieceFor(w, r);
    if (r.piece !== undefined && !g) return idle;
    const mat = r.material !== undefined ? bestMaterial(w.storage.items) : null;
    const kg =
      entries(r.input).reduce((acc, [k, n]) => acc + n * ITEM_WEIGHT_KG[k], 0) +
      (mat ? r.material! * ITEM_WEIGHT_KG[mat] : 0) +
      (g ? pieceKg(g) : 0);
    if (weightOf(s.carrying) + kg > capacityKg(s) + 1e-9) return idle;
    const path = findPath(w.grid, tileOf(s.pos), t.stand);
    if (!path) return idle;
    for (const [k, n] of entries(r.input)) {
      w.storage.items[k] -= n;
      s.carrying[k] += n;
    }
    if (mat) {
      w.storage.items[mat] -= r.material!;
      s.carrying[mat] += r.material!;
    }
    if (g) {
      w.storage.items.pieces = w.storage.items.pieces.filter((p) => p !== g);
      s.carrying.pieces.push(g);
    }
    s.path = path;
    return {
      type: 'moveTo',
      target: t.stand,
      then: {
        type: 'craft',
        billId: b.id,
        tableId: t.table.id,
        ...(g ? { pieceId: g.id } : {}),
        ...(mat ? { material: mat } : {}),
      },
    };
  }
  const table = w.furniture.find((f) => f.id === activity.tableId && isStation(r, f));
  if (!table || !atOrBeside(s, table.pos) || !hasInputs(r, s.carrying) || !hasTool(s, w, r))
    return idle;
  const { pieceId, material } = activity;
  if (pieceId !== undefined && !s.carrying.pieces.some((p) => p.id === pieceId)) return idle;
  const ticksLeft = Math.round(r.ticks / workSpeed(s, 'craft'));
  return {
    type: 'craft',
    billId: b.id,
    tableId: table.id,
    recipe: b.recipe,
    ticksLeft,
    ...(pieceId !== undefined ? { pieceId } : {}),
    ...(material ? { material } : {}),
  };
}

/**
 * Después de fabricar (bien o mal), a descargar en el almacén lo que lleva (spec H4d §4, paso 4):
 * si no, con la carga a cuestas seguiría saqueando, fuera cual fuera la prioridad.
 */
export function unloadAfterCraft(s: Survivor, w: World): Action {
  if (!hasCargo(s)) return { type: 'idle', ticksLeft: 0 };
  const target = pick(w.rng, w.storage.tiles);
  const path = findPath(w.grid, tileOf(s.pos), target);
  if (!path) return { type: 'idle', ticksLeft: 0 };
  s.path = path;
  return { type: 'moveTo', target, then: { type: 'unload' } };
}

/**
 * Termina: gasta los materiales que lleva y, según su habilidad (como al construir), le sale bien
 * (lo hecho, a su carga; un pedido "veces" suma uno) o mal (pierde la mitad de cada material,
 * hacia arriba, y lo demás se lo queda para devolverlo al almacén).
 */
export function finishCraft(
  w: World,
  s: Survivor,
  a: { billId: number; recipe: RecipeId; pieceId?: number; material?: Material; tableId?: number },
): void {
  const r = RECIPES[a.recipe];
  if (!hasInputs(r, s.carrying)) return;
  // Sobre prendas (H5b §3): la que lleva y el material que se llevó.
  const g = garments(s.carrying.pieces).find((p) => p.id === a.pieceId);
  if (r.piece !== undefined && !g) return;
  const used = entries(r.input);
  if (r.material !== undefined) {
    const mat = a.material && s.carrying[a.material] >= r.material ? a.material : null;
    if (!mat) return;
    used.push([mat, r.material]);
  }
  const garment = g ? { garment: g.kind } : {};
  // En el barreño (H5b): su agua; si ya no queda bastante, no se hace.
  const tub = r.water !== undefined ? w.furniture.find((f) => f.id === a.tableId) : undefined;
  if (r.water !== undefined && (!tub || (tub.water ?? 0) < r.water)) return;
  for (const [k, n] of used) s.carrying[k] -= n;
  if (tub) tub.water = (tub.water ?? 0) - r.water!;
  const chance = r.safe ? 0 : buildFailChance(s.skills.craft.level, s.traits.includes('clumsy'));
  if (chance > 0 && nextFloat(w.rng) < chance) {
    const lost = emptyInventory();
    for (const [k, n] of used) {
      lost[k] = Math.ceil(n / 2);
      s.carrying[k] += n - lost[k];
    }
    logEvent(w, { kind: 'craftFailed', survivorId: s.id, recipe: a.recipe, lost, ...garment });
    return;
  }
  for (const [k, n] of entries(r.output)) s.carrying[k] += n;
  if (g) workOnGarment(w, s, a.recipe, g, a.material);
  const b = w.bills.find((x) => x.id === a.billId);
  if (b && b.mode === 'count') b.done++;
  logEvent(w, { kind: 'crafted', survivorId: s.id, recipe: a.recipe, ...garment });
}

/** Remendar, reforzar o descoser (H5b §3) la prenda que lleva. */
function workOnGarment(
  w: World,
  s: Survivor,
  recipe: RecipeId,
  g: Garment,
  material: Material | undefined,
): void {
  if (recipe === 'mend' && material) {
    const z = mendZone(g);
    if (z === null) return;
    g.holes = g.holes.filter((x) => x !== z);
    g.patches[z] = material;
  } else if (recipe === 'pad' && material) {
    const z = padZone(g);
    if (z !== null) g.pads[z] = material;
  } else if (recipe === 'wash') {
    g.dirtHours = 0;
    g.bloody = false;
  } else if (recipe === 'unpickGarment') {
    s.carrying.pieces = s.carrying.pieces.filter((p) => p !== g);
    for (const [k, n] of entries(GARMENTS[g.kind].unpick)) s.carrying[k] += n;
    piecesGone(w, [g]);
  }
}
