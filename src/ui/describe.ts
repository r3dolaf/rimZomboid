// Traducciones del estado de la simulación a textos e indicadores para la interfaz.
import { es } from '../i18n/es';
import { MOOD_CRISIS, MOOD_EDGE, TICKS_PER_HOUR } from '../sim/balance';
import { gameTime } from '../sim/clock';
import { ITEM_KINDS, type Inventory } from '../sim/items';
import type { LogEntry } from '../sim/log';
import type { MoodModifier } from '../sim/mood';
import type { Survivor, World } from '../sim/types';

export function activityText(s: Survivor, w?: World): string {
  const container = (id: number) => w?.containers.find((c) => c.id === id);
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
    case 'moveTo':
      if (a.then?.type === 'search') return t.goLoot(container(a.then.containerId)?.houseId ?? 0);
      if (a.then?.type === 'unload') return t.goUnload;
      if (a.then?.type === 'eat') return t.goEat;
      if (a.then?.type === 'sleep') return t.goSleep;
      if (a.then?.type === 'crisis') return t.crisis;
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
  if (a.type === 'crisis' || (a.type === 'moveTo' && a.then?.type === 'crisis'))
    return es.status.crisis;
  if (a.type === 'sleep') return es.status.sleeping;
  if (a.type === 'eat') return es.status.eating;
  if (s.needs.mood < MOOD_EDGE) return es.status.edge;
  return null;
}

export type BarLevel = 'ok' | 'warn' | 'bad';

/** Color de una barra: amarilla o roja cuando el valor es bajo. */
export function barLevel(value: number, kind: 'need' | 'mood'): BarLevel {
  const [warn, bad] = kind === 'mood' ? [MOOD_EDGE, MOOD_CRISIS] : [35, 15];
  if (value < bad) return 'bad';
  if (value < warn) return 'warn';
  return 'ok';
}

/** "Hambriento −10" o "Comió +5 (quedan 3 h)". */
export function formatModifier(m: MoodModifier, tick: number): string {
  const sign = m.value > 0 ? '+' : '−';
  let text = `${es.modifiers[m.id]} ${sign}${Math.abs(m.value)}`;
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
  }
  return `${es.dayTime(t.day, t.hour, t.minute)} · ${text}`;
}
