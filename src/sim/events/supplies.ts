// Provisiones en la puerta (H6c §2.8): alguien deja unas latas, y a veces vendas, en la base.
import {
  SUPPLIES_BANDAGE_CHANCE,
  SUPPLIES_BANDAGES_MAX,
  SUPPLIES_BANDAGES_MIN,
  SUPPLIES_COOLDOWN_DAYS,
  SUPPLIES_FOOD_MAX,
  SUPPLIES_FOOD_MIN,
} from '../balance';
import { logEvent } from '../log';
import { nextFloat, nextInt } from '../rng';
import type { GameEvent } from './types';

export const suppliesEvent: GameEvent = {
  id: 'supplies',
  tone: 'good',
  cooldownDays: SUPPLIES_COOLDOWN_DAYS,
  canHappen: (w) => w.survivors.length > 0,
  happen(w) {
    const food = nextInt(w.rng, SUPPLIES_FOOD_MIN, SUPPLIES_FOOD_MAX);
    const bandage =
      nextFloat(w.rng) < SUPPLIES_BANDAGE_CHANCE
        ? nextInt(w.rng, SUPPLIES_BANDAGES_MIN, SUPPLIES_BANDAGES_MAX)
        : 0;
    w.storage.items.food += food;
    w.storage.items.bandage += bandage;
    logEvent(w, { kind: 'supplies', food, bandage });
  },
};
