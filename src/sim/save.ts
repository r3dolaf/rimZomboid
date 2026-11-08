// Guardar y cargar la partida (spec H6b §1): la partida entera en JSON, con su versión y unos datos
// para enseñarla. La caja común va una sola vez (los sitios la comparten con la base) y al cargar se
// vuelve a enlazar, así la partida sigue exactamente igual.
import { occupied } from './build';
import { contains } from './geom';
import { checkInvariants } from './invariants';
import { ITEM_KINDS } from './items';
import { baseSink } from './water';
import type { NarratorStyle, World, ZombieLevel } from './types';

/**
 * Cambia con cada cambio de forma de la partida. Las de versiones anteriores se ponen al día al
 * cargarlas (`migrate`); las de una versión desconocida no se cargan.
 */
export const SAVE_VERSION = 3;

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
    if (file.version < 1 || file.version > SAVE_VERSION) return { error: 'version' };
    const world = file.world;
    if (!isMeta(file.meta) || typeof world !== 'object' || world === null)
      return { error: 'broken' };
    if (file.version < 2) toV2(world);
    if (file.version < 3) toV3(world);
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

type Json = Record<string, unknown>;
const isObject = (x: unknown): x is Json => typeof x === 'object' && x !== null;

/** Recorre todo lo que hay dentro de `x` (objetos y listas), una vez cada cosa. */
function walk(x: unknown, visit: (o: Json) => void, seen = new Set<unknown>()): void {
  if (!isObject(x) || seen.has(x)) return;
  seen.add(x);
  if (Array.isArray(x)) {
    for (const v of x) walk(v, visit, seen);
    return;
  }
  visit(x);
  for (const v of Object.values(x)) walk(v, visit, seen);
}

/**
 * De la versión 1 a la 2 (V1, el huerto): las cosas nuevas a 0 en todo lo que guarda cosas, el
 * trabajo y la habilidad Cultivar en cada persona y el huerto vacío en cada mapa.
 */
function toV2(world: World): void {
  walk(world, (o) => {
    if (Array.isArray(o.pieces) && typeof o.food === 'number')
      for (const k of ITEM_KINDS) if (typeof o[k] !== 'number') o[k] = 0;
    if (typeof o.kills === 'number' && typeof o.siegesRepelled === 'number') o.harvested ??= 0;
    const { work, priorities, skills } = o as Partial<Record<string, Json>>;
    if (isObject(work) && isObject(priorities) && isObject(skills)) {
      work.farm ??= true;
      priorities.farm ??= 3;
      skills.farm ??= { level: 0, xp: 0 };
    }
  });
  const maps = [
    world,
    ...(Array.isArray(world.siteMaps) ? world.siteMaps.map((m) => m.world) : []),
  ];
  for (const m of maps) if (isObject(m) && !Array.isArray(m.plots)) m.plots = [];
}

/**
 * De la versión 2 a la 3 (V2, beber): la sed (como su hambre) en cada persona y el fregadero de la
 * base, donde no estorbe a nada.
 */
function toV3(world: World): void {
  walk(world, (o) => {
    const needs = o.needs as Partial<Record<string, number>> | undefined;
    if (isObject(needs) && typeof needs.hunger === 'number' && typeof needs.thirst !== 'number')
      needs.thirst = needs.hunger;
  });
  if (!Array.isArray(world.furniture) || !world.grid || !world.base) return;
  const hasSink = world.furniture.some(
    (f) => f.kind === 'sink' && contains(world.base.rect, f.pos),
  );
  if (hasSink) return;
  const sink = baseSink(world.grid, world.base, world.common.nextId, (p) =>
    occupied(world, p.x, p.y),
  );
  if (!sink) return;
  world.common.nextId++;
  world.furniture.push(sink);
}
