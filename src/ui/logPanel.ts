import { es } from '../i18n/es';
import type { World } from '../sim/types';
import { formatLogEntry } from './describe';
import './panels.css';

/** Registro de sucesos: los últimos del mundo, el más reciente abajo. */
export function mountLog(root: HTMLElement, opts: { world: World }): { update(): void } {
  const panel = document.createElement('section');
  panel.className = 'log';
  panel.dataset.testid = 'log';
  panel.setAttribute('aria-label', es.logTitle);
  const list = document.createElement('ol');
  panel.append(list);
  root.append(panel);

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
