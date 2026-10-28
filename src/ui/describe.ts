// Traducciones del estado de la simulación a textos e indicadores para la interfaz.
import { es } from '../i18n/es';
import {
  BODY_HP,
  CLEAN_BANDAGE_HEAL,
  LONELY_BELOW,
  MOOD_CRISIS,
  MOOD_EDGE,
  TICKS_PER_HOUR,
  WOUNDS,
} from '../sim/balance';
import { BODY_PARTS, painOf, partHp } from '../sim/body';
import { gameTime } from '../sim/clock';
import { ITEM_KINDS, type Inventory, type ItemKind } from '../sim/items';
import type { LogEntry } from '../sim/log';
import type { MoodModifier } from '../sim/mood';
import type { Building, MemoryId, Survivor, Tone, World, Wound, Zombie } from '../sim/types';

/**
 * El nombre de alguien por su id: de la colonia, a la puerta, de los que se fueron o de los muertos
 * (H5); si no, "?".
 */
export function personName(w: World, id: number): string {
  const all = [
    ...w.survivors,
    ...(w.stranger?.survivors ?? []),
    ...w.leaving,
    ...w.returning.flatMap((r) => (r.kind === 'stranger' ? [r.survivor] : [])),
  ];
  return (
    all.find((s) => s.id === id)?.name ??
    w.returning.flatMap((r) => (r.kind === 'zombie' && r.survivorId === id ? [r.name] : []))[0] ??
    w.dead.find((d) => d.id === id)?.name ??
    w.gone.find((g) => g.id === id)?.name ??
    '?'
  );
}

/** "Ana (zombi)" si el zombi fue alguien (H5); si no, `null`. */
export function zombieLabel(z: Pick<Zombie, 'name'>): string | null {
  return z.name === undefined ? null : es.healthUi.zombie(z.name);
}

/** Los iconos de salud de la tarjeta (H5 §10). La infección no se ve: solo la fiebre. */
export function healthIcons(s: Survivor, tick: number): { icon: string; label: string }[] {
  const i = es.healthUi.icons;
  const out: { icon: string; label: string }[] = [];
  if (s.wounds.some((wd) => wd.bleeding)) out.push(i.bleeding);
  if (s.fever) out.push(i.fever);
  if (s.fever && s.fever.stage !== 'fever') out.push(i.nausea);
  if (s.painkillerUntil > tick) out.push(i.painkiller);
  if (partHp(s, 'leftLeg') <= 0 || partHp(s, 'rightLeg') <= 0) out.push(i.leg);
  if (partHp(s, 'leftArm') <= 0 || partHp(s, 'rightArm') <= 0) out.push(i.arm);
  return out;
}

/** "Corte, vendado (se cura en 2 días)", "Arañazo, sangra", "Mordisco, venda sucia (…)". */
function woundText(wd: Wound, tick: number): string {
  const t = es.healthUi;
  const clean = wd.cleanUntil > tick;
  const state = wd.bleeding ? t.bleeding : clean ? t.bandaged : wd.cleanUntil > 0 ? t.dirty : null;
  const name = state ? `${es.wounds[wd.kind]}, ${state}` : es.wounds[wd.kind];
  if (wd.bleeding) return name;
  const perDay = (wd.size * (clean ? CLEAN_BANDAGE_HEAL : 1)) / WOUNDS[wd.kind].healDays;
  return `${name} (${t.heals(Math.max(1, Math.ceil(wd.damage / perDay - 1e-9)))})`;
}

/** La pestaña Salud (H5 §10): cada parte, la Sangre y lo que sufre. Nunca la infección. */
export function healthView(
  s: Survivor,
  w: World,
): {
  parts: { name: string; hp: number; max: number; wounds: string[] }[];
  blood: number;
  symptoms: string[];
} {
  const t = es.healthUi;
  const symptoms: string[] = [];
  const pain = Math.round(painOf(s, w.tick));
  if (pain > 0) symptoms.push(t.pain(pain));
  if (s.fever) symptoms.push(t.fever);
  if (s.fever && s.fever.stage !== 'fever') symptoms.push(t.nausea);
  if (s.fever?.stage === 'grave') symptoms.push(t.grave);
  if (s.painkillerUntil > w.tick)
    symptoms.push(t.painkiller(Math.ceil((s.painkillerUntil - w.tick) / TICKS_PER_HOUR)));
  return {
    parts: BODY_PARTS.map((p) => ({
      name: es.bodyParts[p].name,
      hp: Math.round(partHp(s, p)),
      max: BODY_HP[p],
      wounds: s.wounds.filter((wd) => wd.part === p).map((wd) => woundText(wd, w.tick)),
    })),
    blood: Math.round(s.blood),
    symptoms,
  };
}

export function activityText(s: Survivor, w?: World): string {
  const container = (id: number) => w?.containers.find((c) => c.id === id);
  const name = (id: number) => (w ? personName(w, id) : '?');
  const buildName = (id: number) => {
    const b = w?.blueprints.find((x) => x.id === id);
    return b ? es.builds[b.kind] : '?';
  };
  const a = s.action;
  const t = es.activities;
  // Modo combate (H4e): quieto o yendo adonde le han mandado.
  if (s.drafted && a.type === 'idle') return t.draftedIdle;
  if (s.drafted && a.type === 'moveTo' && !a.then) return t.draftedMoving;
  switch (a.type) {
    case 'eat':
      return t.eat;
    case 'sleep':
      return a.inBed ? t.sleepInBed : t.sleepOnFloor;
    case 'crisis':
      return t.crisis;
    case 'search': {
      const c = container(a.containerId);
      if (c?.name) return t.search(es.bodyOf(c.name)); // H5: "Registrando el cuerpo de Ana"
      return t.search(c ? es.containers[c.kind] : es.containers.shelf);
    }
    case 'unload':
      return t.unload;
    case 'fight':
      return t.fight(name(a.otherId));
    case 'console':
      return t.console(name(a.otherId));
    case 'chop':
      return t.chop;
    case 'build': {
      const b = w?.blueprints.find((x) => x.id === a.blueprintId);
      return b ? t.build(b.kind) : t.goBuild;
    }
    case 'consoled':
      return t.consoled(name(a.otherId));
    case 'downed':
      return t.downed;
    case 'melee':
      return t.melee;
    case 'pry':
      return t.pry;
    case 'craft':
      return es.recipes[a.recipe].doing;
    case 'bandage':
      return a.patientId === s.id ? t.bandageSelf : t.bandage(name(a.patientId));
    case 'rest':
      return t.rest;
    case 'dress':
      return t.dress; // H5b
    case 'mercy':
      return t.mercy(name(a.patientId));
    case 'moveTo':
      // Sanar (H4e)
      if (a.then?.type === 'rescue') return t.goRescue(name(a.then.downedId));
      if (a.then?.type === 'dropOff') return t.carry(name(a.then.downedId));
      if (a.then?.type === 'bandage') return t.goBandage(name(a.then.patientId));
      if (a.then?.type === 'takeBandages') return t.goTakeBandages;
      if (a.then?.type === 'rest') return t.goRest;
      if (a.then?.type === 'dress') return t.goDress;
      if (a.then?.type === 'takePainkiller') return t.takePainkiller;
      if (a.then?.type === 'fetchPainkiller') return t.fetchPainkiller(name(a.then.patientId));
      if (a.then?.type === 'givePainkiller') return t.givePainkiller(name(a.then.patientId));
      if (a.then?.type === 'mercy') return t.goMercy(name(a.then.patientId));
      if (a.then?.type === 'search') {
        const c = container(a.then.containerId);
        if (c?.kind === 'corpse') return c.name ? t.goBody(c.name) : t.goCorpse; // H5
        return t.goLoot(w && c ? buildingThe(w, c.houseId) : es.buildings.house.the);
      }
      if (a.then?.type === 'unload') return t.goUnload;
      if (a.then?.type === 'eat') return t.goEat;
      if (a.then?.type === 'sleep') return t.goSleep;
      if (a.then?.type === 'crisis') return t.crisis;
      if (a.then?.type === 'console') return t.goConsole(name(a.then.otherId));
      if (a.then?.type === 'chop') return t.goChop;
      if (a.then?.type === 'takeAxe') return t.takeAxe;
      if (a.then?.type === 'storeAxe') return t.storeAxe;
      if (a.then?.type === 'pickUp') return t.goPickUp;
      if (a.then?.type === 'fetchWood') return t.fetchWood(buildName(a.then.blueprintId));
      if (a.then?.type === 'deliver') return t.deliver(buildName(a.then.blueprintId));
      if (a.then?.type === 'build') return t.goBuild;
      if (a.then?.type === 'swapWeapon') return t.swapWeapon;
      if (a.then?.type === 'takeCrowbar') return t.takeCrowbar;
      if (a.then?.type === 'pry') return t.goPry;
      if (a.then?.type === 'fetchCraft') return t.fetchCraft;
      if (a.then?.type === 'craft') return t.goCraft;
      if (a.run) return t.flee;
      return t.wander;
    case 'idle':
      if (a.wait === 'refused' && a.ticksLeft > 0) return t.refused;
      if (a.wait === 'noPath' && a.ticksLeft > 0) return t.noPath;
      return t.wander;
  }
}

/**
 * La cuenta atrás del asedio para la barra de arriba (H4e §2.2): cuánto falta para que llegue o,
 * mientras dura, cuánto le queda; `null` si no hay ninguno.
 */
export function siegeText(w: World): string | null {
  const hours = (ticks: number) => Math.max(0, Math.ceil(ticks / TICKS_PER_HOUR));
  if (w.siege) {
    const h = hours(w.siege.at - w.tick);
    return es.siegeIn(Math.floor(h / 24), h % 24);
  }
  const active = w.hordes.find((h) => h.kind === 'siege' && !h.done);
  return active ? es.siegeLeft(hours(active.until! - w.tick)) : null;
}

/** El icono más importante para la tarjeta, o `null` si no hay nada que destacar. */
export function statusIcon(s: Survivor): { icon: string; label: string } | null {
  if (s.drafted) return es.status.drafted; // H4e: lo primero
  const a = s.action;
  if (a.type === 'downed') return es.status.downed;
  if (a.type === 'melee') return es.status.meleeZombie;
  if (a.type === 'moveTo' && a.run && !a.then) return es.status.fleeing;
  if (a.type === 'crisis' || (a.type === 'moveTo' && a.then?.type === 'crisis'))
    return es.status.crisis;
  if (a.type === 'fight') return es.status.fighting;
  if (a.type === 'console' || a.type === 'consoled') return es.status.consoling;
  if (a.type === 'sleep') return es.status.sleeping;
  if (a.type === 'eat') return es.status.eating;
  if (s.needs.mood < MOOD_EDGE) return es.status.edge;
  if (s.fever) return es.status.sick;
  return null;
}

export type BarLevel = 'ok' | 'warn' | 'bad';

/** Por debajo de cuánto se pone amarilla y roja cada tipo de barra. */
const BAR_LIMITS: Record<'need' | 'social' | 'mood', readonly [number, number]> = {
  need: [35, 15],
  social: [35, LONELY_BELOW],
  mood: [MOOD_EDGE, MOOD_CRISIS],
};

/** Color de una barra: amarilla o roja cuando el valor es bajo. */
export function barLevel(value: number, kind: 'need' | 'social' | 'mood'): BarLevel {
  const [warn, bad] = BAR_LIMITS[kind];
  if (value < bad) return 'bad';
  if (value < warn) return 'warn';
  return 'ok';
}

/** "+45", "−60" o "0". */
export function signed(v: number): string {
  return v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0';
}

/**
 * "Hambriento −10", "Comió +5 (quedan 3 h)" o, con `nameOf`, "Buena charla con Bea +3 (quedan 6 h)".
 */
export function formatModifier(
  m: MoodModifier,
  tick: number,
  nameOf?: (id: number) => string,
): string {
  const sign = m.value > 0 ? '+' : '−';
  const withName = m.otherId !== undefined && nameOf ? es.modifiersWith[m.id as MemoryId] : null;
  const label = withName ? withName(nameOf!(m.otherId!)) : es.modifiers[m.id];
  let text = `${label} ${sign}${Math.abs(m.value)}`;
  if (m.expiresAt !== undefined)
    text += ` (${es.hoursLeft(Math.ceil((m.expiresAt - tick) / TICKS_PER_HOUR))})`;
  return text;
}

/** "4 latas, 1 venda y 2 bates", o "nada". */
export function formatItems(inv: Inventory, order: readonly ItemKind[] = ITEM_KINDS): string {
  const parts = order
    .filter((k) => inv[k] > 0)
    .map((k) => {
      const [one, many] = es.items[k];
      return `${inv[k]} ${inv[k] === 1 ? one : many}`;
    });
  if (parts.length === 0) return es.nothing;
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} ${es.and} ${parts.at(-1)}`;
}

/** Lo que se pierde al fallar al fabricar: "−2 de tela, −1 de hilo". */
export function formatLost(inv: Inventory): string {
  return ITEM_KINDS.filter((k) => inv[k] > 0)
    .map((k) => es.lostItem(inv[k], es.materials[k] ?? es.items[k][1]))
    .join(', ');
}

/** Número del edificio entre los de su tipo (por orden), o `null` si es el único (H4f). */
function ordinal(w: World, b: Building): number | null {
  const same = w.houses.filter((h) => h.kind === b.kind);
  return same.length > 1 ? same.indexOf(b) + 1 : null;
}

/** "Supermercado", "Casa 4", "Granja 2" (H4f). */
export function buildingTitle(w: World, id: number): string {
  const b = w.houses.find((h) => h.id === id);
  if (!b) return es.buildings.house.name;
  const n = ordinal(w, b);
  const { name } = es.buildings[b.kind];
  return n === null ? name : es.numbered(name, n);
}

/** "el supermercado", "la casa 4", "la granja 2" (H4f). */
export function buildingThe(w: World, id: number): string {
  const b = w.houses.find((h) => h.id === id);
  if (!b) return es.buildings.house.the;
  const n = ordinal(w, b);
  const { the } = es.buildings[b.kind];
  return n === null ? the : es.numbered(the, n);
}

/** "Día 2, 10:14 · Ana ha encontrado 4 latas en la casa 3". */
export function formatLogEntry(e: LogEntry, w: World): string {
  const t = gameTime(e.tick);
  return `${es.dayTime(t.day, t.hour, t.minute)} · ${logText(e, w)}`;
}

/** La frase de un suceso, sin la fecha. */
export function logText(e: LogEntry, w: World): string {
  const name = (id: number) => personName(w, id);
  const l = es.log;
  let text: string;
  switch (e.kind) {
    case 'found':
      text = l.found(name(e.survivorId), formatItems(e.items), buildingThe(w, e.houseId));
      break;
    case 'emptyContainer':
      text = l.emptyContainer(name(e.survivorId), buildingThe(w, e.houseId));
      break;
    case 'houseEmptied':
      text = l.houseEmptied(buildingThe(w, e.houseId));
      break;
    case 'refused':
      text = l.refused(name(e.survivorId));
      break;
    case 'crisis':
      text = l.crisis(name(e.survivorId));
      break;
    case 'vented':
      text = l.vented(name(e.survivorId));
      break;
    case 'collapsed':
      text = l.collapsed(name(e.survivorId));
      break;
    case 'outOfFood':
      text = l.outOfFood;
      break;
    case 'insult':
      text = l.insult(name(e.survivorId), name(e.otherId));
      break;
    case 'sharedFood':
      text = l.sharedFood(name(e.survivorId), name(e.otherId));
      break;
    case 'fight':
      text = l.fight(name(e.survivorId), name(e.otherId));
      break;
    case 'consoled':
      text = l.consoled(name(e.survivorId), name(e.otherId));
      break;
    case 'couple':
      text = l.couple(name(e.survivorId), name(e.otherId));
      break;
    case 'breakup':
      text = l.breakup(name(e.survivorId), name(e.otherId));
      break;
    case 'strangerArrived':
      text = l.strangerArrived(e.names);
      break;
    case 'strangerAccepted':
      text = l.strangerAccepted(e.names);
      break;
    case 'strangerRejected':
      text = l.strangerRejected(e.names);
      break;
    case 'strangerLeft':
      text = l.strangerLeft(e.names);
      break;
    case 'strangersFled':
      text = l.strangersFled(e.names);
      break;
    case 'strangerDowned':
      text = l.strangerDowned(e.names);
      break;
    case 'theft':
      text = l.theft(name(e.suspectId), e.cans);
      break;
    case 'theftPunished':
      text = l.theftPunished(name(e.suspectId), e.guilty);
      break;
    case 'theftIgnored':
      text = l.theftIgnored(name(e.suspectId));
      break;
    case 'jealousy':
      text = l.jealousy(name(e.survivorId), name(e.otherId), name(e.partnerId));
      break;
    case 'clash':
      text = l.clash(name(e.survivorId), name(e.otherId));
      break;
    case 'grief':
      text = l.grief(name(e.survivorId));
      break;
    case 'foodFight':
      text = l.foodFight;
      break;
    case 'gossip':
      text = l.gossip(name(e.survivorId), name(e.listenerId), name(e.otherId), e.found);
      break;
    case 'storyNight':
      text = e.arguedIds
        ? l.storyNightRuined(name(e.arguedIds[0]), name(e.arguedIds[1]))
        : l.storyNight;
      break;
    case 'birthday':
      text = l.birthday(name(e.survivorId));
      break;
    case 'birthdayParty':
      text = l.birthdayParty(name(e.survivorId));
      break;
    case 'birthdayRuined':
      text = l.birthdayRuined(name(e.survivorId), name(e.otherId));
      break;
    case 'birthdaySkipped':
      text = l.birthdaySkipped(name(e.survivorId));
      break;
    case 'cache':
      text = l.cache(name(e.survivorId), buildingThe(w, e.houseId), e.cans);
      break;
    case 'storm':
      text = l.storm;
      break;
    case 'fever':
      text = l.fever(name(e.survivorId));
      break;
    case 'feverWorse':
      text = l.feverWorse(name(e.survivorId));
      break;
    case 'feverRest':
      text = l.feverRest(name(e.survivorId));
      break;
    case 'feverGone':
      text = l.feverGone(name(e.survivorId));
      break;
    case 'built':
      text = l.built(e.what);
      break;
    case 'broken':
      text = l.broken(e.what, e.inBase);
      break;
    case 'downed':
      text = l.downed(name(e.survivorId));
      break;
    case 'gotUp':
      text = l.gotUp(name(e.survivorId));
      break;
    case 'zombieKilled':
      text = l.zombieKilled(name(e.survivorId));
      break;
    case 'fled':
      text = l.fled(name(e.survivorId));
      break;
    case 'zombiesInBase':
      text = l.zombiesInBase;
      break;
    case 'zombieSighted':
      text = l.zombieSighted;
      break;
    case 'buildFailed':
      text = l.buildFailed(name(e.survivorId), e.what, e.wood);
      break;
    case 'consoleFailed':
      text = l.consoleFailed(name(e.survivorId), name(e.otherId));
      break;
    case 'skillUp':
      text = l.skillUp(name(e.survivorId), es.skills[e.skill], e.level);
      break;
    case 'forced':
      text = l.forced(name(e.survivorId), buildingThe(w, e.houseId));
      break;
    case 'corpseSearched':
      text = l.corpseSearched(name(e.survivorId), formatItems(e.items), e.name);
      break;
    case 'crafted':
      text = l.crafted(
        name(e.survivorId),
        e.garment
          ? (es.garmentDone[e.recipe]?.(es.garments[e.garment].the) ?? es.recipes[e.recipe].done)
          : es.recipes[e.recipe].done,
      );
      break;
    case 'craftFailed':
      text = l.craftFailed(name(e.survivorId), es.recipes[e.recipe].fail, formatLost(e.lost));
      break;
    case 'siegeAnnounced':
      text = l.siegeAnnounced(e.side, e.hours);
      break;
    case 'siegeArrived':
      text = l.siegeArrived;
      break;
    case 'siegeRepelled':
      text = l.siegeRepelled;
      break;
    case 'siegeEnded':
      text = l.siegeEnded;
      break;
    case 'wanderersSighted':
      text = l.wanderersSighted;
      break;
    case 'rescued':
      text = l.rescued(name(e.survivorId), name(e.otherId));
      break;
    case 'wounded':
      text = l.wounded(name(e.survivorId), e.part, e.wound);
      break;
    case 'clothesTorn':
      text = l.clothesTorn(name(e.survivorId), e.garment, e.part);
      break;
    case 'waterCut':
      text = l.waterCut;
      break;
    case 'rain':
      text = l.rain;
      break;
    case 'bandaged':
      text = l.bandaged(name(e.survivorId), name(e.otherId));
      break;
    case 'painkiller':
      text = l.painkiller(name(e.survivorId), name(e.otherId));
      break;
    case 'died':
      text = l.died(e.name, e.cause);
      break;
    case 'strangerDied':
      text = l.strangerDied(e.names);
      break;
    case 'rose':
      text = l.rose(e.name);
      break;
    case 'banished':
      text = l.banished(e.name);
      break;
    case 'returned':
      text = l.returned(e.name);
      break;
    case 'sawTurned':
      text = l.sawTurned(e.name);
      break;
    case 'killedForNothing':
      text = l.killedForNothing(e.name);
      break;
    case 'colonyFell':
      text = l.colonyFell;
      break;
  }
  return text;
}

export interface NoticeInfo {
  tone: Tone;
  title: string;
  /** A quién enfoca la cámara al pulsar el aviso, si a alguien. */
  focusId: number | null;
  /** O qué casilla (zombis, destrozos). */
  focusAt?: { x: number; y: number };
}

/**
 * Si un suceso del registro merece aviso (spec H3c §5.2), su tono, título y a quién enfoca.
 * Los que piden decisión tienen su propio aviso (ver `notices.ts`); aquí van sus desenlaces.
 */
export function noticeFor(e: LogEntry): NoticeInfo | null {
  const t = es.notices;
  switch (e.kind) {
    case 'jealousy':
      return { tone: 'bad', title: t.jealousy, focusId: e.survivorId };
    case 'clash':
      return { tone: 'bad', title: t.clash, focusId: e.survivorId };
    case 'grief':
      return { tone: 'bad', title: t.grief, focusId: e.survivorId };
    case 'foodFight':
      return { tone: 'bad', title: t.foodFight, focusId: null };
    case 'gossip':
      return { tone: 'bad', title: t.gossip, focusId: e.otherId };
    case 'storyNight':
      return e.arguedIds
        ? { tone: 'mixed', title: t.storyNight, focusId: e.arguedIds[0] }
        : { tone: 'good', title: t.storyNight, focusId: null };
    case 'cache':
      return { tone: 'good', title: t.cache, focusId: e.survivorId };
    case 'storm':
      return { tone: 'bad', title: t.storm, focusId: null };
    case 'theftPunished':
      return { tone: e.guilty ? 'mixed' : 'bad', title: t.theftPunished, focusId: e.suspectId };
    case 'birthdayParty':
      return { tone: 'good', title: t.birthdayParty, focusId: e.survivorId };
    case 'birthdayRuined':
      return { tone: 'bad', title: t.birthdayRuined, focusId: e.survivorId };
    // También si la decisión caducó: así se ve qué se aplicó por defecto.
    case 'birthdaySkipped':
      return { tone: 'mixed', title: t.birthdaySkipped, focusId: e.survivorId };
    case 'theftIgnored':
      return { tone: 'mixed', title: t.theftIgnored, focusId: e.suspectId };
    case 'strangerAccepted':
      return { tone: 'good', title: t.strangerAccepted, focusId: null };
    case 'strangerLeft':
      return { tone: 'mixed', title: t.strangerLeft, focusId: null };
    // Zombis (H4b §8)
    case 'downed':
      return { tone: 'bad', title: t.downed, focusId: e.survivorId };
    case 'zombiesInBase':
      return { tone: 'bad', title: t.zombiesInBase, focusId: null, focusAt: { x: e.x, y: e.y } };
    case 'zombieSighted':
      return { tone: 'mixed', title: t.zombieSighted, focusId: null, focusAt: { x: e.x, y: e.y } };
    case 'broken':
      // Solo lo de la base: lo de las casas sería ruido.
      return e.inBase
        ? { tone: 'mixed', title: t.broken, focusId: null, focusAt: { x: e.x, y: e.y } }
        : null;
    case 'fled':
      return { tone: 'mixed', title: t.fled, focusId: e.survivorId };
    case 'skillUp':
      return { tone: 'good', title: t.skillUp, focusId: e.survivorId };
    // Heridas y muerte (H5 §10)
    case 'died':
      return { tone: 'bad', title: t.died, focusId: null };
    case 'rose':
      return { tone: 'bad', title: t.rose, focusId: null };
    case 'wounded':
      return e.wound === 'bite' ? { tone: 'bad', title: t.wounded, focusId: e.survivorId } : null;
    case 'sawTurned':
      return { tone: 'bad', title: t.sawTurned, focusId: null };
    case 'killedForNothing':
      return { tone: 'bad', title: t.killedForNothing, focusId: null };
    case 'banished':
      return { tone: 'mixed', title: t.banished, focusId: null };
    case 'returned':
      return { tone: 'mixed', title: t.returned, focusId: null };
    case 'strangerDied':
      return { tone: 'mixed', title: t.strangerDied, focusId: null };
    case 'feverGone':
      return { tone: 'good', title: t.feverGone, focusId: e.survivorId };
    // Hordas y desconocidos (H4e)
    case 'siegeAnnounced':
      return { tone: 'bad', title: t.siegeAnnounced, focusId: null };
    case 'siegeArrived':
      return { tone: 'bad', title: t.siegeArrived, focusId: null, focusAt: { x: e.x, y: e.y } };
    case 'siegeRepelled':
      return { tone: 'good', title: t.siegeRepelled, focusId: null };
    case 'siegeEnded':
      return { tone: 'mixed', title: t.siegeEnded, focusId: null };
    case 'wanderersSighted':
      return {
        tone: 'mixed',
        title: t.wanderersSighted,
        focusId: null,
        focusAt: { x: e.x, y: e.y },
      };
    case 'strangersFled':
      return { tone: 'mixed', title: t.strangersFled, focusId: null };
    default:
      return null;
  }
}
