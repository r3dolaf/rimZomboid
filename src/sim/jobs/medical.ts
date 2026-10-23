// Vendas (spec H5 §4): cada uno lleva hasta 2; se venda lo que le sangra; Sanar venda a los demás
// (y al derribado antes de cargarlo); a 1 día la venda está sucia y se cambia.
import {
  BANDAGE_CLEAN_HOURS,
  BANDAGE_RANGE,
  BANDAGE_TICKS,
  BANDAGES_CARRIED,
  TICKS_PER_HOUR,
  WOUNDS,
} from '../balance';
import { armFactor } from '../body';
import { contains } from '../geom';
import { ITEM_KINDS } from '../items';
import { logEvent } from '../log';
import { regionOf } from '../path/astar';
import { pick } from '../rng';
import { practice, workSpeed } from '../skills';
import type { Action, Survivor, World, Wound } from '../types';
import { tileOf } from '../world';

const inBase = (w: World, s: Survivor) => contains(w.base.rect, tileOf(s.pos));

/** ¿Lleva algo que descargar? Todo cuenta salvo sus BANDAGES_CARRIED vendas. */
export function hasCargo(s: Survivor): boolean {
  return ITEM_KINDS.some((k) =>
    k === 'bandage' ? s.carrying.bandage > BANDAGES_CARRIED : s.carrying[k] > 0,
  );
}

/** ¿Llega al almacén desde donde está? */
function reachesStorage(w: World, s: Survivor): boolean {
  const here = tileOf(s.pos);
  const st = w.storage.tiles[0];
  return st !== undefined && regionOf(w.grid, here.x, here.y) === regionOf(w.grid, st.x, st.y);
}

const goTakeBandages = (w: World): Action => ({
  type: 'moveTo',
  target: pick(w.rng, w.storage.tiles),
  then: { type: 'takeBandages' },
});

/** En la base, con menos de 2 vendas encima y quedando en el almacén: a por ellas. */
export function stockJob(s: Survivor, w: World): Action | null {
  if (s.carrying.bandage >= BANDAGES_CARRIED || w.storage.items.bandage === 0) return null;
  return inBase(w, s) && reachesStorage(w, s) ? goTakeBandages(w) : null;
}

/** En el almacén: coge vendas hasta llevar BANDAGES_CARRIED. */
export function takeBandages(s: Survivor, w: World): void {
  const n = Math.min(BANDAGES_CARRIED - s.carrying.bandage, w.storage.items.bandage);
  if (n <= 0) return;
  w.storage.items.bandage -= n;
  s.carrying.bandage += n;
}

/** La herida que hay que atender: la que más sangra; si ninguna sangra, una con la venda sucia. */
export function woundToTend(s: Survivor, tick: number): Wound | null {
  let best: Wound | null = null;
  for (const wd of s.wounds)
    if (wd.bleeding && (!best || WOUNDS[wd.kind].bleed > WOUNDS[best.kind].bleed)) best = wd;
  return best ?? s.wounds.find((wd) => wd.cleanUntil > 0 && wd.cleanUntil <= tick) ?? null;
}

/** A quién va a vendar o está vendando, o `null`. */
export function bandageTargetId(s: Survivor): number | null {
  const a = s.action;
  if (a.type === 'bandage') return a.patientId;
  if (a.type === 'moveTo' && a.then?.type === 'bandage') return a.then.patientId;
  return null;
}

/** Empieza a vendar a `p` (él mismo también): la herida que toca, con su tiempo según Sanar. */
export function startBandage(w: World, healer: Survivor, p: Survivor): Action | null {
  const wd = woundToTend(p, w.tick);
  if (!wd) return null;
  const ticksLeft = Math.round(BANDAGE_TICKS / workSpeed(healer, 'heal'));
  return { type: 'bandage', patientId: p.id, woundId: wd.id, ticksLeft };
}

/**
 * Urgencia (después del peligro): si le sangra una herida, se venda allí mismo con las que lleva;
 * si no lleva, va al almacén a por ellas. `null`: ya está en ello; `undefined`: nada que hacer.
 */
export function selfCare(s: Survivor, w: World): Action | null | undefined {
  const a = s.action;
  if (a.type === 'bandage' && a.patientId === s.id) return null;
  if (a.type === 'moveTo' && a.then?.type === 'takeBandages') return null;
  if (armFactor(s) === 0 || !s.wounds.some((wd) => wd.bleeding)) return undefined;
  if (s.carrying.bandage > 0) return startBandage(w, s, s) ?? undefined;
  if (w.storage.items.bandage > 0 && reachesStorage(w, s)) return goTakeBandages(w);
  return undefined;
}

/** ¿Lo está vendando ya otro (o va a hacerlo)? */
const claimed = (w: World, p: Survivor, s: Survivor) =>
  w.survivors.some((o) => o !== s && o !== p && bandageTargetId(o) === p.id);

/**
 * Sanar: vendar o cambiar la venda a quien está en la base (él mismo también). Si no lleva vendas,
 * primero al almacén.
 */
export function bandageJob(s: Survivor, w: World): Action | null {
  if (armFactor(s) === 0) return null;
  let best: Survivor | null = null;
  let bestD = Infinity;
  for (const p of w.survivors) {
    if (!inBase(w, p) || !woundToTend(p, w.tick) || claimed(w, p, s)) continue;
    const d = (p.pos.x - s.pos.x) ** 2 + (p.pos.y - s.pos.y) ** 2;
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  if (!best) return null;
  if (s.carrying.bandage === 0) {
    return w.storage.items.bandage > 0 && reachesStorage(w, s) ? goTakeBandages(w) : null;
  }
  if (best === s) return startBandage(w, s, s);
  return {
    type: 'moveTo',
    target: tileOf(best.pos),
    then: { type: 'bandage', patientId: best.id },
  };
}

/** ¿Sigue teniendo sentido ir a vendarle? */
export function bandageStillWorth(s: Survivor, w: World, patientId: number): boolean {
  const p = w.survivors.find((x) => x.id === patientId);
  return p !== undefined && woundToTend(p, w.tick) !== null && !claimed(w, p, s);
}

/** Al llegar junto al herido: si sigue ahí y le hace falta, empieza a vendarle. */
export function startBandageActivity(s: Survivor, w: World, patientId: number): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  const p = w.survivors.find((x) => x.id === patientId);
  if (!p) return idle;
  const d2 = (p.pos.x - s.pos.x) ** 2 + (p.pos.y - s.pos.y) ** 2;
  return d2 <= BANDAGE_RANGE * BANDAGE_RANGE ? (startBandage(w, s, p) ?? idle) : idle;
}

/** Gasta una venda: la suya; si no, la del herido; si no, del almacén (si está en la base). */
function useBandage(w: World, healer: Survivor, p: Survivor): boolean {
  if (healer.carrying.bandage > 0) healer.carrying.bandage--;
  else if (p.carrying.bandage > 0) p.carrying.bandage--;
  else if (inBase(w, healer) && w.storage.items.bandage > 0) w.storage.items.bandage--;
  else return false;
  return true;
}

/** Vendando: aprende y, al terminar, corta la sangre y la herida queda limpia 1 día. */
export function bandageStep(w: World, s: Survivor): void {
  const a = s.action;
  if (a.type !== 'bandage') return;
  const p = w.survivors.find((x) => x.id === a.patientId);
  const wd = p?.wounds.find((x) => x.id === a.woundId);
  const near =
    p !== undefined &&
    (p.pos.x - s.pos.x) ** 2 + (p.pos.y - s.pos.y) ** 2 <= BANDAGE_RANGE * BANDAGE_RANGE;
  if (!p || !wd || !near) {
    s.action = { type: 'idle', ticksLeft: 0 };
    return;
  }
  practice(w, s, 'heal', 1);
  if (--a.ticksLeft > 0) return;
  s.action = { type: 'idle', ticksLeft: 0 };
  if (!useBandage(w, s, p)) return;
  wd.bleeding = false;
  wd.cleanUntil = w.tick + BANDAGE_CLEAN_HOURS * TICKS_PER_HOUR;
  logEvent(w, { kind: 'bandaged', survivorId: s.id, otherId: p.id });
}
