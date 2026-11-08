// El helicóptero (spec C1 §3–4): llega al punto de evacuación el día anunciado; con gente en el mapa
// aterriza, hace ruido y atrae una horda; quien pisa la zona sube y se salva; se va a su hora (o
// antes, si ya no queda nadie a quien esperar). Después, ver el final o seguir con los que quedan.
import { EVAC_HORDE, HELI_NOISE_TICKS, HORDE_SPAWN_DEPTH, ZOMBIE_LEVEL_MULT } from './balance';
import { gameTime } from './clock';
import { addDecision } from './decisions';
import { endGame, leaveByAir } from './death';
import { heliZone, inZone, zoneCenter } from './evac';
import { allColonists } from './game';
import { logEvent } from './log';
import { isZombieWalkable } from './map/grid';
import { makeNoise } from './noise';
import { nextInt } from './rng';
import type { Decision, MapSide, Point, Rescue, Survivor, World } from './types';
import { newZombie } from './zombies/spawn';

/** El mapa del punto de evacuación anunciado, si ya existe. */
const evacMap = (base: World, r: Rescue): World | undefined =>
  base.siteMaps.find((m) => m.siteId === r.siteId)?.world;

/** ¿Viene alguien de camino al punto? */
const someoneComing = (base: World, r: Rescue) =>
  base.common.expedition.travels.some((t) => t.kind === 'go' && t.siteId === r.siteId);

/** Un punto del borde `side` que se pisa, al azar (con el azar de los zombis). */
function edgePoint(w: World, side: MapSide): Point | null {
  const { width, height } = w.grid;
  for (let k = 0; k < 40; k++) {
    const along = nextInt(w.zombieRng, 0, (side < 2 ? width : height) - 1);
    const depth = nextInt(w.zombieRng, 0, HORDE_SPAWN_DEPTH);
    const p =
      side === 0
        ? { x: along, y: depth }
        : side === 1
          ? { x: along, y: height - 1 - depth }
          : side === 2
            ? { x: depth, y: along }
            : { x: width - 1 - depth, y: along };
    if (isZombieWalkable(w.grid, p.x, p.y)) return p;
  }
  return null;
}

/**
 * Aterriza con gente delante (§3): mucho ruido (todos los zombis del mapa van hacia la zona) y una
 * horda por un borde al azar, también hacia ella.
 */
function land(map: World, r: Rescue): void {
  r.landed = true;
  const zone = map.evacZone!;
  const goal = zoneCenter(zone);
  const level = ZOMBIE_LEVEL_MULT[map.zombieLevel];
  const size = Math.round(nextInt(map.zombieRng, EVAC_HORDE[0], EVAC_HORDE[1]) * level);
  const side = nextInt(map.zombieRng, 0, 3) as MapSide;
  for (let k = 0; k < size; k++) {
    const p = edgePoint(map, side);
    if (!p) break;
    const z = newZombie(map, p);
    z.state = 'alert';
    z.goal = { x: Math.floor(goal.x), y: Math.floor(goal.y) };
    z.lastSeenAt = map.tick;
    map.zombies.push(z);
  }
  makeNoise(map, goal, Math.max(map.grid.width, map.grid.height) * 2);
  logEvent(map, { kind: 'heliArrived' });
}

/** Sube al helicóptero: se salva (sale del mapa con lo suyo). */
function board(map: World, r: Rescue, s: Survivor): void {
  leaveByAir(map, s);
  r.boarded.push({ id: s.id, name: s.name });
  (map.common.rescued ??= []).push({ id: s.id, name: s.name, day: gameTime(map.tick).day });
  logEvent(map, { kind: 'boarded', name: s.name });
}

/**
 * Se va (§4): al registro, con quiénes; lo escuchado vuelve a 0 (puede anunciarse otro). Si se ha
 * salvado alguien: sin nadie más en la colonia, el final; si queda gente, ¿ver el final o seguir?
 */
function leave(base: World, r: Rescue): void {
  const names = r.boarded.map((b) => b.name);
  const ids = r.boarded.map((b) => b.id);
  logEvent(evacMap(base, r) ?? base, { kind: 'heliLeft', names });
  Object.assign(r, {
    heard: 0,
    stage: 0,
    hex: null,
    siteId: null,
    from: null,
    until: null,
    landed: false,
    boarded: [],
  } satisfies Rescue);
  if (ids.length === 0) return;
  if (allColonists(base).length === 0) endGame(base, true);
  else addDecision(base, 'rescued', ids, {}, Number.MAX_SAFE_INTEGER - base.tick);
}

/**
 * Cada tick, desde la base (§3): a su hora llega el helicóptero; con gente en el mapa del punto,
 * aterriza (y luego hace ruido de vez en cuando); quien pisa la zona sube; se va al acabar la
 * espera, o antes si ya no queda nadie en el mapa ni de camino.
 */
export function rescueSystem(base: World): void {
  const r = base.common.rescue;
  if (base.common.over || r?.stage !== 3 || r.from === null || r.until === null) return;
  if (base.tick < r.from) return;
  const map = evacMap(base, r);
  if (base.tick >= r.until) return leave(base, r);
  if (!map || map.survivors.length === 0) {
    if (r.landed && !someoneComing(base, r)) leave(base, r);
    return;
  }
  if (!r.landed) land(map, r);
  else if ((base.tick - r.from) % HELI_NOISE_TICKS === 0)
    makeNoise(map, zoneCenter(map.evacZone!), Math.max(map.grid.width, map.grid.height));
  const zone = heliZone(map);
  if (!zone) return;
  for (const s of [...map.survivors]) if (inZone(zone, s.pos)) board(map, r, s);
  if (map.survivors.length === 0 && !someoneComing(base, r)) leave(base, r);
}

/** «Se han salvado…»: 0, ver el final (victoria); 1, seguir con los que quedan (por defecto). */
export function resolveRescued(w: World, _d: Decision, option: number): void {
  if (option === 0 && !w.common.over) endGame(w, true);
}
