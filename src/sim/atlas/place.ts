// Los sitios del mundo (spec H5c2 §2): 40–60, cada uno en su hexágono, según el terreno: junto a un
// pueblo, pueblecitos y naves; en la carretera o junto a ella, gasolineras; en el campo, granjas; en el bosque y las
// colinas, casas aisladas. Empiezan ocultos.
import { ATLAS_SITES, SITE_MIN_DIST, SITE_SPACING } from '../balance';
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
  const candidates: number[] = [];
  for (let i = 0; i < n; i++)
    if (atlas.terrain[i] !== 'water' && hexDistance(atlas, i, atlas.base) >= SITE_MIN_DIST)
      candidates.push(i);
  // Barajados con el azar de los sitios.
  for (let k = candidates.length - 1; k > 0; k--) {
    const j = nextInt(rng, 0, k);
    [candidates[k], candidates[j]] = [candidates[j]!, candidates[k]!];
  }
  const wanted = nextInt(rng, ATLAS_SITES[0], ATLAS_SITES[1]);
  const sites: SiteInfo[] = [];
  for (const hex of candidates) {
    if (sites.length >= wanted) break;
    if (sites.some((s) => hexDistance(atlas, s.hex, hex) < SITE_SPACING)) continue;
    sites.push({
      id: sites.length + 1,
      kind: kindAt(atlas, hex, rng),
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
  }
  return sites;
}
