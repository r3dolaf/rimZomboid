// Los sitios del mundo (spec H5c2 §2): 40–60, cada uno en su hexágono, según el terreno: junto a un
// pueblo, pueblecitos y naves; en la carretera o junto a ella, gasolineras; en el campo, granjas; en el bosque y las
// colinas, casas aisladas. Empiezan ocultos.
import { ATLAS_GAS, ATLAS_SITES, SITE_MIN_DIST, SITE_SPACING } from '../balance';
import { nextFloat, nextInt, type RngState } from '../rng';
import type { Atlas, SiteInfo, SiteKind } from '../types';
import { hexDistance, hexesWithin, sideFrom } from './hex';

/** El tipo de sitio que pega en ese hexágono. */
function kindAt(atlas: Atlas, i: number, rng: RngState): SiteKind {
  const r = nextFloat(rng);
  if (hexesWithin(atlas, i, 1).some((j) => atlas.town[j] === 1 && j !== atlas.base))
    return r < 0.5 ? 'village' : r < 0.8 ? 'warehouse' : 'house';
  if (atlas.road[i] === 1) return r < 0.6 ? 'gas' : r < 0.8 ? 'farm' : 'house';
  // Junto a la carretera, también gasolineras.
  if (hexesWithin(atlas, i, 1).some((j) => atlas.road[j] === 1))
    return r < 0.4 ? 'gas' : r < 0.75 ? 'farm' : 'house';
  if (atlas.terrain[i] === 'field') return r < 0.7 ? 'farm' : 'house';
  return 'house';
}

/** Los sitios del mundo, ocultos, con ids desde 1. */
export function placeSites(atlas: Atlas, rng: RngState): SiteInfo[] {
  const n = atlas.width * atlas.height;
  const ok = (i: number) =>
    atlas.terrain[i] !== 'water' && hexDistance(atlas, i, atlas.base) >= SITE_MIN_DIST;
  const shuffled = (list: number[]) => {
    for (let k = list.length - 1; k > 0; k--) {
      const j = nextInt(rng, 0, k);
      [list[k], list[j]] = [list[j]!, list[k]!];
    }
    return list;
  };
  const wanted = nextInt(rng, ATLAS_SITES[0], ATLAS_SITES[1]);
  const sites: SiteInfo[] = [];
  const free = (i: number) =>
    ok(i) && !sites.some((x) => hexDistance(atlas, x.hex, i) < SITE_SPACING);
  const put = (hex: number, kind: SiteKind) =>
    sites.push({
      id: sites.length + 1,
      kind,
      special: null,
      hex,
      side: sideFrom(atlas, atlas.base, hex),
      hours: 0,
      state: 'hidden',
      visited: false,
      specialUntil: null,
      leftAt: null,
      extraZombies: 0,
    });
  // H6a: primero lo que da especialidad: junto a cada pueblo, un pueblecito (al lado) y una nave
  // (un poco más allá); y gasolineras en la carretera.
  for (let t = 0; t < n; t++) {
    if (atlas.town[t] !== 1 || t === atlas.base) continue;
    const village = shuffled(hexesWithin(atlas, t, 1).filter((i) => i !== t)).find(free);
    if (village !== undefined) put(village, 'village');
    const ring = hexesWithin(atlas, t, 2).filter((i) => hexDistance(atlas, i, t) === 2);
    const warehouse = shuffled(ring).find(free);
    if (warehouse !== undefined) put(warehouse, 'warehouse');
  }
  const roads = shuffled(
    Array.from({ length: n }, (_, i) => i).filter(
      (i) => atlas.road[i] === 1 && atlas.town[i] !== 1,
    ),
  );
  for (let k = nextInt(rng, ATLAS_GAS[0], ATLAS_GAS[1]); k > 0; k--) {
    const gas = roads.find(free);
    if (gas === undefined) break;
    put(gas, 'gas');
  }
  // El resto, al azar, según el terreno.
  for (const hex of shuffled(Array.from({ length: n }, (_, i) => i).filter(ok))) {
    if (sites.length >= wanted) break;
    if (!free(hex)) continue;
    put(hex, kindAt(atlas, hex, rng));
  }
  return sites;
}
