// La amputación (spec B1): tras un mordisco en un brazo o una pierna, la decisión de cortarlo a
// tiempo (con algo que corte y vendas) para que no mate la infección, a cambio de perderlo.
import {
  AMPUTATE_BANDAGES,
  AMPUTATE_BLOOD,
  AMPUTATE_DOWN_HOURS,
  AMPUTATE_HOURS,
  AMPUTATE_OK_BASE,
  AMPUTATE_OK_PER_LEVEL,
  CUTTING_TOOLS,
  TICKS_PER_HOUR,
} from './balance';
import { has, spend } from './bags';
import { addDecision } from './decisions';
import { logEvent } from './log';
import { addMemory } from './mood';
import { nextFloat } from './rng';
import type { BodyPart, Decision, Survivor, World } from './types';

/** Lo que se puede amputar. */
export const LIMBS: readonly BodyPart[] = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

/** ¿Le falta esa parte? */
export const isMissing = (s: Survivor, part: BodyPart): boolean =>
  s.missing?.includes(part) ?? false;

/** ¿Hay algo para cortar en el mapa (en la mano o encima de alguien, o en el almacén)? */
export function hasCutter(w: World): boolean {
  return CUTTING_TOOLS.some(
    (k) => w.storage.items[k] > 0 || w.survivors.some((s) => s.equipped === k || has(s, k) > 0),
  );
}

/** Las vendas que hay en el mapa (almacén y lo que llevan encima). */
export const bandagesAt = (w: World): number =>
  w.storage.items.bandage + w.survivors.reduce((n, s) => n + has(s, 'bandage'), 0);

/** Lo que falta para amputar ahora: algo para cortar o vendas (`null`: se puede). */
export function amputationBlock(w: World): 'cutter' | 'bandages' | null {
  if (!hasCutter(w)) return 'cutter';
  if (bandagesAt(w) < AMPUTATE_BANDAGES) return 'bandages';
  return null;
}

/** Tras un mordisco en un brazo o una pierna de un colono: la decisión (una por persona y parte). */
export function offerAmputation(w: World, s: Survivor, part: BodyPart): void {
  if (!LIMBS.includes(part) || isMissing(s, part)) return;
  if (
    w.decisions.some((d) => d.kind === 'amputate' && d.survivorIds[0] === s.id && d.part === part)
  )
    return;
  addDecision(w, 'amputate', [s.id], { part }, AMPUTATE_HOURS * TICKS_PER_HOUR);
}

/** Gasta `n` vendas: del almacén y, si no hay bastantes, de lo que llevan encima. */
function spendBandages(w: World, n: number): void {
  let left = n;
  const fromStore = Math.min(left, w.storage.items.bandage);
  w.storage.items.bandage -= fromStore;
  left -= fromStore;
  for (const s of w.survivors) if (left > 0) left -= spend(s, 'bandage', left);
}

/** El mejor nivel de Sanar del mapa. */
const bestHealer = (w: World) => Math.max(0, ...w.survivors.map((s) => s.skills.heal.level));

/**
 * 0: amputar (si aún se puede: vivo, con la parte y con lo necesario); 1: no. Al amputar, pierde la
 * parte para siempre, cae derribado, pierde sangre y, si la infección venía de ahí, se cura.
 */
export function resolveAmputation(w: World, d: Decision, option: number): void {
  const s = w.survivors.find((x) => x.id === d.survivorIds[0]);
  const part = d.part;
  if (option !== 0 || !s || !part || isMissing(s, part) || amputationBlock(w)) return;
  spendBandages(w, AMPUTATE_BANDAGES);
  const ok = nextFloat(w.rng) < AMPUTATE_OK_BASE + AMPUTATE_OK_PER_LEVEL * bestHealer(w);
  s.missing = [...(s.missing ?? []), part];
  s.wounds = s.wounds.filter((wd) => wd.part !== part);
  s.blood = Math.max(0, s.blood - (ok ? AMPUTATE_BLOOD.ok : AMPUTATE_BLOOD.bad));
  s.action = { type: 'downed', until: w.tick + AMPUTATE_DOWN_HOURS * TICKS_PER_HOUR };
  s.path = [];
  s.drafted = false;
  if (s.infection?.part === part) {
    s.infection = null;
    if (s.fever?.cause === 'infection') {
      s.fever = null;
      w.mercy = w.mercy.filter((id) => id !== s.id);
      // Sus avisos de fiebre sin contestar (sin importar `illness`: se cargaría en círculo).
      w.decisions = w.decisions.filter((x) => x.kind !== 'fever' || x.survivorIds[0] !== s.id);
    }
  }
  const arm = part === 'leftArm' || part === 'rightArm';
  addMemory(s, arm ? 'lostArm' : 'lostLeg', w.tick);
  for (const o of w.survivors) if (o !== s) addMemory(o, 'sawAmputation', w.tick);
  logEvent(w, { kind: 'amputated', survivorId: s.id, part, ok });
}
