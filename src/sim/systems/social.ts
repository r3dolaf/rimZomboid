import {
  BREAKUP_BELOW,
  BREAKUP_OPINION_LOSS,
  BUBBLE_TICKS,
  CHAT_EFFECTS,
  CHAT_EVERY_MAX,
  CHAT_EVERY_MIN,
  CHAT_RANGE,
  CHAT_RETRY_TICKS,
  FIGHT_CHANCE,
  FIGHT_OPINION,
  FIGHT_OPINION_LOSS,
  FIGHT_TICKS,
  ITEM_WEIGHT_KG,
  MOOD_EDGE,
  OPINION_DECAY_FRACTION,
  OPINION_DECAY_FRACTION_NEGATIVE,
  OPINION_DECAY_PER_DAY,
  PARTNER_CHANCE,
  PARTNER_OPINION,
  SHARE_HUNGER_BELOW,
  SHARE_OPINION,
  TICKS_PER_DAY,
} from '../balance';
import { weightOf } from '../items';
import { capacityKg } from '../skills';
import { logEvent } from '../log';
import { addMemory } from '../mood';
import { nextFloat, nextInt, weightedPick } from '../rng';
import {
  changeOpinion,
  chatWeights,
  isAvailable as available,
  opinionOf,
  type ChatKind,
} from '../social';
import type { BubbleKind, Survivor, World } from '../types';
import { computeFov } from '../vision';
import { tileOf } from '../world';

/** Charlas, globos, rupturas y el olvido diario de las opiniones. */
export function socialSystem(w: World): void {
  if (w.tick > 0 && w.tick % TICKS_PER_DAY === 0) decayOpinions(w);
  for (const s of w.survivors) {
    if (s.bubble && s.bubble.until <= w.tick) s.bubble = null;
    if (w.tick < s.nextChatAt || !available(s)) continue;
    const other = chatPartner(w, s);
    if (!other) {
      s.nextChatAt = w.tick + CHAT_RETRY_TICKS;
      continue;
    }
    applyChat(w, s, other, weightedPick(w.rng, chatWeights(s, other)));
    s.nextChatAt = w.tick + nextInt(w.rng, CHAT_EVERY_MIN, CHAT_EVERY_MAX);
    other.nextChatAt = w.tick + nextInt(w.rng, CHAT_EVERY_MIN, CHAT_EVERY_MAX);
  }
  for (const s of w.survivors) {
    const p = s.partnerId === null ? undefined : w.survivors.find((x) => x.id === s.partnerId);
    if (p && (opinionOf(s, p.id) < BREAKUP_BELOW || opinionOf(p, s.id) < BREAKUP_BELOW))
      breakUp(w, s, p);
  }
}

/** El más cercano que esté disponible, a CHAT_RANGE casillas o menos y a la vista. */
function chatPartner(w: World, s: Survivor): Survivor | null {
  const from = tileOf(s.pos);
  const near: { o: Survivor; d: number }[] = [];
  for (const o of w.survivors) {
    if (o === s || !available(o)) continue;
    const t = tileOf(o.pos);
    const d = (t.x - from.x) ** 2 + (t.y - from.y) ** 2;
    if (d <= CHAT_RANGE * CHAT_RANGE) near.push({ o, d });
  }
  if (near.length === 0) return null;
  near.sort((p, q) => p.d - q.d);
  const visible = new Set<number>();
  computeFov(w.grid, from.x, from.y, CHAT_RANGE, (x, y) => visible.add(y * w.grid.width + x));
  for (const { o } of near) {
    const t = tileOf(o.pos);
    if (visible.has(t.y * w.grid.width + t.x)) return o;
  }
  return null;
}

/** Aplica los efectos de una charla que `a` inicia con `b` (spec H3b §3 y §4). */
export function applyChat(w: World, a: Survivor, b: Survivor, kind: ChatKind): void {
  const e = CHAT_EFFECTS[kind];
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    changeOpinion(x, y.id, e.opinion);
    x.needs.social = Math.min(100, x.needs.social + e.social);
  }
  const bubble: BubbleKind = kind === 'argue' || kind === 'insult' ? 'argue' : 'chat';
  setBubble(w, a, bubble);
  setBubble(w, b, bubble);
  if (kind === 'pleasant') {
    addMemory(a, 'goodChat', w.tick, b.id);
    addMemory(b, 'goodChat', w.tick, a.id);
    maybeCouple(w, a, b);
  } else if (kind === 'argue') {
    addMemory(a, 'argued', w.tick, b.id);
    addMemory(b, 'argued', w.tick, a.id);
  } else if (kind === 'insult') {
    addMemory(b, 'insulted', w.tick, a.id);
    logEvent(w, { kind: 'insult', survivorId: a.id, otherId: b.id });
    maybeFight(w, a, b);
  }
  if (kind === 'pleasant' || kind === 'neutral') maybeShareFood(w, a, b);
}

/** Si `b` tiene hambre y `a` lleva comida y le cae bien, le da una lata. */
function maybeShareFood(w: World, a: Survivor, b: Survivor): void {
  if (b.needs.hunger >= SHARE_HUNGER_BELOW || a.carrying.food === 0) return;
  if (opinionOf(a, b.id) < 0) return;
  if (weightOf(b.carrying) + ITEM_WEIGHT_KG.food > capacityKg(b) + 1e-9) return;
  a.carrying.food--;
  b.carrying.food++;
  changeOpinion(a, b.id, SHARE_OPINION);
  changeOpinion(b, a.id, SHARE_OPINION);
  addMemory(b, 'sharedFood', w.tick, a.id);
  setBubble(w, a, 'share');
  logEvent(w, { kind: 'sharedFood', survivorId: a.id, otherId: b.id });
}

/** Tras un insulto: si son rivales y alguno está al límite, puede haber pelea. */
function maybeFight(w: World, a: Survivor, b: Survivor): void {
  const rivals = opinionOf(a, b.id) <= FIGHT_OPINION || opinionOf(b, a.id) <= FIGHT_OPINION;
  const edge = a.needs.mood < MOOD_EDGE || b.needs.mood < MOOD_EDGE;
  if (rivals && edge && nextFloat(w.rng) < FIGHT_CHANCE) startFight(w, a, b);
}

/** Los dos dejan lo que hacían y se pelean (spec H3b §4). */
export function startFight(w: World, a: Survivor, b: Survivor): void {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    x.action = { type: 'fight', otherId: y.id, ticksLeft: FIGHT_TICKS };
    x.path = [];
    changeOpinion(x, y.id, -FIGHT_OPINION_LOSS);
    addMemory(x, 'fought', w.tick, y.id);
    setBubble(w, x, 'fight');
  }
  logEvent(w, { kind: 'fight', survivorId: a.id, otherId: b.id });
}

/** Dos sin pareja que se tienen ≥ PARTNER_OPINION pueden hacerse pareja. */
function maybeCouple(w: World, a: Survivor, b: Survivor): void {
  if (a.partnerId !== null || b.partnerId !== null) return;
  if (opinionOf(a, b.id) < PARTNER_OPINION || opinionOf(b, a.id) < PARTNER_OPINION) return;
  if (nextFloat(w.rng) >= PARTNER_CHANCE) return;
  a.partnerId = b.id;
  b.partnerId = a.id;
  setBubble(w, a, 'love');
  setBubble(w, b, 'love');
  logEvent(w, { kind: 'couple', survivorId: a.id, otherId: b.id });
}

function breakUp(w: World, a: Survivor, b: Survivor): void {
  a.partnerId = null;
  b.partnerId = null;
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    changeOpinion(x, y.id, -BREAKUP_OPINION_LOSS);
    addMemory(x, 'breakup', w.tick, y.id);
  }
  logEvent(w, { kind: 'breakup', survivorId: a.id, otherId: b.id });
}

export function setBubble(w: World, s: Survivor, kind: BubbleKind): void {
  s.bubble = { kind, until: w.tick + BUBBLE_TICKS };
}

/** Cada opinión se acerca a 0 un OPINION_DECAY_FRACTION, y al menos OPINION_DECAY_PER_DAY. */
function decayOpinions(w: World): void {
  for (const s of w.survivors)
    for (const [id, v] of Object.entries(s.opinions)) {
      const fraction = v > 0 ? OPINION_DECAY_FRACTION : OPINION_DECAY_FRACTION_NEGATIVE;
      const step = Math.max(OPINION_DECAY_PER_DAY, Math.abs(v) * fraction);
      s.opinions[id] = Math.abs(v) <= step ? 0 : v - Math.sign(v) * step;
    }
}
