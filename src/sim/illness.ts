// La fiebre (spec H5 §7): la infección oculta y la gripe del narrador se ven igual — la misma
// fiebre, las mismas náuseas, los mismos avisos. Solo la infección mata.
import {
  FEVER_HUNGER_MULT,
  FLU_BAD_LUCK,
  FLU_DAYS,
  FLU_GRAVE_HOURS,
  FLU_GRAVE_REST,
  FLU_NAUSEA_HOURS,
  FLU_NAUSEA_REST,
  FLU_REST_DAYS,
  GRAVE_HOURS,
  INFECTION_FEVER_HOURS,
  INFECTION_NAUSEA_HOURS,
  NAUSEA_HUNGER_MULT,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
} from './balance';
import { knockDown } from './body';
import { banish } from './death';
import { addDecision } from './decisions';
import { lyingDown } from './jobs/medical';
import { logEvent } from './log';
import { nextFloat } from './rng';
import type { Decision, Fever, Survivor, World } from './types';

const H = TICKS_PER_HOUR;

const colonist = (w: World, s: Survivor) => w.survivors.includes(s);

/** Cuánto más rápido le baja el hambre: con fiebre ×1,3; con náuseas, ×2. */
export function feverHunger(s: Survivor): number {
  if (!s.fever) return 1;
  return s.fever.stage === 'fever' ? FEVER_HUNGER_MULT : NAUSEA_HUNGER_MULT;
}

/** Quita sus avisos de fiebre sin contestar. */
function dropFeverDecisions(w: World, s: Survivor): void {
  w.decisions = w.decisions.filter((d) => d.kind !== 'fever' || d.survivorIds[0] !== s.id);
}

/**
 * Empieza la fiebre (de gripe o de infección; desde fuera no se distingue): aviso "tiene fiebre" y
 * al registro. Si ya tenía fiebre de gripe y es la infección, la fiebre pasa a ser de infección.
 */
export function startFever(w: World, s: Survivor, cause: Fever['cause']): void {
  if (s.fever) {
    if (cause === 'infection' && s.fever.cause === 'flu') {
      s.fever.cause = 'infection';
      if (s.fever.stage === 'grave') s.fever.stage = 'nausea'; // lo de la gripe ya no cuenta
      delete s.fever.graveUntil;
    }
    return;
  }
  // La mala suerte solo cuenta para la gripe, pero se sortea siempre: así ni el azar las distingue.
  const badLuck = nextFloat(w.rng) < FLU_BAD_LUCK;
  s.fever = { cause, since: w.tick, stage: 'fever', rest: false, restTicks: 0, badLuck, checks: 0 };
  if (!colonist(w, s)) return;
  addDecision(w, 'fever', [s.id]);
  logEvent(w, { kind: 'fever', survivorId: s.id });
}

/** Náuseas: aviso "está peor" (en lugar del que hubiera sin contestar). */
function worsen(w: World, s: Survivor, f: Fever): void {
  f.stage = 'nausea';
  if (!colonist(w, s)) return;
  dropFeverDecisions(w, s);
  addDecision(w, 'fever', [s.id], { worse: true });
  logEvent(w, { kind: 'feverWorse', survivorId: s.id });
}

/** Muy grave: derribado (la gripe, 6 h; la infección, hasta morir). */
function grave(w: World, s: Survivor, f: Fever): void {
  f.stage = 'grave';
  if (f.cause === 'flu') f.graveUntil = w.tick + GRAVE_HOURS * H;
  knockDown(w, s);
}

/** Se le pasa la gripe. */
function cure(w: World, s: Survivor): void {
  s.fever = null;
  w.mercy = w.mercy.filter((id) => id !== s.id); // curado, ya no hay sufrimiento que acabar
  if (!colonist(w, s)) return;
  dropFeverDecisions(w, s);
  logEvent(w, { kind: 'feverGone', survivorId: s.id });
}

/** La gripe: náuseas a las 12 h, muy grave a las 36, curada a los 2 o 4 días según descanse. */
function fluTick(w: World, s: Survivor, f: Fever): void {
  const t = w.tick - f.since;
  const rested = t > 0 ? f.restTicks / t : 1;
  if (f.stage === 'grave' && f.graveUntil !== undefined && w.tick >= f.graveUntil) {
    f.stage = 'nausea';
    delete f.graveUntil;
  }
  if (f.checks === 0 && t >= FLU_NAUSEA_HOURS * H) {
    f.checks = 1;
    if (rested < FLU_NAUSEA_REST || f.badLuck) worsen(w, s, f);
  }
  if (f.checks === 1 && t >= FLU_GRAVE_HOURS * H) {
    f.checks = 2;
    if (rested < FLU_GRAVE_REST) grave(w, s, f);
  }
  if (f.checks === 2 && t >= FLU_REST_DAYS * TICKS_PER_DAY) {
    f.checks = 3;
    if (rested >= FLU_NAUSEA_REST && f.stage !== 'grave') return cure(w, s);
  }
  if (t >= FLU_DAYS * TICKS_PER_DAY && f.stage !== 'grave') cure(w, s);
}

/** La infección: fiebre a las 12 h, náuseas a las 24, muy grave 6 h antes de morir; muere. */
function infectionTick(w: World, s: Survivor, inf: NonNullable<Survivor['infection']>): void {
  if (w.tick >= inf.deathAt) {
    s.dying ??= 'infection';
    return;
  }
  const t = w.tick - inf.at;
  if (t < INFECTION_FEVER_HOURS * H) return;
  startFever(w, s, 'infection');
  const f = s.fever!;
  if (t >= INFECTION_NAUSEA_HOURS * H && f.stage === 'fever') worsen(w, s, f);
  if (w.tick >= inf.deathAt - GRAVE_HOURS * H && f.stage !== 'grave') grave(w, s, f);
}

/** Antes de la salud: avanzan la gripe y la infección; cuenta el descanso de quien lo tiene mandado. */
export function illnessSystem(w: World): void {
  for (const s of [...w.survivors, ...(w.stranger?.survivors ?? [])]) {
    if (s.infection) infectionTick(w, s, s.infection);
    if (s.fever?.cause === 'flu') fluTick(w, s, s.fever);
    if (s.fever?.rest && lyingDown(s)) s.fever.restTicks++;
  }
}

/** ¿Está tan grave que no puede levantarse? */
export const tooIllToStand = (s: Survivor) => s.fever?.stage === 'grave';

/**
 * El aviso de fiebre: 0, Que descanse (por defecto); 1, Que se vaya; 2, Acabar con su
 * sufrimiento (H5 §7.4).
 */
export function resolveFever(w: World, d: Decision, option: 0 | 1 | 2): void {
  const s = w.survivors.find((x) => x.id === d.survivorIds[0]);
  if (!s?.fever) return;
  if (option === 0) {
    w.mercy = w.mercy.filter((id) => id !== s.id); // que descanse en vez de lo otro
    if (s.fever.rest) return;
    s.fever.rest = true;
    logEvent(w, { kind: 'feverRest', survivorId: s.id });
  } else if (option === 1) banish(w, s);
  else if (!w.mercy.includes(s.id)) w.mercy.push(s.id);
}
