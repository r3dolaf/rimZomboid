// U1 §9: los primeros pasos y los consejos, sin pantalla: qué paso toca y qué consejo salta, mirando
// el mundo y lo que ha hecho el jugador en la interfaz. La tarjeta que los enseña está en coach.ts.
import { markedTrees } from '../sim/build';
import { darkness } from '../sim/clock';
import { allColonists } from '../sim/game';
import { getTile } from '../sim/map/grid';
import { effectiveDesignated } from '../sim/orders';
import { Tile, type Survivor, type World } from '../sim/types';

/** Los pasos, en el orden en que se enseñan (se dan por hechos en cualquier orden). */
export const GUIDE_STEPS = ['people', 'loot', 'wood', 'windows', 'time', 'work', 'table'] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];

/** Los consejos, cada uno una sola vez. */
export const TIPS = [
  'pause',
  'night',
  'zombies',
  'bleeding',
  'bite',
  'food',
  'mood',
  'siege',
  'radio', // C1
  'evac',
] as const;
export type TipId = (typeof TIPS)[number];

/** Lo que ha hecho el jugador en la interfaz (lo que el mundo no guarda). */
export interface GuideSeen {
  /** Ha elegido a alguien (su ficha). */
  selected: boolean;
  /** Ha puesto x2 o x3. */
  fast: boolean;
  /** Ha abierto Trabajos. */
  workOpened: boolean;
}

/** Lo que se guarda en el navegador (no en la partida). */
export interface GuideState {
  done: GuideStep[];
  /** El jugador ha ocultado los primeros pasos. */
  hidden: boolean;
  /** Ya vio «¡Ya sabes lo básico!». */
  finished: boolean;
  /** La tarjeta, plegada a una línea. */
  folded: boolean;
  tipsShown: TipId[];
  tipsOff: boolean;
}

export const NEW_GUIDE: GuideState = {
  done: [],
  hidden: false,
  finished: false,
  folded: false,
  tipsShown: [],
  tipsOff: false,
};

/** ¿Hay algo pedido de ese tipo, puesto o en la cola (en pausa, aún sin aplicar)? */
function planned(w: World, kind: 'board' | 'table'): boolean {
  return (
    w.blueprints.some((b) => b.kind === kind) ||
    w.orders.some((o) => o.type === 'placeBlueprint' && o.kind === kind)
  );
}

/** ¿Hay alguna ventana tapiada en la base? */
function boardedAtBase(w: World): boolean {
  const { x, y, w: width, h } = w.base.rect;
  for (let ty = y; ty < y + h; ty++)
    for (let tx = x; tx < x + width; tx++)
      if (getTile(w.grid, tx, ty) === Tile.BoardedWindow) return true;
  return false;
}

/** ¿Está hecho ese paso? `w` es la base. */
export function stepDone(step: GuideStep, w: World, seen: GuideSeen): boolean {
  switch (step) {
    case 'people':
      return seen.selected;
    case 'loot':
      return w.containers.some((c) => effectiveDesignated(w, c));
    case 'wood':
      return markedTrees(w).size > 0 || w.storage.items.wood > 0; // (con lo pedido en pausa)
    case 'windows':
      return planned(w, 'board') || boardedAtBase(w);
    case 'time':
      return seen.fast;
    case 'work':
      return seen.workOpened;
    case 'table':
      return planned(w, 'table') || w.furniture.some((f) => f.kind === 'table');
  }
}

/** El primer paso sin hacer, o `null` si ya están todos. */
export function currentStep(done: readonly GuideStep[]): GuideStep | null {
  return GUIDE_STEPS.find((s) => !done.includes(s)) ?? null;
}

/** Un consejo que toca, con de quién habla (si es de alguien). */
export interface DueTip {
  id: TipId;
  who?: string;
}

/** Lo que el consejo necesita saber además del mundo. */
export interface TipContext {
  /** Un aviso acaba de pausar el juego. */
  pausedByNotice: boolean;
  /** Zombis a la vista en el mapa que se ve. */
  zombiesSeen: number;
}

/** El primer consejo que toca y no se ha visto aún, o `null`. `w` es la base. */
export function dueTip(w: World, ctx: TipContext, shown: readonly TipId[]): DueTip | null {
  const people = allColonists(w).map((x) => x.s);
  const first = (test: (s: Survivor) => boolean): string | undefined => people.find(test)?.name;
  const checks: Record<TipId, () => DueTip | null> = {
    pause: () => (ctx.pausedByNotice ? { id: 'pause' } : null),
    night: () => (darkness(w.tick) >= 0.5 ? { id: 'night' } : null),
    zombies: () => (ctx.zombiesSeen > 0 ? { id: 'zombies' } : null),
    bleeding: () => {
      const who = first((s) => s.wounds.some((wd) => wd.bleeding));
      return who ? { id: 'bleeding', who } : null;
    },
    bite: () => {
      const who = first((s) => s.wounds.some((wd) => wd.kind === 'bite'));
      return who ? { id: 'bite', who } : null;
    },
    food: () => (people.length > 0 && w.storage.items.food < people.length ? { id: 'food' } : null),
    mood: () => {
      const who = first((s) => s.needs.mood < LOW_MOOD);
      return who ? { id: 'mood', who } : null;
    },
    // Anunciado (la cuenta atrás) o ya aquí.
    siege: () =>
      w.siege || w.hordes.some((h) => h.kind === 'siege' && !h.done) ? { id: 'siege' } : null,
    // C1: la primera radio en el almacén de la base (sin construir aún); el helicóptero anunciado.
    radio: () =>
      w.storage.items.radio > 0 && !w.furniture.some((f) => f.kind === 'radio')
        ? { id: 'radio' }
        : null,
    evac: () => (w.common.rescue?.stage === 3 ? { id: 'evac' } : null),
  };
  for (const id of TIPS) {
    if (shown.includes(id)) continue;
    const tip = checks[id]();
    if (tip) return tip;
  }
  return null;
}

/** Por debajo, el consejo del ánimo (la crisis llega a 10). */
export const LOW_MOOD = 20;
