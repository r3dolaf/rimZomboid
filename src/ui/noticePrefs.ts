// Menú de Avisos (spec H4e §6): qué tipos de aviso aparecen y cuáles pausan. Es una preferencia de
// quien juega, no de la partida: se guarda en el navegador.
import type { Decision, Tone } from '../sim/types';

/** Lo elegido por tipo (el `kind` del registro, o `decision:<tipo>`); lo que falta, por defecto. */
export type NoticePrefs = Record<string, { show?: boolean; pause?: boolean }>;

const KEY = 'rimzomboid.avisos';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** El localStorage, si el navegador deja usarlo. */
function local(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const isDecision = (kind: string) => kind.startsWith('decision:');

/** ¿Aparece? Los de decisión, siempre (hay que contestarlos). */
export function shows(p: NoticePrefs, kind: string): boolean {
  return isDecision(kind) || p[kind]?.show !== false;
}

/** ¿Pausa? Lo elegido; si no, como antes: los rojos y los de decisión. */
export function pauses(p: NoticePrefs, kind: string, tone: Tone): boolean {
  if (!shows(p, kind)) return false;
  return p[kind]?.pause ?? (isDecision(kind) || tone === 'bad');
}

/** Lo guardado, o nada si no hay, está roto o el navegador no deja leerlo. */
export function loadPrefs(storage: Store | null = local()): NoticePrefs {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return {};
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
    for (const v of Object.values(data as Record<string, unknown>)) {
      if (typeof v !== 'object' || v === null) return {};
      for (const [k, x] of Object.entries(v))
        if ((k !== 'show' && k !== 'pause') || typeof x !== 'boolean') return {};
    }
    return data as NoticePrefs;
  } catch {
    return {};
  }
}

/** Lo guarda (si el navegador no deja, la próxima vez será lo de siempre). */
export function savePrefs(p: NoticePrefs, storage: Store | null = local()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(p));
  } catch {
    // sin poder guardarlo, se pierde al recargar
  }
}

export interface PrefsStore {
  get(): NoticePrefs;
  set(p: NoticePrefs): void;
}

/** Las preferencias de esta sesión, leídas al empezar y guardadas en cada cambio. */
export function createPrefsStore(storage: Store | null = local()): PrefsStore {
  let prefs = loadPrefs(storage);
  return {
    get: () => prefs,
    set(p) {
      prefs = p;
      savePrefs(p, storage);
    },
  };
}

const DECISIONS: readonly Decision['kind'][] = ['theft', 'birthday', 'fever', 'stranger'];

/** Los tipos de aviso por grupos, en el orden del menú. */
export const NOTICE_GROUPS: readonly {
  id: 'narrator' | 'zombies' | 'hordes' | 'colonists';
  kinds: readonly string[];
}[] = [
  {
    id: 'narrator',
    kinds: [
      ...DECISIONS.map((d) => `decision:${d}`),
      'jealousy',
      'clash',
      'grief',
      'foodFight',
      'gossip',
      'storyNight',
      'cache',
      'storm',
      'theftPunished',
      'theftIgnored',
      'birthdayParty',
      'birthdayRuined',
      'birthdaySkipped',
      'strangerAccepted',
      'strangerLeft',
    ],
  },
  { id: 'zombies', kinds: ['downed', 'zombiesInBase', 'zombieSighted', 'broken', 'fled'] },
  {
    id: 'hordes',
    kinds: [
      'siegeAnnounced',
      'siegeArrived',
      'siegeRepelled',
      'siegeEnded',
      'wanderersSighted',
      'strangersFled',
    ],
  },
  { id: 'colonists', kinds: ['skillUp'] },
];

/** Los que pueden salir rojos (por defecto pausan): para marcar la casilla Pausa del menú. */
export const CAN_BE_RED: ReadonlySet<string> = new Set([
  'jealousy',
  'clash',
  'grief',
  'foodFight',
  'gossip',
  'storm',
  'theftPunished',
  'birthdayRuined',
  'downed',
  'zombiesInBase',
  'siegeAnnounced',
  'siegeArrived',
]);
