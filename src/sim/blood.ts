// La sangre y la curación (spec H5 §2.2 y §3): las heridas sangran (el arañazo para solo), se
// curan poco a poco y la sangre baja o se recupera; desnutrido, también baja.
import {
  BLOOD_REGEN,
  CLEAN_BANDAGE_HEAL,
  REST_HEAL,
  STARVING_BLOOD,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  WOUNDS,
} from './balance';
import { partHp } from './body';
import type { Survivor, World } from './types';

/** ¿Está descansando? (Durmiendo, o derribado en una cama.) Cura y recupera el doble. */
function resting(s: Survivor): boolean {
  const a = s.action;
  return a.type === 'sleep' || (a.type === 'downed' && a.inBed === true);
}

/**
 * Un tick de sus heridas y su sangre: sangrar, dejar de sangrar, curarse; recuperar o perder
 * sangre. Si llega a 0 de sangre o se queda sin cabeza o sin torso, lo apunta en `dying`.
 */
export function bloodTick(w: World, s: Survivor): void {
  // Sin cabeza o sin torso no se vive (antes de que la curación de este tick lo disimule).
  if (partHp(s, 'head') <= 0 || partHp(s, 'torso') <= 0) s.dying = 'wounds';
  const rest = resting(s);
  let bleed = 0;
  for (const wd of s.wounds) {
    const spec = WOUNDS[wd.kind];
    if (wd.bleeding) {
      bleed += spec.bleed;
      // Tras sangrar su última hora (este tick incluido), para.
      if (spec.stopsHours !== null && w.tick + 1 - wd.at >= spec.stopsHours * TICKS_PER_HOUR)
        wd.bleeding = false;
    }
    const mult = (wd.cleanUntil > w.tick ? CLEAN_BANDAGE_HEAL : 1) * (rest ? REST_HEAL : 1);
    wd.damage = Math.max(0, wd.damage - (wd.size * mult) / (spec.healDays * TICKS_PER_DAY));
  }
  s.wounds = s.wounds.filter((wd) => wd.damage > 0);

  const starving = s.needs.hunger <= 0;
  let perHour = 0;
  if (bleed > 0) perHour -= bleed;
  if (starving) perHour -= STARVING_BLOOD;
  if (bleed === 0 && !starving) perHour += rest ? BLOOD_REGEN.rest : BLOOD_REGEN.awake;
  s.blood = Math.max(0, Math.min(100, s.blood + perHour / TICKS_PER_HOUR));

  if (s.blood <= 0 && !s.dying) s.dying = bleed > 0 || !starving ? 'blood' : 'hunger';
}
