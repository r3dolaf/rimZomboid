// Construir (spec H4a §4): trabajar en un plano con toda su madera y lo que sale al terminar.
import { BUILD, BUILD_NOISE_TICKS, CURTAINS_COST, NOISE, UNBOARD_WOOD } from '../balance';
import { isRepairPlan, WALL_KINDS } from '../build';
import { emptyInventory } from '../items';
import { logEvent } from '../log';
import { makeNoise } from '../noise';
import { getTile, isWalkable, setTile } from '../map/grid';
import { dropPile, pileAt, walkableNear } from '../piles';
import { nextFloat } from '../rng';
import { buildFailChance, practice, workSpeed } from '../skills';
import { repairTile } from '../structures';
import {
  Tile,
  type Action,
  type Blueprint,
  type BuildKind,
  type Point,
  type Survivor,
  type World,
} from '../types';
import { tileOf } from '../world';
import { atOrBeside, standBeside, standOnOrBeside } from './stand';

/** Más que cualquier distancia al cuadrado en el mapa: deja los planos de reparar delante. */
export const FAR = 1e9;

/** Muebles: se construyen de pie encima del plano. El resto, desde al lado. */
const ON_TILE: ReadonlySet<BuildKind> = new Set(['bed', 'table', 'campfire']);

const ready = (b: Blueprint) =>
  b.wood >= BUILD[b.kind].wood && (b.curtains ?? 0) >= (CURTAINS_COST[b.kind] ?? 0);

/** Plano en el que trabaja o al que va a trabajar, o `null`. */
export function buildTarget(s: Survivor): number | null {
  const a = s.action;
  if (a.type === 'build') return a.blueprintId;
  if (a.type === 'moveTo' && a.then?.type === 'build') return a.then.blueprintId;
  return null;
}

export function buildJob(s: Survivor, w: World): Action | null {
  const claimed = new Set(w.survivors.filter((o) => o !== s).map(buildTarget));
  const t = tileOf(s.pos);
  let best: { b: Blueprint; stand: { x: number; y: number }; d: number } | null = null;
  for (const b of w.blueprints) {
    if (!ready(b) || claimed.has(b.id)) continue;
    // Reparar va antes (spec H4b §4.2): a igualdad de tipo, el más cercano.
    const d = (isRepairPlan(w, b) ? 0 : FAR) + (b.pos.x - t.x) ** 2 + (b.pos.y - t.y) ** 2;
    if (best && d >= best.d) continue;
    const stand = ON_TILE.has(b.kind) ? standOnOrBeside(w, s, b.pos) : standBeside(w, s, b.pos);
    if (stand) best = { b, stand, d };
  }
  return (
    best && { type: 'moveTo', target: best.stand, then: { type: 'build', blueprintId: best.b.id } }
  );
}

export function buildStillWorth(s: Survivor, w: World): boolean {
  const id = buildTarget(s);
  const b = id === null ? undefined : w.blueprints.find((x) => x.id === id);
  return b !== undefined && ready(b) && s.work.build;
}

export function startBuildActivity(s: Survivor, w: World, blueprintId: number): Action {
  const b = w.blueprints.find((x) => x.id === blueprintId);
  if (!b || !ready(b) || !atOrBeside(s, b.pos)) return { type: 'idle', ticksLeft: 0 };
  return { type: 'build', blueprintId };
}

/** Un tick de trabajo. Devuelve si ha terminado (o ya no tiene sentido seguir). */
export function workOnBlueprint(w: World, s: Survivor, blueprintId: number): boolean {
  const b = w.blueprints.find((x) => x.id === blueprintId);
  if (!b || !ready(b) || !s.work.build) return true;
  const ticks = BUILD[b.kind].ticks;
  if (b.progress < ticks) {
    // Avanza según la habilidad (spec H4c §3.1); se aprende aunque luego falle.
    const before = b.progress;
    b.progress = Math.min(ticks, b.progress + workSpeed(s, 'build'));
    practice(w, s, 'build', 1);
    // Cada martillazo se oye (spec H4b §3): cada BUILD_NOISE_TICKS de avance.
    if (Math.floor(b.progress / BUILD_NOISE_TICKS) > Math.floor(before / BUILD_NOISE_TICKS))
      makeNoise(w, s.pos, NOISE.build);
  }
  if (b.progress < ticks) return false;
  // Un muro, una puerta o unas tablas no se terminan con alguien (o un zombi) encima: espera.
  if (WALL_KINDS.has(b.kind) && someoneOn(w, b.pos)) return false;
  const chance = buildFailChance(s.skills.build.level, s.traits.includes('clumsy'));
  if (BUILD[b.kind].wood > 0 && nextFloat(w.rng) < chance) failBuild(w, b, s);
  else finishBuild(w, b, s);
  return true;
}

/**
 * Le sale mal: pierde la mitad de la madera (hacia arriba) y el plano vuelve a empezar; Transportar
 * traerá lo que falta (spec H4c §3.1).
 */
function failBuild(w: World, b: Blueprint, builder: Survivor): void {
  const lost = Math.ceil(BUILD[b.kind].wood / 2);
  b.wood -= lost;
  b.progress = 0;
  w.common.woodLog.wasted += lost;
  logEvent(w, { kind: 'buildFailed', survivorId: builder.id, what: b.kind, wood: lost });
}

/** ¿Hay alguien (colono, desconocido o zombi) en esa casilla o a punto de pisarla? */
function someoneOn(w: World, p: { x: number; y: number }): boolean {
  const on = (x: { pos: Point; path: Point[] }) => {
    const t = tileOf(x.pos);
    const next = x.path[0];
    return (t.x === p.x && t.y === p.y) || (next?.x === p.x && next.y === p.y);
  };
  return w.survivors.some(on) || (w.stranger?.survivors.some(on) ?? false) || w.zombies.some(on);
}

/** El plano se convierte en lo que es (spec H4a §4.1). */
export function finishBuild(w: World, b: Blueprint, builder: Survivor): void {
  w.blueprints = w.blueprints.filter((x) => x !== b);
  w.common.woodLog.spent += BUILD[b.kind].wood;
  const { x, y } = b.pos;
  switch (b.kind) {
    case 'bed': {
      const owner = w.survivors.find((s) => s.bedId === null);
      const id = Math.max(0, ...w.beds.map((k) => k.id)) + 1;
      w.beds.push({ id, pos: { x, y }, ownerId: owner?.id ?? null });
      if (owner) owner.bedId = id;
      break;
    }
    case 'table':
    case 'campfire':
      w.furniture.push({ id: w.common.nextId++, kind: b.kind, pos: { x, y } });
      break;
    case 'tub': // H5b: vacío
      w.furniture.push({ id: w.common.nextId++, kind: 'tub', pos: { x, y }, water: 0 });
      break;
    case 'woodWall':
      setTile(w.grid, x, y, Tile.WoodWall);
      break;
    case 'woodDoor':
      setTile(w.grid, x, y, Tile.Door);
      break;
    case 'board':
      setTile(w.grid, x, y, Tile.BoardedWindow);
      repairTile(w, x, y); // tablas nuevas: no arrastran el daño de la ventana
      break;
    case 'unboard':
      setTile(w.grid, x, y, Tile.Window);
      repairTile(w, x, y);
      w.common.woodLog.recovered += UNBOARD_WOOD;
      dropPile(w, tileOf(builder.pos), { ...emptyInventory(), wood: UNBOARD_WOOD });
      break;
    case 'repair':
      repairTile(w, x, y);
      break;
    case 'fixDoor':
      setTile(w.grid, x, y, Tile.Door);
      break;
    // Cortinas (H4d).
    case 'curtains':
      setTile(
        w.grid,
        x,
        y,
        getTile(w.grid, x, y) === Tile.Window ? Tile.CurtainedWindow : Tile.Window,
      );
      break;
    case 'takeDownCurtains': {
      setTile(w.grid, x, y, Tile.Window);
      const i = y * w.grid.width + x;
      w.curtains = w.curtains.filter((c) => c !== i);
      dropPile(w, tileOf(builder.pos), { ...emptyInventory(), curtains: 1 });
      break;
    }
    case 'hangCurtains':
      w.curtains.push(y * w.grid.width + x);
      break;
    case 'smashWindow': {
      // Rota a propósito (H4d): se pasa por ella, se ve, se oye lejos y las cortinas se pierden.
      setTile(w.grid, x, y, Tile.BrokenWindow);
      const i = y * w.grid.width + x;
      delete w.damage[String(i)];
      w.curtains = w.curtains.filter((c) => c !== i);
      makeNoise(w, { x: x + 0.5, y: y + 0.5 }, NOISE.broken);
      break;
    }
  }
  // Si quedó un montón donde ya no se puede pisar (un muro, unas tablas), se aparta al lado.
  const pile = pileAt(w, x, y);
  if (pile && !isWalkable(w.grid, x, y)) {
    w.piles = w.piles.filter((p) => p !== pile);
    dropPile(w, { x, y }, pile.items);
  }
  // Lo mismo con un cuerpo de zombi (H4d).
  if (!isWalkable(w.grid, x, y))
    for (const c of w.containers)
      if (c.kind === 'corpse' && c.pos.x === x && c.pos.y === y)
        c.pos = walkableNear(w, c.pos) ?? c.pos;
  logEvent(w, { kind: 'built', what: b.kind });
}
