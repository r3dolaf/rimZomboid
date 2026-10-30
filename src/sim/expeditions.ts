// Expediciones (spec H5c1 §4): mandar un grupo a un sitio, prepararse en el almacén con la lista
// del grupo, ir al borde de ese lado y salir del mapa; el viaje empieza cuando han salido todos.
import { ACTIVE_SITES_MAX, EXPLORE_FOOD, EXPLORE_MAX, HEX_HOURS } from './balance';
import { hexIndex, hexOf, sideFrom } from './atlas/hex';
import { findRoute, hexHours } from './atlas/route';
import type { ExpeditionOrder } from './orders';
import { stashOne, takeInto, unloadAt } from './bags';
import { WEAPONS } from './jobs/weapons';
import { armFactor } from './body';
import { detach } from './death';
import { needsRest } from './jobs/medical';
import { ITEM_KINDS, type ItemKind } from './items';
import { takeSupplies } from './jobs/supplies';
import { isWalkable } from './map/grid';
import { regionOf } from './path/astar';
import { pick } from './rng';
import type { Action, Atlas, MapSide, Point, Survivor, Travel, World } from './types';
import { tileOf } from './world';

/**
 * La casilla de salida de un lado: la del borde, transitable y alcanzable desde la puerta (de la
 * base o del campamento), más cerca de ella.
 */
export function exitTile(w: World, side: MapSide): Point {
  const { width, height } = w.grid;
  const door = w.base.door;
  const region = regionOf(w.grid, door.x, door.y);
  const edge: Point[] = [];
  if (side < 2) for (let x = 0; x < width; x++) edge.push({ x, y: side === 0 ? 0 : height - 1 });
  else for (let y = 0; y < height; y++) edge.push({ x: side === 2 ? 0 : width - 1, y });
  let best: Point | null = null;
  let bestD = Infinity;
  for (const p of edge) {
    if (!isWalkable(w.grid, p.x, p.y) || regionOf(w.grid, p.x, p.y) !== region) continue;
    const d = (p.x - door.x) ** 2 + (p.y - door.y) ** 2;
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best ?? edge[Math.floor(edge.length / 2)]!;
}

/** Los sitios con gente o con un grupo de camino (salen, viajan o llegan). */
export function activeSiteIds(base: World): Set<number> {
  const ids = new Set<number>();
  for (const m of base.siteMaps) if (m.world.survivors.length > 0) ids.add(m.siteId);
  for (const t of base.common.expedition.travels)
    if (t.kind === 'go' && t.siteId !== null) ids.add(t.siteId);
  return ids;
}

/**
 * ¿Puede hacer el viaje? Ni derribado, ni en crisis, ni en modo combate, ni descansando por dolor o
 * fiebre, ni sin brazos: si no, no cogería el viaje y el grupo le esperaría.
 */
const able = (s: Survivor, w: World) =>
  !s.drafted &&
  s.action.type !== 'downed' &&
  s.action.type !== 'crisis' &&
  armFactor(s) > 0 &&
  !needsRest(s, w);

/** ¿Puede irse? (Puede hacer el viaje y no está ya en otro.) */
export const canGo = (s: Survivor, w: World) => s.trip === null && able(s, w);

/** Reparte la lista del grupo entre ellos: lo mismo a cada uno; lo que sobra, a los primeros. */
function shares(
  items: Partial<Record<ItemKind, number>>,
  n: number,
): Partial<Record<ItemKind, number>>[] {
  const out = Array.from({ length: n }, () => ({}) as Partial<Record<ItemKind, number>>);
  for (const k of ITEM_KINDS) {
    const total = Math.max(0, Math.floor(items[k] ?? 0));
    for (let i = 0; i < n; i++) {
      const part = Math.floor(total / n) + (i < total % n ? 1 : 0);
      if (part > 0) out[i]![k] = part;
    }
  }
  return out;
}

/**
 * Un hexágono a `dist` pasos de `from` hacia ese lado (0 norte, 1 sur, 2 oeste, 3 este), sin salir
 * del mundo: para explorar hacia un lado desde el panel (H5c2).
 */
export function hexToward(atlas: Atlas, from: number, side: MapSide, dist: number): number {
  const { col, row } = hexOf(atlas, from);
  const c = side === 2 ? col - dist : side === 3 ? col + dist : col;
  const r = side === 0 ? row - dist : side === 1 ? row + dist : row;
  const clampC = Math.max(0, Math.min(atlas.width - 1, c));
  const clampR = Math.max(0, Math.min(atlas.height - 1, r));
  return hexIndex(atlas, clampC, clampR);
}

/** El hexágono de un mapa: la base o el de su sitio. */
function hexOfMap(base: World, mapId: number): number | null {
  if (mapId === 0) return base.common.atlas.base;
  return base.common.expedition.sites.find((x) => x.id === mapId)?.hex ?? null;
}

/**
 * Un viaje nuevo de `from` a `target` por la ruta (con paradas), o `null` si no hay camino. Sale por
 * el lado del primer paso.
 */
export function newTravel(
  base: World,
  kind: Travel['kind'],
  siteId: number | null,
  from: number,
  target: number,
  waypoints: readonly number[] = [],
): Travel | null {
  const { atlas } = base.common;
  const n = atlas.width * atlas.height;
  if (![from, target, ...waypoints].every((i) => Number.isInteger(i) && i >= 0 && i < n))
    return null;
  const path = findRoute(atlas, from, target, waypoints);
  if (!path) return null;
  return {
    id: base.common.nextId++,
    kind,
    siteId,
    target,
    waypoints: [...waypoints],
    path,
    at: 0,
    hoursLeft: path.length > 1 ? firstHours(atlas, path[1]!) : 0,
    side: path.length > 1 ? sideFrom(atlas, path[0]!, path[1]!) : 0,
    members: [],
    pending: [],
  };
}

/** Lo que se cree que cuesta entrar en el primer hexágono (si es agua escondida, ya se verá). */
const firstHours = (atlas: Atlas, i: number) =>
  Number.isFinite(hexHours(atlas, i)) ? hexHours(atlas, i) : HEX_HOURS.field;

/** Les da su parte del viaje: se preparan y salen. */
function board(
  base: World,
  t: Travel,
  members: Survivor[],
  items?: Partial<Record<ItemKind, number>>,
) {
  t.pending = members.map((s) => s.id);
  base.common.expedition.travels.push(t);
  const parts = items ? shares(items, members.length) : members.map(() => ({}));
  members.forEach((s, i) => {
    s.trip = { travelId: t.id, stage: 'prepare', items: parts[i]! };
    s.action = { type: 'idle', ticksLeft: 0 };
    s.path = [];
  });
}

/** Las órdenes de expedición (§4; H5c2 §5), desde la base. Las que no valen no hacen nada. */
export function applyExpeditionOrder(w: World, o: ExpeditionOrder): void {
  if (w.mapId !== 0) return;
  if (o.type === 'returnHome') return returnHome(w, o.siteId, o.waypoints);
  if (o.type === 'explore') return explore(w, o.target, o.survivorIds, o.waypoints);
  if (o.type === 'redirectTravel') return redirect(w, o.travelId, o.siteId, o.waypoints);
  const site = w.common.expedition.sites.find((x) => x.id === o.siteId && x.state === 'known');
  const from = o.from === 0 ? w : w.siteMaps.find((m) => m.siteId === o.from)?.world;
  const fromHex = hexOfMap(w, o.from);
  if (!site || !from || fromHex === null || o.from === site.id) return;
  const active = activeSiteIds(w);
  if (!active.has(site.id) && active.size >= ACTIVE_SITES_MAX) return;
  const members = o.survivorIds
    .map((id) => from.survivors.find((s) => s.id === id))
    .filter((s): s is Survivor => s !== undefined && canGo(s, from));
  if (members.length === 0) return;
  const t = newTravel(w, 'go', site.id, fromHex, site.hex, o.waypoints);
  if (!t) return;
  // Desde la base, con la lista del almacén; desde un sitio, cargan lo del campamento.
  board(w, t, members, o.from === 0 ? o.items : undefined);
}

/** Cambia el destino de un viaje (a un sitio conocido o a la base) desde donde vayan. */
function redirect(
  base: World,
  travelId: number,
  siteId: number | null,
  waypoints: readonly number[] = [],
): void {
  const ex = base.common.expedition;
  const t = ex.travels.find((x) => x.id === travelId);
  if (!t) return;
  const site =
    siteId === null ? null : ex.sites.find((x) => x.id === siteId && x.state === 'known');
  if (siteId !== null && !site) return;
  const target = site ? site.hex : base.common.atlas.base;
  const here = t.path[t.at]!;
  const path = findRoute(base.common.atlas, here, target, waypoints);
  if (!path) return;
  t.kind = site ? 'go' : 'back';
  t.siteId = site ? site.id : null;
  t.target = target;
  t.waypoints = [...waypoints];
  t.explored = undefined;
  // Si aún no han salido, salen por el lado del nuevo primer paso; si ya van, siguen desde aquí.
  if (t.at === 0 && path.length > 1) t.side = sideFrom(base.common.atlas, path[0]!, path[1]!);
  t.path = path;
  t.at = 0;
  t.hoursLeft = path.length > 1 ? firstHours(base.common.atlas, path[1]!) : 0;
}

const travelOf = (w: World, s: Survivor) =>
  s.trip ? w.common.expedition.travels.find((t) => t.id === s.trip!.travelId) : undefined;

/** Lo primero, si se va de expedición: prepararse en el almacén y luego ir a la salida. */
export function tripJob(s: Survivor, w: World): Action | null {
  if (!s.trip) return null;
  const t = travelOf(w, s);
  if (!t) {
    s.trip = null;
    return null;
  }
  if (s.trip.stage === 'prepare')
    return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'prepareTrip' } };
  return { type: 'moveTo', target: exitTile(w, t.side), then: { type: 'leaveMap' } };
}

/** En el almacén: descarga, coge lo suyo («Llevar siempre», sus bolsas) y su parte de la lista. */
export function startPrepareTrip(s: Survivor, w: World): Action {
  if (s.trip && w.mapId !== 0) {
    // Desde un sitio (H5c2: vuelvan o vayan a otro), cargan lo del campamento.
    loadForTrip(w, s);
    s.trip.stage = 'exit';
  } else if (s.trip) {
    unloadAt(w, s);
    takeSupplies(s, w);
    const store = w.storage.items;
    for (const k of ITEM_KINDS)
      for (let n = s.trip.items[k] ?? 0; n > 0 && store[k] > 0 && stashOne(s, k); n--) store[k]--;
    s.trip.stage = 'exit';
  }
  return { type: 'idle', ticksLeft: 0 };
}

/** En la salida: sale del mapa con todo lo suyo y se une a su viaje. */
export function startLeaveMap(s: Survivor, w: World): Action {
  const t = travelOf(w, s);
  const at = tileOf(s.pos);
  const exit = t && exitTile(w, t.side);
  if (!t || !exit || Math.abs(at.x - exit.x) + Math.abs(at.y - exit.y) > 1)
    return { type: 'idle', ticksLeft: 0 };
  leaveMap(w, s, t);
  return s.action;
}

/** Sale del mapa: deja de estar en él (nadie queda apuntándole) y pasa a su viaje. */
export function leaveMap(w: World, s: Survivor, t: Travel): void {
  detach(w, s, true);
  w.survivors = w.survivors.filter((x) => x !== s);
  s.action = { type: 'idle', ticksLeft: 0 };
  s.path = [];
  s.pos = { x: -10, y: -10 }; // fuera de todo mapa
  s.drafted = false;
  s.trip = null;
  t.members.push(s);
  t.pending = t.pending.filter((id) => id !== s.id);
  // El último en irse de un sitio lo deja guardado (H5c1 §2).
  if (w.mapId !== 0 && w.survivors.length === 0) {
    const info = w.common.expedition.sites.find((x) => x.id === w.mapId);
    if (info) info.leftAt = w.tick;
  }
}

/**
 * Los que aún tienen que salir: si uno muere, cae derribado o ya no va, se queda y los demás
 * siguen; un viaje sin nadie se anula.
 */
export function departuresSystem(w: World): void {
  const ex = w.common.expedition;
  // (Salen de la base o, de vuelta, de un sitio.)
  const people = [w, ...w.siteMaps.map((m) => m.world)].flatMap((m) => m.survivors);
  for (const t of ex.travels) {
    if (t.pending.length === 0) continue;
    t.pending = t.pending.filter((id) => {
      const s = people.find((x) => x.id === id);
      const ok = s !== undefined && s.trip?.travelId === t.id && able(s, w);
      if (!ok && s) s.trip = null;
      return ok;
    });
  }
  ex.travels = ex.travels.filter((t) => t.pending.length > 0 || t.members.length > 0);
}

/** «Volver» (§4): todos los del sitio se cargan lo que puedan del campamento y salen. */
function returnHome(base: World, siteId: number, waypoints: readonly number[] = []): void {
  const info = base.common.expedition.sites.find((x) => x.id === siteId);
  const site = base.siteMaps.find((m) => m.siteId === siteId)?.world;
  if (!info || !site) return;
  const members = site.survivors.filter((s) => canGo(s, site));
  if (members.length === 0) return;
  const t = newTravel(base, 'back', null, info.hex, base.common.atlas.base, waypoints);
  if (t) board(base, t, members);
}

/**
 * Lo que se carga primero al volver (comida, medicinas y armas; luego lo demás), lo ligero y
 * valioso delante: si no, la comida llenaba las manos y se quedaban las armas.
 */
const LOAD_FIRST: readonly ItemKind[] = ['bandage', 'painkillers', ...WEAPONS, 'food'];

/** En el campamento, de vuelta: se carga lo que pueda, por ese orden (las bolsas, en la mano). */
export function loadForTrip(w: World, s: Survivor): void {
  const store = w.storage.items;
  for (const k of LOAD_FIRST) while (store[k] > 0 && stashOne(s, k)) store[k]--;
  takeInto(w, s, store, 'haul');
}

/** Explorar (§3): 1 o 2 salen hacia un lado y están fuera un día de luz. */
function explore(
  base: World,
  target: number,
  ids: number[],
  waypoints: readonly number[] = [],
): void {
  const members = ids
    .map((id) => base.survivors.find((s) => s.id === id))
    .filter((s): s is Survivor => s !== undefined && canGo(s, base))
    .slice(0, EXPLORE_MAX);
  if (members.length === 0) return;
  const t = newTravel(base, 'explore', null, base.common.atlas.base, target, waypoints);
  if (!t) return;
  // Un día fuera, o más: cada uno se lleva su lata (H5c1, tras la sonda de equilibrio).
  board(base, t, members, { food: EXPLORE_FOOD * members.length });
}
