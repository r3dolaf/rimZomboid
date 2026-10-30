// Sitios (spec H5c1 §2): su mundo (un mapa con la caja común de la base), creado la primera vez
// que llega alguien y guardado después.
import {
  BUILDINGS,
  CLOTHES_SALT,
  INITIAL_REVEAL,
  KNOWN_SITES_MAX,
  NOTE_SURVIVORS,
  RADIO_SURVIVORS,
  SITE_BURN_PER_DAY,
  SITE_HORDE_PER_DAY,
  SITE_HORDE_ZOMBIES,
  SITE_HOURS,
  SITE_LOOT_KEEP_PER_DAY,
  SITE_ZOMBIES_PER_DAY,
  SITE_RADIO_SHARE,
  SITE_RUMOR_PER_DAY,
  SPECIAL_SHARE,
  SURVIVORS_WAIT_DAYS,
  TICKS_PER_DAY,
  SITE_ZOMBIE_CLEAR,
  SITE_ZOMBIES,
} from './balance';
import { placeBlueprint } from './build';
import { emptyInventory, ITEM_KINDS } from './items';
import { piecesGone } from './clothes';
import { WEAPONS } from './jobs/weapons';
import {
  fillBags,
  fillBuilding,
  fillFindings,
  fillGarments,
  fillHatchets,
  placeContainers,
} from './loot';
import { getTile, isWalkable, setTile } from './map/grid';
import { addDecision } from './decisions';
import { newStranger } from './systems/strangers';
import { wornBags } from './bags';
import { generateSite } from './map/site';
import { createRng, nextFloat, nextInt, pick } from './rng';
import { logEvent, type SiteHow } from './log';
import {
  Tile,
  type MapSide,
  type Point,
  type SiteInfo,
  type SiteKind,
  type SiteSpecial,
  type World,
} from './types';
import { ZOMBIE_RNG_SALT } from './world';
import { newZombie } from './zombies/spawn';

/** La semilla de un sitio: de la de la partida y su id (siempre el mismo sitio). */
export function siteSeed(base: World, id: number): number {
  return (Math.imul(base.seed ^ 0x5bd1e995, 31) + Math.imul(id, 0x9e3779b1)) >>> 0;
}

/** El mundo de un sitio: el que ya tiene o uno nuevo (que queda en `base.siteMaps`). */
export function siteMap(base: World, info: SiteInfo): World {
  const have = base.siteMaps.find((m) => m.siteId === info.id);
  if (have) return have.world;
  const seed = siteSeed(base, info.id);
  const rng = createRng(seed);
  const g = generateSite(info.kind, info.special, info.side, rng);
  const containers = placeContainers(g.houses, g.furniture, rng);
  // El alijo, con el doble de botín.
  if (info.special === 'stash')
    for (const h of g.houses)
      fillBuilding(
        'house',
        containers.filter((c) => c.houseId === h.id),
        rng,
      );
  const clothesRng = createRng((seed ^ CLOTHES_SALT) >>> 0);
  fillGarments(base.common, g.houses, containers, clothesRng);
  fillBags(base.common, g.houses, containers, clothesRng);
  fillHatchets(g.houses, containers, clothesRng);
  fillFindings(g.houses, containers, clothesRng);
  for (const c of containers) c.designated = true; // al llegar, todo marcado para saquear
  base.common.woodLog.start += containers.reduce((n, c) => n + c.items.wood, 0);
  // Y las armas del botín (para que cuadren las cuentas de todo el juego).
  base.common.weaponLog.fromSites += containers.reduce(
    (n, c) => n + WEAPONS.reduce((k, x) => k + c.items[x], 0),
    0,
  );
  for (const h of g.houses)
    if (nextFloat(rng) < BUILDINGS[h.kind as keyof typeof BUILDINGS].locked)
      setTile(g.grid, h.door.x, h.door.y, Tile.LockedDoor);
  const w: World = {
    common: base.common,
    mapId: info.id,
    siteMaps: [],
    seed,
    tick: base.tick,
    rng,
    grid: g.grid,
    base: g.base,
    houses: g.houses,
    survivors: [],
    beds: [],
    storage: { tiles: g.camp, items: emptyInventory() },
    containers,
    seen: new Array<number>(g.grid.width * g.grid.height).fill(0),
    orders: [],
    stranger: null,
    narrator: { ...base.narrator, nextEventAt: Number.MAX_SAFE_INTEGER, lastAt: {} },
    decisions: [],
    piles: [],
    blueprints: [],
    furniture: [],
    chopMarks: [],
    zombies: [],
    zombieRng: createRng((seed ^ ZOMBIE_RNG_SALT) >>> 0),
    zombieLevel: base.zombieLevel,
    nextZombieId: 1,
    nextZombieAt: Number.MAX_SAFE_INTEGER,
    damage: {},
    zombieSightedDay: 0,
    curtains: g.grid.tiles.flatMap((t, i) => (t === Tile.Window ? [i] : [])),
    bills: [],
    nextBillId: 1,
    town: { x: 0, y: 0, w: g.grid.width, h: g.grid.height },
    hordes: [],
    nextHordeId: 1,
    siege: null,
    leaving: [],
    returning: [],
    mercy: [],
    gone: [],
    waterCutAt: 0,
  };
  // Se conoce la carretera y lo de alrededor del campamento (como la base al empezar).
  const n = g.grid.width;
  for (let i = 0; i < g.grid.tiles.length; i++) if (g.grid.tiles[i] === Tile.Road) w.seen[i] = 1;
  for (const t of g.camp)
    for (let dy = -INITIAL_REVEAL; dy <= INITIAL_REVEAL; dy++)
      for (let dx = -INITIAL_REVEAL; dx <= INITIAL_REVEAL; dx++) {
        const x = t.x + dx;
        const y = t.y + dy;
        if (x >= 0 && y >= 0 && x < n && y < g.grid.height) w.seen[y * n + x] = 1;
      }
  placeBlueprint(w, 'campfire', g.campfire.x, g.campfire.y);
  // Sus zombis, lejos del campamento (y los de las hordas que llegaron antes).
  addZombies(w, siteZombiesAtStart(info) + info.extraZombies);
  info.extraZombies = 0;
  if (info.special === 'survivors') addTrapped(w);
  base.siteMaps.push({ siteId: info.id, world: w });
  return w;
}

const SITE_KINDS: readonly SiteKind[] = ['house', 'farm', 'gas', 'warehouse', 'village'];
const SPECIALS: readonly SiteSpecial[] = ['survivors', 'stash', 'dangerous'];

/**
 * Descubre un sitio (§3): tipo, lado y horas al azar (o el lado y lo especial que se pidan) con el
 * azar de las expediciones; `null` si ya se conocen 10. Avisa en el registro.
 */
export function discoverSite(
  w: World,
  opts: { how: SiteHow; side?: MapSide; special?: SiteSpecial | null; survivorId?: number },
): SiteInfo | null {
  const ex = w.common.expedition;
  if (ex.sites.filter((x) => x.state === 'known').length >= KNOWN_SITES_MAX) return null;
  const rng = ex.rng;
  const kind = pick(rng, SITE_KINDS);
  const side = opts.side ?? (nextInt(rng, 0, 3) as MapSide);
  const hours = nextInt(rng, SITE_HOURS[0], SITE_HOURS[1]);
  const special =
    opts.special !== undefined
      ? opts.special
      : nextFloat(rng) < SPECIAL_SHARE
        ? pick(rng, SPECIALS)
        : null;
  const [d0, d1] = SURVIVORS_WAIT_DAYS;
  const info: SiteInfo = {
    id: ex.nextSiteId++,
    kind,
    special,
    side,
    hours,
    state: 'known',
    visited: false,
    specialUntil:
      special === 'survivors'
        ? w.tick + nextInt(rng, d0 * TICKS_PER_DAY, d1 * TICKS_PER_DAY)
        : null,
    leftAt: null,
    extraZombies: 0,
  };
  ex.sites.push(info);
  const site = { kind, special, side, hours };
  logEvent(
    w,
    opts.survivorId === undefined
      ? { kind: 'siteFound', site, how: opts.how }
      : { kind: 'siteFound', site, how: opts.how, survivorId: opts.survivorId },
  );
  return info;
}

/** Mapas de carreteras y notas que han llegado al almacén (o al campamento): cada uno, un sitio. */
export function readFindings(w: World): void {
  const store = w.storage.items;
  while (store.roadMap > 0 && discoverSite(w, { how: 'roadMap' })) store.roadMap--;
  while (store.note > 0) {
    const help = nextFloat(w.common.expedition.rng) < NOTE_SURVIVORS;
    if (!discoverSite(w, help ? { how: 'note', special: 'survivors' } : { how: 'note' })) break;
    store.note--;
  }
}

/**
 * Cada día: los cambios de los sitios sin gente y, a veces, el narrador avisa de uno nuevo (humo a lo
 * lejos o una llamada por radio).
 */
export function sitesDailySystem(base: World): void {
  if (base.tick % TICKS_PER_DAY !== 0 || base.common.over) return;
  const rng = base.common.expedition.rng;
  for (const info of base.common.expedition.sites) if (info.state === 'known') siteDay(base, info);
  if (nextFloat(rng) >= SITE_RUMOR_PER_DAY) return;
  if (nextFloat(rng) < SITE_RADIO_SHARE)
    discoverSite(
      base,
      nextFloat(rng) < RADIO_SURVIVORS ? { how: 'radio', special: 'survivors' } : { how: 'radio' },
    );
  else discoverSite(base, { how: 'smoke' });
}

/** Los zombis de un sitio al crearse (el alijo y el peligroso, los suyos). */
export function siteZombiesAtStart(info: SiteInfo): number {
  return SITE_ZOMBIES[
    info.special === 'stash' || info.special === 'dangerous' ? info.special : info.kind
  ];
}

/** `n` zombis en casillas al azar por las que se anda, lejos del campamento. */
function addZombies(w: World, n: number): void {
  const camp = w.storage.tiles[0] ?? { x: 0, y: 0 };
  for (let i = 0, tries = 0; i < n && tries < 10_000; tries++) {
    const x = nextInt(w.zombieRng, 0, w.grid.width - 1);
    const y = nextInt(w.zombieRng, 0, w.grid.height - 1);
    if (!isWalkable(w.grid, x, y)) continue;
    if (Math.abs(camp.x - x) + Math.abs(camp.y - y) < SITE_ZOMBIE_CLEAR) continue;
    w.zombies.push(newZombie(w, { x, y }));
    i++;
  }
}

/** Lo que tiene un mapa en sus muebles, su almacén o campamento y sus montones. */
const inventoriesOf = (w: World) => [
  w.storage.items,
  ...w.containers.map((c) => c.items),
  ...w.piles.map((p) => p.items),
];

/**
 * Lo que ha pasado en un sitio mientras nadie estaba (§2), una sola vez al volver: zombis por día
 * (hasta el doble de los del principio) y otros se han llevado un 10 % por día (montones y piezas;
 * la madera y las armas, en sus cuentas).
 */
export function catchUp(map: World, info: SiteInfo, now: number): void {
  const elapsed = now - map.tick;
  if (elapsed <= 0) return;
  const days = elapsed / TICKS_PER_DAY;
  const cap = 2 * siteZombiesAtStart(info);
  const more = Math.min(Math.round(SITE_ZOMBIES_PER_DAY * days), cap - map.zombies.length);
  addZombies(map, Math.max(0, more));
  const taken = 1 - SITE_LOOT_KEEP_PER_DAY ** days;
  const c = map.common;
  for (const inv of inventoriesOf(map)) {
    for (const k of ITEM_KINDS) {
      const n = Math.round(inv[k] * taken);
      if (n <= 0) continue;
      inv[k] -= n;
      if (k === 'wood') c.woodLog.wasted += n;
      if ((WEAPONS as readonly string[]).includes(k)) c.weaponLog.rotted += n;
    }
    const gone = inv.pieces.filter(() => nextFloat(map.rng) < taken);
    if (gone.length === 0) continue;
    inv.pieces = inv.pieces.filter((p) => !gone.includes(p));
    piecesGone(map, gone);
  }
  map.tick = now;
}

/** Se quema un sitio: se pierde con todo (en las cuentas: piezas, madera y armas). */
function burn(base: World, info: SiteInfo): void {
  info.state = 'lost';
  const entry = base.siteMaps.find((m) => m.siteId === info.id);
  if (!entry) return;
  const map = entry.world;
  const c = base.common;
  for (const inv of inventoriesOf(map)) {
    c.woodLog.wasted += inv.wood;
    c.weaponLog.rotted += WEAPONS.reduce((n, k) => n + inv[k], 0);
    piecesGone(map, inv.pieces);
  }
  c.woodLog.wasted += map.blueprints.reduce((n, b) => n + b.wood, 0);
  for (const z of map.zombies) piecesGone(map, [...z.worn, ...z.bags]);
  base.siteMaps = base.siteMaps.filter((m) => m !== entry);
}

/** Los cambios del día de un sitio conocido sin gente (§2): quemarse, horda, supervivientes. */
function siteDay(base: World, info: SiteInfo): void {
  const map = base.siteMaps.find((m) => m.siteId === info.id)?.world;
  if (map && map.survivors.length > 0) return;
  const rng = base.common.expedition.rng;
  const site = { kind: info.kind, special: info.special, side: info.side, hours: info.hours };
  if (info.special === 'survivors' && info.specialUntil !== null && base.tick > info.specialUntil) {
    info.special = null;
    info.specialUntil = null;
    // Los que esperaban ya no están (con lo suyo, en las cuentas).
    if (map?.stranger) {
      for (const s of map.stranger.survivors)
        piecesGone(map, [...s.worn, ...s.carrying.pieces, ...wornBags(s)]);
      map.stranger = null;
    }
    logEvent(base, { kind: 'siteChanged', site, change: 'silent' });
  }
  if (nextFloat(rng) < SITE_BURN_PER_DAY) {
    burn(base, info);
    logEvent(base, { kind: 'siteChanged', site, change: 'burned' });
  } else if (nextFloat(rng) < SITE_HORDE_PER_DAY) {
    if (map) addZombies(map, SITE_HORDE_ZOMBIES);
    else info.extraZombies += SITE_HORDE_ZOMBIES;
    logEvent(base, { kind: 'siteChanged', site, change: 'overrun' });
  }
}

/** Supervivientes que piden ayuda (§2): 1 o 2 desconocidos dentro del primer edificio. */
function addTrapped(w: World): void {
  const h = w.houses[0];
  if (!h) return;
  const floor: Point[] = [];
  for (let y = h.rect.y; y < h.rect.y + h.rect.h; y++)
    for (let x = h.rect.x; x < h.rect.x + h.rect.w; x++)
      if (getTile(w.grid, x, y) === Tile.Floor) floor.push({ x, y });
  if (floor.length === 0) return;
  const n = nextInt(w.rng, 1, 2);
  const survivors = Array.from({ length: n }, () => newStranger(w, pick(w.rng, floor)));
  w.stranger = { survivors, leaving: false };
}

/** Distancia (en casillas) a la que un colono ve a los atrapados. */
const SEE_TRAPPED = 10;

/**
 * Supervivientes atrapados (§2): cuando un colono los ve, «¿Se unen?» (una vez); aceptados, el sitio
 * deja de ser especial.
 */
export function survivorsSystem(base: World): void {
  for (const { siteId, world: w } of base.siteMaps) {
    if (w.survivors.length === 0) continue;
    const info = base.common.expedition.sites.find((x) => x.id === siteId);
    const st = w.stranger;
    if (!st) {
      if (info?.special === 'survivors') {
        info.special = null;
        info.specialUntil = null;
      }
      continue;
    }
    if (st.leaving || w.decisions.some((d) => d.kind === 'stranger')) continue;
    const seen = st.survivors.some((t) =>
      w.survivors.some(
        (s) => (s.pos.x - t.pos.x) ** 2 + (s.pos.y - t.pos.y) ** 2 <= SEE_TRAPPED ** 2,
      ),
    );
    if (seen)
      addDecision(
        w,
        'stranger',
        st.survivors.map((s) => s.id),
      );
  }
}
