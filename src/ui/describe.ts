// Traducciones del estado de la simulación a textos e indicadores para la interfaz.
import { es } from '../i18n/es';
import { LONELY_BELOW, MOOD_CRISIS, MOOD_EDGE, TICKS_PER_HOUR } from '../sim/balance';
import { gameTime } from '../sim/clock';
import { ITEM_KINDS, type Inventory } from '../sim/items';
import type { LogEntry } from '../sim/log';
import type { MoodModifier } from '../sim/mood';
import type { MemoryId, Survivor, Tone, World } from '../sim/types';

export function activityText(s: Survivor, w?: World): string {
  const container = (id: number) => w?.containers.find((c) => c.id === id);
  const name = (id: number) => w?.survivors.find((o) => o.id === id)?.name ?? '?';
  const buildName = (id: number) => {
    const b = w?.blueprints.find((x) => x.id === id);
    return b ? es.builds[b.kind] : '?';
  };
  const a = s.action;
  const t = es.activities;
  switch (a.type) {
    case 'eat':
      return t.eat;
    case 'sleep':
      return a.inBed ? t.sleepInBed : t.sleepOnFloor;
    case 'crisis':
      return t.crisis;
    case 'search': {
      const c = container(a.containerId);
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
    case 'moveTo':
      if (a.then?.type === 'search') return t.goLoot(container(a.then.containerId)?.houseId ?? 0);
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
      if (a.run) return t.flee;
      return t.wander;
    case 'idle':
      if (a.wait === 'refused' && a.ticksLeft > 0) return t.refused;
      if (a.wait === 'noPath' && a.ticksLeft > 0) return t.noPath;
      return t.wander;
  }
}

/** El icono más importante para la tarjeta, o `null` si no hay nada que destacar. */
export function statusIcon(s: Survivor): { icon: string; label: string } | null {
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
  if (s.sick) return es.status.sick;
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
export function formatItems(inv: Inventory): string {
  const parts = ITEM_KINDS.filter((k) => inv[k] > 0).map((k) => {
    const [one, many] = es.items[k];
    return `${inv[k]} ${inv[k] === 1 ? one : many}`;
  });
  if (parts.length === 0) return es.nothing;
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} ${es.and} ${parts.at(-1)}`;
}

/** "Día 2, 10:14 · Ana ha encontrado 4 latas en la casa 3". */
export function formatLogEntry(e: LogEntry, w: World): string {
  const t = gameTime(e.tick);
  return `${es.dayTime(t.day, t.hour, t.minute)} · ${logText(e, w)}`;
}

/** La frase de un suceso, sin la fecha. */
export function logText(e: LogEntry, w: World): string {
  const name = (id: number) => w.survivors.find((s) => s.id === id)?.name ?? '?';
  const l = es.log;
  let text: string;
  switch (e.kind) {
    case 'found':
      text = l.found(name(e.survivorId), formatItems(e.items), e.houseId);
      break;
    case 'emptyContainer':
      text = l.emptyContainer(name(e.survivorId), e.houseId);
      break;
    case 'houseEmptied':
      text = l.houseEmptied(e.houseId);
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
      text = l.cache(name(e.survivorId), e.houseId, e.cans);
      break;
    case 'storm':
      text = l.storm;
      break;
    case 'flu':
      text = l.flu(name(e.survivorId));
      break;
    case 'fluRest':
      text = l.fluRest(name(e.survivorId));
      break;
    case 'fluWork':
      text = l.fluWork(name(e.survivorId));
      break;
    case 'fluOver':
      text = l.fluOver(name(e.survivorId));
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
    case 'skillUp':
      text = l.skillUp(name(e.survivorId), es.skills[e.skill], e.level);
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
    default:
      return null;
  }
}
