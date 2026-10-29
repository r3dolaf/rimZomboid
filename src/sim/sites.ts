// Sitios (spec H5c1 §2): su mundo (un mapa con la caja común de la base), creado la primera vez
// que llega alguien y guardado después.
import {
  BUILDINGS,
  CLOTHES_SALT,
  INITIAL_REVEAL,
  KNOWN_SITES_MAX,
  NOTE_SURVIVORS,
  RADIO_SURVIVORS,
  SITE_HOURS,
  SITE_RADIO_SHARE,
  SITE_RUMOR_PER_DAY,
  SPECIAL_SHARE,
  SURVIVORS_WAIT_DAYS,
  TICKS_PER_DAY,
  SITE_ZOMBIE_CLEAR,
  SITE_ZOMBIES,
} from './balance';
import { placeBlueprint } from './build';
import { emptyInventory } from './items';
import {
  fillBags,
  fillBuilding,
  fillFindings,
  fillGarments,
  fillHatchets,
  placeContainers,
} from './loot';
import { isWalkable, setTile } from './map/grid';
import { generateSite } from './map/site';
import { createRng, nextFloat, nextInt, pick } from './rng';
import { logEvent, type SiteHow } from './log';
import {
  Tile,
  type MapSide,
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
  // Sus zombis, lejos de la entrada.
  const count =
    SITE_ZOMBIES[
      info.special === 'stash' || info.special === 'dangerous' ? info.special : info.kind
    ];
  const far = (x: number, y: number) =>
    g.entry.every((e) => Math.abs(e.x - x) + Math.abs(e.y - y) >= SITE_ZOMBIE_CLEAR);
  for (let i = 0, tries = 0; i < count && tries < 10_000; tries++) {
    const x = nextInt(w.zombieRng, 0, g.grid.width - 1);
    const y = nextInt(w.zombieRng, 0, g.grid.height - 1);
    if (!isWalkable(g.grid, x, y) || !far(x, y)) continue;
    w.zombies.push(newZombie(w, { x, y }));
    i++;
  }
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

/** Cada día, a veces, el narrador avisa de un sitio: humo a lo lejos o una llamada por radio. */
export function sitesDailySystem(base: World): void {
  if (base.tick % TICKS_PER_DAY !== 0 || base.common.over) return;
  const rng = base.common.expedition.rng;
  if (nextFloat(rng) >= SITE_RUMOR_PER_DAY) return;
  if (nextFloat(rng) < SITE_RADIO_SHARE)
    discoverSite(
      base,
      nextFloat(rng) < RADIO_SURVIVORS ? { how: 'radio', special: 'survivors' } : { how: 'radio' },
    );
  else discoverSite(base, { how: 'smoke' });
}
