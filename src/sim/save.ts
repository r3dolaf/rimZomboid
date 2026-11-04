// Guardar y cargar la partida (spec H6b §1): la partida entera en JSON, con su versión y unos datos
// para enseñarla. La caja común va una sola vez (los sitios la comparten con la base) y al cargar se
// vuelve a enlazar, así la partida sigue exactamente igual.
import { checkInvariants } from './invariants';
import type { NarratorStyle, World, ZombieLevel } from './types';

/** Cambia cuando una partida guardada antes ya no sirve. */
export const SAVE_VERSION = 1;

/** Lo que se enseña de una partida guardada. */
export interface SaveMeta {
  day: number;
  seed: number;
  narrator: NarratorStyle;
  zombies: ZombieLevel;
  /** Cuándo se guardó (fecha real, ISO). */
  savedAt: string;
}

interface SaveFile {
  version: number;
  meta: SaveMeta;
  world: World;
}

/** La partida (desde la base) como texto. */
export function saveGame(base: World, meta: SaveMeta): string {
  const world = {
    ...base,
    siteMaps: base.siteMaps.map((m) => ({ ...m, world: { ...m.world, common: undefined } })),
  };
  return JSON.stringify({ version: SAVE_VERSION, meta, world });
}

const STYLES: readonly NarratorStyle[] = ['calm', 'balanced', 'chaotic'];
const LEVELS: readonly ZombieLevel[] = ['few', 'normal', 'many'];

/** ¿Tiene forma de datos de una partida? */
function isMeta(m: unknown): m is SaveMeta {
  const x = m as Partial<SaveMeta> | null;
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof x.day === 'number' &&
    typeof x.seed === 'number' &&
    typeof x.savedAt === 'string' &&
    STYLES.includes(x.narrator as NarratorStyle) &&
    LEVELS.includes(x.zombies as ZombieLevel)
  );
}

/**
 * La partida de un texto, o por qué no se puede cargar. Nunca rompe: lo que no tenga forma de
 * partida (aunque sea JSON con versión) es `broken`, y se comprueba con las reglas del juego.
 */
export function loadGame(
  text: string,
): { world: World; meta: SaveMeta } | { error: 'broken' | 'version' } {
  try {
    const file = JSON.parse(text) as Partial<SaveFile> | null;
    if (typeof file !== 'object' || file === null || typeof file.version !== 'number')
      return { error: 'broken' };
    if (file.version !== SAVE_VERSION) return { error: 'version' };
    const world = file.world;
    if (!isMeta(file.meta) || typeof world !== 'object' || world === null)
      return { error: 'broken' };
    const c = world.common;
    if (!c?.expedition || !c.atlas || !world.grid || !Array.isArray(world.siteMaps))
      return { error: 'broken' };
    for (const m of world.siteMaps) {
      if (typeof m?.siteId !== 'number' || !m.world?.grid) return { error: 'broken' };
      m.world.common = c;
    }
    // Las guardadas antes de H6c no recuerdan los nombres: valen los de quien hay o hubo.
    if (!Array.isArray(c.usedNames as unknown))
      c.usedNames = [
        ...new Set([
          ...(c.dead ?? []).map((d) => d.name),
          ...[world, ...world.siteMaps.map((m) => m.world)].flatMap((m) =>
            m.survivors.map((s) => s.name),
          ),
          ...c.expedition.travels.flatMap((t) => t.members.map((s) => s.name)),
        ]),
      ];
    if (checkInvariants(world).length > 0) return { error: 'broken' };
    return { world, meta: file.meta };
  } catch {
    return { error: 'broken' };
  }
}
