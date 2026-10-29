// Expediciones (spec H5c1 §4): mandar un grupo a un sitio, prepararse en el almacén con la lista
// del grupo, ir al borde de ese lado y salir del mapa; el viaje empieza cuando han salido todos.
import { ACTIVE_SITES_MAX } from './balance';
import { stashOne, takeInto, unloadAt } from './bags';
import { WEAPONS } from './jobs/weapons';
import { detach } from './death';
import { ITEM_KINDS, type ItemKind } from './items';
import { takeSupplies } from './jobs/supplies';
import { isWalkable } from './map/grid';
import { regionOf } from './path/astar';
import { pick } from './rng';
import type { Action, MapSide, Point, Survivor, Travel, World } from './types';
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

/** ¿Puede irse? (No derribado, ni en crisis, ni en modo combate, ni ya de viaje.) */
const canGo = (s: Survivor) =>
  s.trip === null && !s.drafted && s.action.type !== 'downed' && s.action.type !== 'crisis';

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

/** La orden de mandar un grupo (§4), desde la base. Las que no valen no hacen nada. */
export function applyExpeditionOrder(
  w: World,
  o:
    | {
        type: 'sendExpedition';
        siteId: number;
        survivorIds: number[];
        items: Partial<Record<ItemKind, number>>;
      }
    | { type: 'returnHome'; siteId: number },
): void {
  if (w.mapId !== 0) return;
  if (o.type === 'returnHome') return returnHome(w, o.siteId);
  const site = w.common.expedition.sites.find((x) => x.id === o.siteId && x.state === 'known');
  if (!site) return;
  const active = activeSiteIds(w);
  if (!active.has(site.id) && active.size >= ACTIVE_SITES_MAX) return;
  const members = o.survivorIds
    .map((id) => w.survivors.find((s) => s.id === id))
    .filter((s): s is Survivor => s !== undefined && canGo(s));
  if (members.length === 0) return;
  const travel: Travel = {
    id: w.common.nextId++,
    kind: 'go',
    siteId: site.id,
    side: site.side,
    members: [],
    hoursLeft: site.hours,
    pending: members.map((s) => s.id),
  };
  w.common.expedition.travels.push(travel);
  const parts = shares(o.items, members.length);
  members.forEach((s, i) => {
    s.trip = { travelId: travel.id, stage: 'prepare', items: parts[i]! };
    s.action = { type: 'idle', ticksLeft: 0 };
    s.path = [];
  });
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
  const t = travelOf(w, s);
  if (s.trip && t?.kind === 'back') {
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
      const ok = s !== undefined && s.trip?.travelId === t.id && s.action.type !== 'downed';
      if (!ok && s) s.trip = null;
      return ok;
    });
  }
  ex.travels = ex.travels.filter((t) => t.pending.length > 0 || t.members.length > 0);
}

/** «Volver» (§4): todos los del sitio se cargan lo que puedan del campamento y salen. */
function returnHome(base: World, siteId: number): void {
  const info = base.common.expedition.sites.find((x) => x.id === siteId);
  const site = base.siteMaps.find((m) => m.siteId === siteId)?.world;
  if (!info || !site) return;
  const members = site.survivors.filter(canGo);
  if (members.length === 0) return;
  const travel: Travel = {
    id: base.common.nextId++,
    kind: 'back',
    siteId,
    side: info.side,
    members: [],
    hoursLeft: info.hours,
    pending: members.map((s) => s.id),
  };
  base.common.expedition.travels.push(travel);
  for (const s of members) {
    s.trip = { travelId: travel.id, stage: 'prepare', items: {} };
    s.action = { type: 'idle', ticksLeft: 0 };
    s.path = [];
  }
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
