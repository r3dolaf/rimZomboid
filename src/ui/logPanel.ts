import { es } from '../i18n/es';
import type { World } from '../sim/types';
import { formatLogEntry } from './describe';
import './panels.css';

const COLLAPSED_KEY = 'rimzomboid.logCollapsed';

/** Lo que eligió la última vez (minimizado o no); si el navegador no deja guardarlo, abierto. */
function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
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
 * solo su cabecera) y se recuerda en el navegador.
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
  panel.append(head, list);
  root.append(panel);

  let collapsed = loadCollapsed();
  const refresh = () => {
    list.hidden = collapsed;
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
      const log = opts.world.log;
      const last = log.at(-1);
      const key = `${log.length}:${last?.tick ?? -1}:${last?.kind ?? ''}`;
      if (key === shownKey) return;
      shownKey = key;
      const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 4;
      list.replaceChildren(
        ...log.map((e) => {
          const li = document.createElement('li');
          li.textContent = formatLogEntry(e, opts.world);
          return li;
        }),
      );
      panel.hidden = log.length === 0;
      if (atBottom) panel.scrollTop = panel.scrollHeight;
    },
  };
}
