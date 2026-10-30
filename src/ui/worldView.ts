// Lo que dibuja la escena del mundo (spec H5c2 §6), sin Phaser: dónde cae cada hexágono en pantalla,
// qué hexágono hay bajo un punto, los sitios (con su icono, su gente y si se perdieron) y los grupos
// que viajan, entre el hexágono en que están y el siguiente.
import { es } from '../i18n/es';
import { hexCenter, hexIndex, type HexSize } from '../sim/atlas/hex';
import { plannedHours } from '../sim/atlas/route';
import type { SiteKind, World } from '../sim/types';
import { siteName } from './describe';

/** El radio de un hexágono, en píxeles a zoom 1. */
export const HEX_PX = 20;
const HALF_W = Math.sqrt(3) / 2; // medio ancho de un hexágono de radio 1

const SITE_ICONS: Record<SiteKind, string> = {
  house: '🏠',
  farm: '🌾',
  gas: '⛽',
  warehouse: '🏭',
  village: '🏘️',
};
const BASE_ICON = '🏕️';

/** El centro del hexágono `i`, en píxeles (el primero, entero en la esquina). */
export function hexPixel(size: HexSize, i: number): { x: number; y: number } {
  const c = hexCenter(size, i);
  return { x: (c.x + HALF_W) * HEX_PX, y: (c.y + 1) * HEX_PX };
}

/** El tamaño del mundo en píxeles. */
export function atlasPixels(size: HexSize): { width: number; height: number } {
  return {
    width: Math.sqrt(3) * (size.width + 0.5) * HEX_PX,
    height: (1.5 * (size.height - 1) + 2) * HEX_PX,
  };
}

/** El hexágono bajo el punto (x, y) en píxeles, o −1 fuera del mundo. */
export function hexAtPixel(size: HexSize, x: number, y: number): number {
  const px = x / HEX_PX - HALF_W;
  const py = y / HEX_PX - 1;
  // De píxel a coordenadas cúbicas, redondeando a la más cercana.
  const q = (Math.sqrt(3) / 3) * px - py / 3;
  const r = (2 / 3) * py;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(-q - r);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs + q + r);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return hexIndex(size, rq + (rr - (rr & 1)) / 2, rr);
}

/** Las seis esquinas de un hexágono con punta arriba y abajo. */
export function hexCorners(x: number, y: number, r: number): { x: number; y: number }[] {
  return [0, 1, 2, 3, 4, 5].map((k) => {
    const a = (Math.PI / 3) * k - Math.PI / 6;
    return { x: x + r * Math.cos(a), y: y + r * Math.sin(a) };
  });
}

export interface WorldSite {
  /** `null`: la base. */
  siteId: number | null;
  hex: number;
  icon: string;
  label: string;
  people: number;
  lost: boolean;
  special: boolean;
}

/** La base y los sitios que se conocen (o se perdieron), con cuánta gente hay en cada uno. */
export function worldSites(base: World): WorldSite[] {
  const people = (id: number) =>
    base.siteMaps.find((m) => m.siteId === id)?.world.survivors.length ?? 0;
  return [
    {
      siteId: null,
      hex: base.common.atlas.base,
      icon: BASE_ICON,
      label: es.maps.base,
      people: base.survivors.length,
      lost: false,
      special: false,
    },
    ...base.common.expedition.sites
      .filter((s) => s.state !== 'hidden')
      .map((s) => ({
        siteId: s.id,
        hex: s.hex,
        icon: SITE_ICONS[s.kind],
        label: siteName(base, s).name,
        people: people(s.id),
        lost: s.state === 'lost',
        special: s.special !== null,
      })),
  ];
}

export interface WorldGroup {
  travelId: number;
  x: number;
  y: number;
  people: number;
  label: string;
}

/** Los grupos que ya han salido, entre su hexágono y el siguiente según lo que les falta. */
export function worldGroups(base: World): WorldGroup[] {
  const { atlas } = base.common;
  return base.common.expedition.travels
    .filter((t) => t.members.length > 0)
    .map((t) => {
      const a = hexPixel(atlas, t.path[t.at]!);
      const next = t.path[t.at + 1];
      let frac = 0;
      let b = a;
      if (next !== undefined) {
        b = hexPixel(atlas, next);
        const total = plannedHours(atlas, next);
        frac = Number.isFinite(total) && total > 0 ? 1 - t.hoursLeft / total : 0;
        frac = Math.max(0, Math.min(1, frac));
      }
      return {
        travelId: t.id,
        x: a.x + (b.x - a.x) * frac,
        y: a.y + (b.y - a.y) * frac,
        people: t.members.length,
        label: t.members.map((s) => s.name).join(', '),
      };
    });
}
