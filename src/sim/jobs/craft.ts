// Fabricar (spec H4d §4): pedidos en la mesa — coger los materiales, trabajarlos y llevar lo hecho.
import { ITEM_WEIGHT_KG, RECIPES, type Recipe } from '../balance';
import { emptyInventory, isEmpty, weightOf, type ItemKind } from '../items';
import { logEvent } from '../log';
import { findPath } from '../path/astar';
import { nextFloat, pick } from '../rng';
import { buildFailChance, capacityKg, workSpeed } from '../skills';
import type { Action, Bill, Furniture, RecipeId, Survivor, World } from '../types';
import { tileOf } from '../world';
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

/** ¿Hay en `from` todo lo que gasta la receta? */
const hasInputs = (r: Recipe, from: Record<ItemKind, number>) =>
  entries(r.input).every(([k, n]) => from[k] >= n);

/** ¿Toca hacer el pedido? (contando lo que ya se está haciendo y lo que va camino del almacén) */
export function billWanted(w: World, b: Bill): boolean {
  const busy = w.survivors.filter((s) => craftTarget(s) === b.id).length;
  if (b.mode === 'count') return b.done + busy < b.target;
  const r = RECIPES[b.recipe];
  return entries(r.output).some(([k, n]) => {
    const have = w.storage.items[k] + w.survivors.reduce((acc, s) => acc + s.carrying[k], 0);
    return have + busy * n < b.target;
  });
}

/** La mesa más cercana a la que puede llegar, con dónde ponerse. */
function nearestTable(
  s: Survivor,
  w: World,
): { table: Furniture; stand: { x: number; y: number } } | null {
  const at = tileOf(s.pos);
  let best: { table: Furniture; stand: { x: number; y: number }; d: number } | null = null;
  for (const f of w.furniture) {
    if (f.kind !== 'table') continue;
    const d = (f.pos.x - at.x) ** 2 + (f.pos.y - at.y) ** 2;
    if (best && d >= best.d) continue;
    const stand = standOnOrBeside(w, s, f.pos);
    if (stand) best = { table: f, stand, d };
  }
  return best;
}

/** El primer pedido de la lista que toca y que se puede hacer: va al almacén a por los materiales. */
export function craftJob(s: Survivor, w: World): Action | null {
  if (w.bills.length === 0 || !nearestTable(s, w)) return null;
  for (const b of w.bills) {
    const r = RECIPES[b.recipe];
    if (!billWanted(w, b) || !hasInputs(r, w.storage.items) || !hasTool(s, w, r)) continue;
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
    return hasInputs(r, w.storage.items) && hasTool(s, w, r) && nearestTable(s, w) !== null;
  }
  if (a.then?.type === 'craft') {
    const tableId = a.then.tableId;
    return (
      !!b && w.furniture.some((f) => f.id === tableId) && hasInputs(RECIPES[b.recipe], s.carrying)
    );
  }
  return true;
}

/** Al llegar: en el almacén coge los materiales y va a la mesa; en la mesa, empieza a trabajar. */
export function startCraftActivity(
  s: Survivor,
  w: World,
  activity:
    { type: 'fetchCraft'; billId: number } | { type: 'craft'; billId: number; tableId: number },
): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  const b = w.bills.find((x) => x.id === activity.billId);
  if (!b) return idle;
  const r = RECIPES[b.recipe];
  if (activity.type === 'fetchCraft') {
    const t = nearestTable(s, w);
    if (!t || !hasInputs(r, w.storage.items) || !hasTool(s, w, r)) return idle;
    const kg = entries(r.input).reduce((acc, [k, n]) => acc + n * ITEM_WEIGHT_KG[k], 0);
    if (weightOf(s.carrying) + kg > capacityKg(s) + 1e-9) return idle;
    const path = findPath(w.grid, tileOf(s.pos), t.stand);
    if (!path) return idle;
    for (const [k, n] of entries(r.input)) {
      w.storage.items[k] -= n;
      s.carrying[k] += n;
    }
    s.path = path;
    return {
      type: 'moveTo',
      target: t.stand,
      then: { type: 'craft', billId: b.id, tableId: t.table.id },
    };
  }
  const table = w.furniture.find((f) => f.id === activity.tableId);
  if (!table || !atOrBeside(s, table.pos) || !hasInputs(r, s.carrying) || !hasTool(s, w, r))
    return idle;
  const ticksLeft = Math.round(r.ticks / workSpeed(s, 'craft'));
  return { type: 'craft', billId: b.id, tableId: table.id, recipe: b.recipe, ticksLeft };
}

/**
 * Después de fabricar (bien o mal), a descargar en el almacén lo que lleva (spec H4d §4, paso 4):
 * si no, con la carga a cuestas seguiría saqueando, fuera cual fuera la prioridad.
 */
export function unloadAfterCraft(s: Survivor, w: World): Action {
  if (isEmpty(s.carrying)) return { type: 'idle', ticksLeft: 0 };
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
export function finishCraft(w: World, s: Survivor, a: { billId: number; recipe: RecipeId }): void {
  const r = RECIPES[a.recipe];
  if (!hasInputs(r, s.carrying)) return;
  for (const [k, n] of entries(r.input)) s.carrying[k] -= n;
  if (nextFloat(w.rng) < buildFailChance(s.skills.craft.level, s.traits.includes('clumsy'))) {
    const lost = emptyInventory();
    for (const [k, n] of entries(r.input)) {
      lost[k] = Math.ceil(n / 2);
      s.carrying[k] += n - lost[k];
    }
    logEvent(w, { kind: 'craftFailed', survivorId: s.id, recipe: a.recipe, lost });
    return;
  }
  for (const [k, n] of entries(r.output)) s.carrying[k] += n;
  const b = w.bills.find((x) => x.id === a.billId);
  if (b && b.mode === 'count') b.done++;
  logEvent(w, { kind: 'crafted', survivorId: s.id, recipe: a.recipe });
}
