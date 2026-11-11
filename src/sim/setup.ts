// El comienzo y los ajustes a medida de la partida (spec C2): de dónde sale cada cifra que cambian.
import { LOOT_SCALED, SETUP_COLD, SETUP_MULT, WOUNDS } from './balance';
import type { Inventory } from './items';
import type { GameSetup, World, WoundKind } from './types';

/** El pueblo, todo normal: la partida de siempre. */
export const DEFAULT_SETUP: GameSetup = {
  scenario: 'town',
  infection: 'normal',
  loot: 'normal',
  sieges: 'normal',
  needs: 'normal',
  cold: 'normal',
};

/** El de la partida (las de antes, sin él: el pueblo, todo normal). */
export const setupOf = (w: World): GameSetup => w.common.setup ?? DEFAULT_SETUP;

/** La probabilidad de que una herida infecte: el mordisco, siempre; lo demás, según el ajuste. */
export function infectChance(w: World, kind: WoundKind): number {
  const base = WOUNDS[kind].infect;
  if (base >= 1) return base;
  return Math.min(1, base * SETUP_MULT.infection[setupOf(w).infection]);
}

/** Cuánto botín (comida, vendas, medicinas y agua). */
export const lootMult = (w: World): number => SETUP_MULT.loot[setupOf(w).loot];

/** Cuánto más (o menos) bajan el hambre y la sed. */
export const needsMult = (w: World): number => SETUP_MULT.needs[setupOf(w).needs];

/** Grados de más o de menos fuera. */
export const coldShift = (w: World): number => SETUP_COLD[setupOf(w).cold];

/** El botín de un inventario según el ajuste, redondeando (sin azar): lo de LOOT_SCALED. */
export function scaleLoot(inv: Inventory, mult: number): void {
  if (mult === 1) return;
  for (const k of LOOT_SCALED) inv[k] = Math.round(inv[k] * mult);
}
