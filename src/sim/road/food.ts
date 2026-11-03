// La comida del viaje (spec H5c3 §3): cuántas latas por persona hacen falta para unas horas de ruta.
import { EAT_RESTORE, HUNGER_PER_DAY, TRAVEL_DAY, TRIP_FOOD_MARGIN } from '../balance';

/**
 * Las latas por persona para `hours` horas de ruta (de ida, o de ida y vuelta): se anda solo de día,
 * pero se come también de noche; más una de margen.
 */
export function tripFood(hours: number, roundTrip: boolean): number {
  const light = TRAVEL_DAY[1] - TRAVEL_DAY[0];
  const days = Math.ceil(Math.max(0, hours) / light);
  return Math.ceil((days * (roundTrip ? 2 : 1) * HUNGER_PER_DAY) / EAT_RESTORE) + TRIP_FOOD_MARGIN;
}
