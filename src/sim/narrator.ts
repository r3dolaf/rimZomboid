// El narrador (spec H3c §2): mira cómo va la colonia y decide cuándo y de qué tono pasan cosas.
import {
  CALM_DAYS_MAX,
  CALM_DAYS_MIN,
  CALM_NO_BAD_BELOW,
  CHAOTIC_DOUBLE_CHANCE,
  EVENT_GAP,
  EVENT_RETRY_TICKS,
  GENTLE_BELOW,
  HARSH_ABOVE,
  RESPITE_BELOW,
  TENSION_BREAK_BELOW,
  TENSION_DAYS_MAX,
  TENSION_DAYS_MIN,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  TONE_WEIGHTS,
  WELLBEING_FOOD_DAYS,
  WELLBEING_WEIGHTS,
} from './balance';
import { foodDays } from './colony';
import { CATALOG } from './events/catalog';
import { expireDecisions } from './events/resolve';
import type { GameEvent } from './events/types';
import { nextFloat, nextInt, weightedPick } from './rng';
import { opinionOf } from './social';
import type { Tone, World } from './types';

/** Bienestar de la colonia, de 0 a 100: ánimo, opinión media y días de comida. */
export function wellbeing(w: World): number {
  const ss = w.survivors;
  if (ss.length === 0) return 50;
  const mood = ss.reduce((acc, s) => acc + s.needs.mood, 0) / ss.length;
  let sum = 0;
  let pairs = 0;
  for (const s of ss)
    for (const o of ss)
      if (o !== s) {
        sum += opinionOf(s, o.id);
        pairs++;
      }
  const opinion = pairs === 0 ? 50 : (sum / pairs + 100) / 2;
  const foodScore = Math.min(1, foodDays(w) / WELLBEING_FOOD_DAYS) * 100;
  const k = WELLBEING_WEIGHTS;
  return k.mood * mood + k.opinion * opinion + k.food * foodScore;
}

/** Decisiones caducadas, fases del Equilibrado, el siguiente suceso y, si toca, el suceso. */
export function narratorSystem(w: World, catalog: readonly GameEvent[] = CATALOG): void {
  if (w.over) return; // H5 §9: sin nadie, no pasa nada más
  expireDecisions(w);
  const n = w.narrator;
  if (n.style === 'balanced') {
    const breaks =
      n.phase === 'tension' && w.tick % TICKS_PER_HOUR === 0 && wellbeing(w) < TENSION_BREAK_BELOW;
    if (w.tick >= n.phaseEndsAt || breaks) switchPhase(w);
  }
  if (w.tick < n.nextEventAt) return;

  const ev = chooseEvent(w, catalog);
  if (!ev) {
    n.nextEventAt = w.tick + EVENT_RETRY_TICKS;
    return;
  }
  ev.happen(w);
  n.lastAt[ev.id] = w.tick;
  n.nextEventAt =
    n.style === 'chaotic' && nextFloat(w.rng) < CHAOTIC_DOUBLE_CHANCE
      ? w.tick + TICKS_PER_HOUR
      : w.tick + gap(w);
}

function switchPhase(w: World): void {
  const n = w.narrator;
  const toTension = n.phase === 'calm';
  n.phase = toTension ? 'tension' : 'calm';
  const [min, max] = toTension
    ? [TENSION_DAYS_MIN, TENSION_DAYS_MAX]
    : [CALM_DAYS_MIN, CALM_DAYS_MAX];
  n.phaseEndsAt = w.tick + nextInt(w.rng, min * TICKS_PER_DAY, max * TICKS_PER_DAY);
  // Si el siguiente suceso queda más lejos que el ritmo de la nueva fase, se adelanta.
  n.nextEventAt = Math.min(n.nextEventAt, w.tick + gap(w));
}

/** Ticks hasta el siguiente suceso, según el estilo y la fase. */
function gap(w: World): number {
  const n = w.narrator;
  const [min, max] =
    n.style === 'calm'
      ? EVENT_GAP.calm
      : n.style === 'chaotic'
        ? EVENT_GAP.chaotic
        : n.phase === 'tension'
          ? EVENT_GAP.balancedTension
          : EVENT_GAP.balancedCalm;
  return nextInt(w.rng, min, max);
}

/** El tono que busca ahora el narrador. */
function wantedTone(w: World, wb: number): Tone {
  const n = w.narrator;
  if (n.style === 'chaotic') return weightedPick(w.rng, { ...TONE_WEIGHTS.chaotic });
  if (n.style === 'calm') {
    const weights: Record<Tone, number> = { ...TONE_WEIGHTS.calm };
    if (wb < CALM_NO_BAD_BELOW) weights.bad = 0;
    return weightedPick(w.rng, weights);
  }
  if (n.phase === 'tension') return 'bad';
  if (wb < RESPITE_BELOW) return 'good';
  return weightedPick(w.rng, { ...TONE_WEIGHTS.balancedCalm });
}

/** Si no hay del tono buscado, el más cercano. */
const FALLBACK: Record<Tone, readonly Tone[]> = {
  good: ['good', 'mixed', 'bad'],
  bad: ['bad', 'mixed', 'good'],
  mixed: ['mixed', 'good', 'bad'],
};

/** Elige un suceso que se pueda dar (requisitos y espera), o `null`. */
export function chooseEvent(w: World, catalog: readonly GameEvent[]): GameEvent | null {
  const wb = wellbeing(w);
  const ready = catalog.filter((e) => {
    const last = w.narrator.lastAt[e.id];
    return (
      (last === undefined || w.tick - last >= e.cooldownDays * TICKS_PER_DAY) && e.canHappen(w)
    );
  });
  const harsh = w.narrator.style === 'balanced' && w.narrator.phase === 'tension';
  // El Tranquilo con la colonia mal y el respiro del Equilibrado nunca dan uno malo, ni de plan B:
  // si no hay buenos ni mixtos, se reintenta en 1 h.
  const n = w.narrator;
  const noBad =
    (n.style === 'calm' && wb < CALM_NO_BAD_BELOW) ||
    (n.style === 'balanced' && n.phase === 'calm' && wb < RESPITE_BELOW);
  const tones = FALLBACK[wantedTone(w, wb)].filter((t) => !(noBad && t === 'bad'));
  for (const tone of tones) {
    const options = ready.filter((e) => e.tone === tone);
    if (options.length === 0) continue;
    if (options.length === 1) return options[0]!;
    const weights: Record<string, number> = {};
    for (const [i, e] of options.entries()) {
      const s = e.severity ?? 1;
      weights[i] = !harsh ? 1 : wb >= HARSH_ABOVE ? s : wb < GENTLE_BELOW ? 4 - s : 1;
    }
    return options[Number(weightedPick(w.rng, weights))]!;
  }
  return null;
}
