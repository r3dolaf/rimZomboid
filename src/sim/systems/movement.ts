import {
  CARRY_SPEED,
  CRISIS_TICKS,
  EAT_TICKS,
  IDLE_TICKS_MAX,
  IDLE_TICKS_MIN,
  NOISE,
  RUN_NOISE_TICKS,
  SEARCH_TICKS,
  SURVIVOR_RUN_SPEED,
  SURVIVOR_WALK_SPEED,
  UNLOAD_TICKS,
} from '../balance';
import { legFactor } from '../body';
import { tryStartConsoling } from '../consoling';
import { startBuildActivity } from '../jobs/build';
import { startChopActivity } from '../jobs/chop';
import { startHaulActivity } from '../jobs/haul';
import { startHealActivity } from '../jobs/heal';
import { startPainkillerActivity, takeBandages, takePainkiller } from '../jobs/medical';
import { startCraftActivity } from '../jobs/craft';
import { startPryActivity } from '../jobs/pry';
import { startSwapWeapon } from '../jobs/weapons';
import { logEvent } from '../log';
import { makeNoise } from '../noise';
import { loadFactor, practice, workSpeed } from '../skills';
import { weightOf } from '../items';
import { isWalkable } from '../map/grid';
import { findPath } from '../path/astar';
import { nextInt } from '../rng';
import type { Action, Activity, Grid, Survivor, World } from '../types';
import { tileOf } from '../world';

/** Mueve a cada superviviente hacia el centro de la siguiente casilla de su camino. */
export function movementSystem(w: World): void {
  for (const s of w.survivors) {
    if (s.action.type !== 'moveTo') continue;
    const run = s.action.run === true;
    // Con alguien en brazos (Sanar, H4e), más despacio.
    const speed =
      (run ? SURVIVOR_RUN_SPEED : SURVIVOR_WALK_SPEED) * (s.carryingId !== null ? CARRY_SPEED : 1);
    const step = walkStep(s, w.grid, speed);
    if (step === 'walking' && weightOf(s.carrying) > 0) practice(w, s, 'haul', 1);
    // Quien corre hace ruido (spec H4b §3).
    if (run && step === 'walking' && w.tick % RUN_NOISE_TICKS === 0) makeNoise(w, s.pos, NOISE.run);
    if (step === 'walking') continue;
    // Sin camino (un muro recién hecho en su destino): vuelve a decidir.
    if (step === 'blocked') {
      s.action = { type: 'idle', ticksLeft: 0 };
      continue;
    }
    s.action = s.action.then
      ? startActivity(s, s.action.then, w)
      : { type: 'idle', ticksLeft: nextInt(w.rng, IDLE_TICKS_MIN, IDLE_TICKS_MAX) };
  }
}

/**
 * Avanza un tick por su camino: `arrived` si ya no le quedaban casillas, `blocked` si se ha
 * quedado sin camino. Si la siguiente casilla ha dejado de pisarse (un muro recién hecho), busca
 * otro camino al mismo sitio, empezando por volver al centro de la casilla en la que está.
 */
export function walkStep(
  s: Survivor,
  g: Grid,
  speed = SURVIVOR_WALK_SPEED,
): 'walking' | 'arrived' | 'blocked' {
  let next = s.path[0];
  if (next === undefined) return 'arrived';
  if (!isWalkable(g, next.x, next.y)) {
    const here = tileOf(s.pos);
    const rest = findPath(g, here, s.path[s.path.length - 1]!);
    if (rest === null) {
      s.path = [];
      return 'blocked';
    }
    s.path = [here, ...rest];
    next = here;
  }
  const tx = next.x + 0.5;
  const ty = next.y + 0.5;
  const dx = tx - s.pos.x;
  const dy = ty - s.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy); // sqrt es exacto en todos los navegadores; hypot no
  speed *= loadFactor(s) * legFactor(s); // ir cargado frena (spec H4c §3.3), y las piernas heridas (H5)
  if (dist <= speed) {
    s.pos = { x: tx, y: ty };
    s.path.shift();
  } else {
    s.pos = {
      x: s.pos.x + (dx / dist) * speed,
      y: s.pos.y + (dy / dist) * speed,
    };
  }
  return 'walking';
}

/** Lo que empieza a hacer al llegar a su destino. */
function startActivity(s: Survivor, activity: Activity, w: World): Action {
  switch (activity.type) {
    case 'eat':
      return { type: 'eat', ticksLeft: EAT_TICKS };
    case 'crisis':
      logEvent(w, { kind: 'crisis', survivorId: s.id });
      return { type: 'crisis', ticksLeft: CRISIS_TICKS };
    case 'search':
      // Con más habilidad, antes (spec H4c §3.4).
      return {
        type: 'search',
        containerId: activity.containerId,
        ticksLeft: Math.round(SEARCH_TICKS / workSpeed(s, 'loot')),
      };
    case 'unload':
      return { type: 'unload', ticksLeft: UNLOAD_TICKS };
    case 'takeAxe':
    case 'storeAxe':
    case 'chop':
      return startChopActivity(s, w, activity);
    case 'pickUp':
    case 'fetchWood':
    case 'deliver':
      return startHaulActivity(s, w, activity);
    case 'build':
      return startBuildActivity(s, w, activity.blueprintId);
    case 'swapWeapon':
      return startSwapWeapon(s, w);
    case 'takeCrowbar':
    case 'pry':
      return startPryActivity(s, w, activity);
    case 'fetchCraft':
    case 'craft':
      return startCraftActivity(s, w, activity);
    case 'rescue':
    case 'dropOff':
    case 'bandage':
      return startHealActivity(s, w, activity);
    case 'takeBandages':
      takeBandages(s, w);
      return { type: 'idle', ticksLeft: 0 };
    case 'takePainkiller':
      takePainkiller(s, w);
      return { type: 'idle', ticksLeft: 0 };
    case 'fetchPainkiller':
    case 'givePainkiller':
      return startPainkillerActivity(s, w, activity);
    case 'rest':
      return { type: 'rest' };
    case 'console':
      // Si se ha movido o está ocupado, vuelve a decidir (y a acercarse) en el siguiente tick.
      return tryStartConsoling(w, s, activity.otherId) ? s.action : { type: 'idle', ticksLeft: 0 };
    case 'sleep': {
      const bed = w.beds.find((b) => b.id === s.bedId);
      const t = tileOf(s.pos);
      return { type: 'sleep', inBed: bed !== undefined && bed.pos.x === t.x && bed.pos.y === t.y };
    }
  }
}
