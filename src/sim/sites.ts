// Sitios (spec H5c1 §2): su mundo (un mapa con la caja común de la base), creado la primera vez
// que llega alguien y guardado después.
import {
  BUILDINGS,
  CLOTHES_SALT,
  INITIAL_REVEAL,
  SITE_ZOMBIE_CLEAR,
  SITE_ZOMBIES,
} from './balance';
import { placeBlueprint } from './build';
import { emptyInventory } from './items';
import { fillBags, fillBuilding, fillGarments, fillHatchets, placeContainers } from './loot';
import { isWalkable, setTile } from './map/grid';
import { generateSite } from './map/site';
import { createRng, nextFloat, nextInt } from './rng';
import { Tile, type SiteInfo, type World } from './types';
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
