import { es } from '../i18n/es';
import type { LogEvent } from '../sim/log';
import type { World } from '../sim/types';
import { formatLogEntry } from './describe';
import { screenIs, SMALL_SCREEN } from './screen';
import './panels.css';

const COLLAPSED_KEY = 'rimzomboid.logCollapsed';
const FILTERS_KEY = 'rimzomboid.logFilters';

/** Tipos de suceso para filtrar el registro (H5 §10), en el orden de los botones. */
export const LOG_CATEGORIES = [
  'social',
  'combat',
  'loot',
  'work',
  'health',
  'narrator',
  'colony',
] as const;
export type LogCategory = (typeof LOG_CATEGORIES)[number];

/** La categoría de cada suceso (si se añade uno sin ella, no compila). */
export const LOG_CATEGORY: Record<LogEvent['kind'], LogCategory> = {
  insult: 'social',
  sharedFood: 'social',
  fight: 'social',
  consoled: 'social',
  consoleFailed: 'social',
  couple: 'social',
  breakup: 'social',
  crisis: 'social',
  vented: 'social',
  refused: 'social',
  collapsed: 'social',
  zombieKilled: 'combat',
  clothesTorn: 'combat', // H5b
  bagFound: 'loot', // H5b2
  siteFound: 'colony', // H5c1
  roadZombies: 'combat', // H5c3
  roadHorde: 'combat',
  roadJoined: 'colony',
  roadJoinerLeft: 'colony',
  roadLoot: 'loot',
  roadForage: 'loot',
  expeditionArrived: 'colony',
  siteChanged: 'colony',
  bagDropped: 'combat',
  bagRecovered: 'colony',
  waterCut: 'colony',
  lowWater: 'colony', // V2
  season: 'colony', // V3
  spoiled: 'colony', // V1
  cropsLost: 'colony',
  cropsFrozen: 'colony', // V3
  rain: 'colony',
  downed: 'combat',
  gotUp: 'combat',
  fled: 'combat',
  broken: 'combat',
  zombiesInBase: 'combat',
  zombieSighted: 'combat',
  siegeAnnounced: 'combat',
  siegeArrived: 'combat',
  siegeRepelled: 'combat',
  siegeEnded: 'combat',
  wanderersSighted: 'combat',
  strangersFled: 'combat',
  strangerDowned: 'combat',
  rose: 'combat',
  sawTurned: 'combat',
  found: 'loot',
  emptyContainer: 'loot',
  houseEmptied: 'loot',
  forced: 'loot',
  corpseSearched: 'loot',
  built: 'work',
  buildFailed: 'work',
  crafted: 'work',
  craftFailed: 'work',
  skillUp: 'work',
  wounded: 'health',
  bandaged: 'health',
  painkiller: 'health',
  rescued: 'health',
  fever: 'health',
  feverWorse: 'health',
  feverRest: 'health',
  feverGone: 'health',
  antibiotics: 'health', // H6a
  fed: 'health', // H6c
  infectionCured: 'health',
  died: 'health',
  strangerDied: 'health',
  killedForNothing: 'health',
  theft: 'narrator',
  theftPunished: 'narrator',
  theftIgnored: 'narrator',
  jealousy: 'narrator',
  clash: 'narrator',
  grief: 'narrator',
  foodFight: 'narrator',
  gossip: 'narrator',
  storyNight: 'narrator',
  birthday: 'narrator',
  birthdayParty: 'narrator',
  birthdayRuined: 'narrator',
  birthdaySkipped: 'narrator',
  cache: 'narrator',
  supplies: 'narrator', // H6c
  goodDay: 'narrator',
  storm: 'narrator',
  coldSnap: 'narrator', // V3
  heatWave: 'narrator',
  outOfFood: 'colony',
  strangerArrived: 'colony',
  strangerAccepted: 'colony',
  strangerRejected: 'colony',
  strangerLeft: 'colony',
  banished: 'colony',
  returned: 'colony',
  colonyFell: 'colony',
};

/** Las categorías apagadas la última vez; si no hay o no se puede leer, ninguna. */
function loadHidden(): Set<LogCategory> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(FILTERS_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? LOG_CATEGORIES.filter((c) => raw.includes(c)) : []);
  } catch {
    return new Set();
  }
}

function saveHidden(hidden: Set<LogCategory>): void {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(LOG_CATEGORIES.filter((c) => hidden.has(c))));
  } catch {
    // Sin almacenamiento: solo dura esta partida.
  }
}

/**
 * Lo que eligió la última vez (minimizado o no). Si no eligió nada (o el navegador no deja
 * guardarlo): en pantalla pequeña, minimizado (M2 §4); si no, abierto.
 */
function loadCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved !== null) return saved === '1';
  } catch {
    // Sin almacenamiento: lo de cada pantalla.
  }
  return screenIs(SMALL_SCREEN);
}

function saveCollapsed(on: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, on ? '1' : '0');
  } catch {
    // Sin almacenamiento: solo dura esta partida.
  }
}

/**
 * Registro de sucesos: los últimos del mundo, el más reciente abajo. Se puede minimizar (queda
 * solo su cabecera) y filtrar por tipo (H5); las dos cosas se recuerdan en el navegador.
 */
export function mountLog(root: HTMLElement, opts: { world: World }): { update(): void } {
  const panel = document.createElement('section');
  panel.className = 'log';
  panel.dataset.testid = 'log';
  panel.setAttribute('aria-label', es.logTitle);
  const head = document.createElement('header');
  const title = document.createElement('span');
  title.textContent = es.logTitle;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.dataset.testid = 'log-toggle';
  head.append(title, toggle);
  const list = document.createElement('ol');
  // Filtros (H5 §10): un botón por categoría, que se apaga y se enciende.
  const hidden = loadHidden();
  const filters = document.createElement('div');
  filters.className = 'log-filters';
  const applyFilters = () => {
    for (const li of list.children) {
      const el = li as HTMLElement;
      el.hidden = hidden.has(el.dataset.category as LogCategory);
    }
  };
  for (const c of LOG_CATEGORIES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = es.logCategories[c];
    b.dataset.testid = `log-filter-${c}`;
    b.classList.toggle('off', hidden.has(c));
    b.addEventListener('click', () => {
      if (hidden.has(c)) hidden.delete(c);
      else hidden.add(c);
      b.classList.toggle('off', hidden.has(c));
      saveHidden(hidden);
      applyFilters();
      b.blur();
    });
    filters.append(b);
  }
  // Los filtros, abajo y siempre a la vista (junto a los sucesos más recientes).
  panel.append(head, list, filters);
  root.append(panel);

  let collapsed = loadCollapsed();
  const refresh = () => {
    list.hidden = collapsed;
    filters.hidden = collapsed;
    panel.classList.toggle('collapsed', collapsed);
    toggle.textContent = collapsed ? '▴' : '▾';
    const label = collapsed ? es.logToggle.show : es.logToggle.hide;
    toggle.title = label;
    toggle.setAttribute('aria-label', label);
  };
  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    saveCollapsed(collapsed);
    refresh();
    toggle.blur();
    if (!collapsed) panel.scrollTop = panel.scrollHeight;
  });
  refresh();

  let shownKey = '';
  return {
    update() {
      const log = opts.world.common.log;
      const last = log.at(-1);
      const key = `${log.length}:${last?.tick ?? -1}:${last?.kind ?? ''}`;
      if (key === shownKey) return;
      shownKey = key;
      const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 4;
      // Vacío al empezar, se ve igual (H6c): «Aún no ha pasado nada».
      const empty = document.createElement('li');
      empty.className = 'muted';
      empty.dataset.testid = 'log-empty';
      empty.textContent = es.logEmpty;
      list.replaceChildren(
        ...(log.length === 0
          ? [empty]
          : log.map((e) => {
              const li = document.createElement('li');
              li.textContent = formatLogEntry(e, opts.world);
              li.dataset.category = LOG_CATEGORY[e.kind];
              return li;
            })),
      );
      applyFilters();
      if (atBottom) panel.scrollTop = panel.scrollHeight;
    },
  };
}
