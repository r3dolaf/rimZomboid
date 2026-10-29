// Vendas (spec H5 §4): cada uno lleva hasta 2; se venda lo que le sangra; Sanar venda a los demás
// (y al derribado antes de cargarlo); a 1 día la venda está sucia y se cambia. Analgésicos,
// descanso y camas de hospital (§5 y §6).
import { has, spend } from '../bags';
import {
  BANDAGE_CLEAN_HOURS,
  BANDAGE_RANGE,
  BANDAGE_TICKS,
  BANDAGES_CARRIED,
  ITEM_WEIGHT_KG,
  PAINKILLER_HOURS,
  REST_BELOW,
  REST_UNTIL,
  TICKS_PER_HOUR,
  WOUNDS,
} from '../balance';
import { baseFloor } from '../base';
import { armFactor, canWalk } from '../body';
import { contains } from '../geom';
import { ITEM_KINDS, weightOf, type ItemKind } from '../items';
import { logEvent } from '../log';
import { findPath, regionOf } from '../path/astar';
import { pick } from '../rng';
import { capacityKg, practice, workSpeed } from '../skills';
import type { Action, Point, Survivor, World, Wound } from '../types';
import { tileOf } from '../world';

const inBase = (w: World, s: Survivor) => contains(w.base.rect, tileOf(s.pos));
const sameTile = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const near = (a: Survivor, b: Survivor) =>
  (a.pos.x - b.pos.x) ** 2 + (a.pos.y - b.pos.y) ** 2 <= BANDAGE_RANGE * BANDAGE_RANGE;

/** ¿Está acostado? (Durmiendo, descansando o derribado en una cama.) */
export function lyingDown(s: Survivor): boolean {
  const a = s.action;
  return a.type === 'sleep' || a.type === 'rest' || (a.type === 'downed' && a.inBed === true);
}

/** ¿Está acostado en una cama de hospital? */
export function inHospital(w: World, s: Survivor): boolean {
  if (!lyingDown(s)) return false;
  const t = tileOf(s.pos);
  return w.beds.some((b) => b.medical === true && sameTile(b.pos, t));
}

/**
 * ¿Hay alguien (salvo `p`) acostado en esa cama o yendo a acostarse en ella? El que lleva a `p`
 * en brazos, no cuenta.
 */
function bedOccupied(w: World, pos: Point, p: Survivor): boolean {
  return w.survivors.some((o) => {
    if (o === p) return false;
    if (lyingDown(o) && sameTile(tileOf(o.pos), pos)) return true;
    const a = o.action;
    if (a.type !== 'moveTo' || !sameTile(a.target, pos)) return false;
    const then = a.then?.type;
    return then === 'rest' || (then === 'dropOff' && a.then?.downedId !== p.id);
  });
}

/** Una cama de hospital libre para `p`, o `null`. */
export function freeHospitalBed(w: World, p: Survivor): Point | null {
  return w.beds.find((b) => b.medical === true && !bedOccupied(w, b.pos, p))?.pos ?? null;
}

/** Hace de una cama una de hospital (sin dueño) o la vuelve normal; luego reparte las camas. */
export function setMedical(w: World, bedId: number, on: boolean): void {
  const bed = w.beds.find((b) => b.id === bedId);
  if (!bed || (bed.medical === true) === on) return;
  bed.medical = on;
  if (on && bed.ownerId !== null) {
    const owner = w.survivors.find((s) => s.id === bed.ownerId);
    if (owner) owner.bedId = null;
    bed.ownerId = null;
  }
  assignBeds(w);
}

/** Da las camas normales sin dueño a los colonos que no tienen. */
export function assignBeds(w: World): void {
  for (const s of w.survivors) {
    if (s.bedId !== null) continue;
    const bed = w.beds.find((b) => b.ownerId === null && b.medical !== true);
    if (!bed) return;
    bed.ownerId = s.id;
    s.bedId = bed.id;
  }
}

/** ¿Le duele tanto que tiene que descansar? (Con analgésico, no.) */
const hasPainkiller = (s: Survivor, w: World) => s.painkillerUntil > w.tick;

/** Dónde descansar: una cama de hospital libre, si no la suya, si no el suelo de la base. */
function restSpot(s: Survivor, w: World): Point {
  const hospital = freeHospitalBed(w, s);
  if (hospital) return hospital;
  const own = w.beds.find((b) => b.id === s.bedId);
  if (own) return own.pos;
  return inBase(w, s) ? tileOf(s.pos) : pick(w.rng, baseFloor(w));
}

/**
 * Descansar (§5): por dolor, con la Salud bajo REST_BELOW y sin analgésico, hasta pasar de
 * REST_UNTIL; por fiebre con "Que descanse" (§7), hasta que se le pase. `null`: sigue
 * descansando; `undefined`: no le hace falta.
 */
export function restDecision(s: Survivor, w: World): Action | null | undefined {
  const a = s.action;
  const resting = a.type === 'rest' || (a.type === 'moveTo' && a.then?.type === 'rest');
  const pain = !hasPainkiller(s, w) && s.health < (resting ? REST_UNTIL : REST_BELOW);
  const needed = pain || s.fever?.rest === true;
  if (resting) return needed ? null : { type: 'idle', ticksLeft: 0 };
  if (!needed) return undefined;
  return { type: 'moveTo', target: restSpot(s, w), then: { type: 'rest' } };
}

/** ¿Lleva algo que descargar? Todo cuenta salvo sus BANDAGES_CARRIED vendas. */
export function hasCargo(s: Survivor): boolean {
  return (
    s.carrying.pieces.length > 0 || // H5b: las prendas también
    ITEM_KINDS.some((k) =>
      k === 'bandage' ? s.carrying.bandage > BANDAGES_CARRIED : s.carrying[k] > 0,
    )
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

/** Cuántas cosas de `kind` le caben aún encima. */
const room = (s: Survivor, kind: ItemKind) =>
  Math.floor((capacityKg(s) - weightOf(s.carrying)) / ITEM_WEIGHT_KG[kind] + 1e-9);

/** En el almacén: coge vendas hasta llevar BANDAGES_CARRIED (las que le quepan). */
export function takeBandages(s: Survivor, w: World): void {
  const n = Math.min(
    BANDAGES_CARRIED - s.carrying.bandage,
    w.storage.items.bandage,
    room(s, 'bandage'),
  );
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
  const bleeding = s.wounds.some((wd) => wd.bleeding);
  const unloading = a.type === 'unload' || (a.type === 'moveTo' && a.then?.type === 'unload');
  if (a.type === 'bandage' && a.patientId === s.id) return null;
  if (a.type === 'moveTo' && (a.then?.type === 'takeBandages' || a.then?.type === 'takePainkiller'))
    return null;
  if (bleeding && unloading && has(s, 'bandage') === 0) return null; // descarga para coger vendas
  // Si otro viene a vendarle, no se venda a la vez (gastarían dos vendas).
  const helped = w.survivors.some((o) => o !== s && bandageTargetId(o) === s.id);
  if (armFactor(s) > 0 && bleeding && !helped) {
    if (has(s, 'bandage') > 0) {
      const own = startBandage(w, s, s);
      if (own) return own;
    } else if (w.storage.items.bandage > 0 && reachesStorage(w, s)) {
      // Sin sitio para vendas, primero descarga (si no, iría y vendría, o seguiría saqueando).
      if (room(s, 'bandage') > 0) return goTakeBandages(w);
      return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'unload' } };
    }
  }
  // Le han mandado tomarse un analgésico (§5): si puede andar, va él al almacén.
  if (s.painkillerWanted && canWalk(s) && w.storage.items.painkillers > 0 && reachesStorage(w, s))
    return {
      type: 'moveTo',
      target: pick(w.rng, w.storage.tiles),
      then: { type: 'takePainkiller' },
    };
  return undefined;
}

/** Le hace efecto el analgésico: 8 h con medio dolor. */
function painkillerTaken(w: World, p: Survivor): void {
  p.painkillerUntil = w.tick + PAINKILLER_HOURS * TICKS_PER_HOUR;
  p.painkillerWanted = false;
}

/** En el almacén: se toma un analgésico (si queda). */
export function takePainkiller(s: Survivor, w: World): void {
  s.painkillerWanted = false;
  if (w.storage.items.painkillers === 0) return;
  w.storage.items.painkillers--;
  painkillerTaken(w, s);
  logEvent(w, { kind: 'painkiller', survivorId: s.id, otherId: s.id });
}

/** A quién lleva un analgésico (o va a por él), o `null`. */
function painkillerTargetId(s: Survivor): number | null {
  const a = s.action;
  const then = a.type === 'moveTo' ? a.then : undefined;
  return then?.type === 'fetchPainkiller' || then?.type === 'givePainkiller'
    ? then.patientId
    : null;
}

/** ¿Hay que llevarle un analgésico? Lo quiere, no puede andar y está en la base. */
const needsPainkiller = (w: World, p: Survivor) =>
  p.painkillerWanted && !canWalk(p) && inBase(w, p);

const goGivePainkiller = (p: Survivor): Action => ({
  type: 'moveTo',
  target: tileOf(p.pos),
  then: { type: 'givePainkiller', patientId: p.id },
});

/** Sanar: llevar un analgésico a quien lo quiere y no puede ir (antes, a por él al almacén). */
export function painkillerJob(s: Survivor, w: World): Action | null {
  const p = w.survivors.find(
    (o) =>
      o !== s &&
      needsPainkiller(w, o) &&
      !w.survivors.some((x) => x !== s && painkillerTargetId(x) === o.id),
  );
  if (!p) return null;
  if (has(s, 'painkillers') > 0) return goGivePainkiller(p);
  if (w.storage.items.painkillers === 0 || !reachesStorage(w, s)) return null;
  return {
    type: 'moveTo',
    target: pick(w.rng, w.storage.tiles),
    then: { type: 'fetchPainkiller', patientId: p.id },
  };
}

/** ¿Sigue teniendo sentido llevárselo? */
export function painkillerStillWorth(s: Survivor, w: World, patientId: number): boolean {
  const p = w.survivors.find((x) => x.id === patientId);
  return p !== undefined && needsPainkiller(w, p);
}

/** En el almacén: coge uno y se lo lleva; junto al paciente: se lo da. */
export function startPainkillerActivity(
  s: Survivor,
  w: World,
  activity: { type: 'fetchPainkiller' | 'givePainkiller'; patientId: number },
): Action {
  const idle: Action = { type: 'idle', ticksLeft: 0 };
  const p = w.survivors.find((x) => x.id === activity.patientId);
  if (activity.type === 'fetchPainkiller') {
    if (has(s, 'painkillers') === 0) {
      if (w.storage.items.painkillers === 0 || room(s, 'painkillers') === 0) return idle;
      w.storage.items.painkillers--;
      s.carrying.painkillers++;
    }
    if (!p || !needsPainkiller(w, p)) return idle;
    const path = findPath(w.grid, tileOf(s.pos), tileOf(p.pos));
    if (!path) return idle;
    s.path = path;
    return goGivePainkiller(p);
  }
  if (!p || !p.painkillerWanted || has(s, 'painkillers') === 0 || !near(s, p)) return idle;
  spend(s, 'painkillers');
  painkillerTaken(w, p);
  logEvent(w, { kind: 'painkiller', survivorId: s.id, otherId: p.id });
  return idle;
}

/** ¿Lo está vendando ya otro (o va a hacerlo)? */
const claimed = (w: World, p: Survivor, s: Survivor) =>
  w.survivors.some((o) => o !== s && bandageTargetId(o) === p.id); // (también si se venda él)

/**
 * Sanar: vendar o cambiar la venda a quien está en la base (él mismo también). Si no lleva vendas,
 * primero al almacén.
 */
export function bandageJob(s: Survivor, w: World): Action | null {
  if (armFactor(s) === 0) return null;
  let best: Survivor | null = null;
  let bestHospital = false;
  let bestD = Infinity;
  for (const p of w.survivors) {
    if (!inBase(w, p) || !woundToTend(p, w.tick) || claimed(w, p, s)) continue;
    // Primero los de las camas de hospital (§6); entre iguales, el más cercano.
    const hospital = inHospital(w, p);
    const d = (p.pos.x - s.pos.x) ** 2 + (p.pos.y - s.pos.y) ** 2;
    if ((hospital && !bestHospital) || (hospital === bestHospital && d < bestD)) {
      best = p;
      bestHospital = hospital;
      bestD = d;
    }
  }
  if (!best) return null;
  // Sin vendas encima: las del herido (§4); si no lleva, al almacén.
  if (has(s, 'bandage') === 0 && has(best, 'bandage') === 0) {
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
  return near(s, p) ? (startBandage(w, s, p) ?? idle) : idle;
}

/** Gasta una venda: la suya; si no, la del herido; si no, del almacén (si está en la base). */
function useBandage(w: World, healer: Survivor, p: Survivor): boolean {
  if (spend(healer, 'bandage') === 1 || spend(p, 'bandage') === 1) return true;
  if (inBase(w, healer) && w.storage.items.bandage > 0) w.storage.items.bandage--;
  else return false;
  return true;
}

/** Vendando: aprende y, al terminar, corta la sangre y la herida queda limpia 1 día. */
export function bandageStep(w: World, s: Survivor): void {
  const a = s.action;
  if (a.type !== 'bandage') return;
  const p = w.survivors.find((x) => x.id === a.patientId);
  const wd = p?.wounds.find((x) => x.id === a.woundId);
  if (!p || !wd || !near(s, p)) {
    s.action = { type: 'idle', ticksLeft: 0 };
    return;
  }
  practice(w, s, 'heal', 1);
  if (--a.ticksLeft > 0) return;
  s.action = { type: 'idle', ticksLeft: 0 };
  // Si otro ya la ha vendado mientras tanto, no se gasta otra venda.
  const needed = wd.bleeding || (wd.cleanUntil > 0 && wd.cleanUntil <= w.tick);
  if (!needed || !useBandage(w, s, p)) return;
  wd.bleeding = false;
  wd.cleanUntil = w.tick + BANDAGE_CLEAN_HOURS * TICKS_PER_HOUR;
  logEvent(w, { kind: 'bandaged', survivorId: s.id, otherId: p.id });
}
