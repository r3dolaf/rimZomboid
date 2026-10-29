import { checkInvariants } from '../sim/invariants';
import { stepGame } from '../sim/game';
import type { World } from '../sim/types';

/**
 * Avanza la simulación `ticks` veces. Con `onProblems` (en desarrollo) comprueba las invariantes
 * tras cada tick; al primer fallo avisa y se detiene, para conservar el estado roto.
 */
export function runTicks(w: World, ticks: number, onProblems?: (problems: string[]) => void): void {
  for (let i = 0; i < ticks; i++) {
    stepGame(w); // la base y los sitios con gente (H5c1)
    if (!onProblems) continue;
    const problems = checkInvariants(w);
    if (problems.length > 0) {
      onProblems(problems);
      return;
    }
  }
}
