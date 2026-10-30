// Varios mapas a la vez (spec H5c1 §1): la base guarda los mapas de los sitios y todos avanzan
// juntos; un sitio sin nadie se queda quieto hasta que vuelva alguien.
import { farewellsSystem } from './death';
import { departuresSystem } from './expeditions';
import { travelSystem } from './travel';
import { sitesDailySystem, survivorsSystem } from './sites';
import { step } from './step';
import type { Survivor, World } from './types';

/** La base y los mapas de todos los sitios, en orden. */
export function allMaps(base: World): World[] {
  return [base, ...base.siteMaps.map((m) => m.world)];
}

/** Los mapas que se simulan: la base siempre; un sitio, si hay algún colono. */
export function activeMaps(base: World): World[] {
  return [base, ...base.siteMaps.map((m) => m.world).filter((w) => w.survivors.length > 0)];
}

/** El mapa con ese id (0, la base), o `undefined`. */
export function mapById(base: World, id: number): World | undefined {
  return id === 0 ? base : base.siteMaps.find((m) => m.siteId === id)?.world;
}

/** Todos los colonos y en qué mapa están (o de viaje). */
export function allColonists(base: World): { s: Survivor; where: number | 'travel' }[] {
  return [
    ...allMaps(base).flatMap((w) => w.survivors.map((s) => ({ s, where: w.mapId }))),
    ...base.common.expedition.travels.flatMap((t) =>
      t.members.map((s) => ({ s, where: 'travel' as const })),
    ),
  ];
}

/** Un tick de todo el juego: la base y los sitios con gente. */
export function stepGame(base: World): void {
  // Primero los viajes (con la hora de este tick): los que llegan avanzan ya con su mapa.
  travelSystem(base); // H5c1
  for (const w of activeMaps(base)) step(w);
  departuresSystem(base); // los que salen de expedición
  survivorsSystem(base); // supervivientes atrapados en los sitios
  sitesDailySystem(base); // H5c1: avisos de sitios
  farewellsSystem(base); // quien muere o se va de un mapa: lo notan en los demás
}
