import { effectiveDrafted, draftToggle } from '../game/command';
import { es } from '../i18n/es';
import { issue } from '../sim/orders';
import type { World } from '../sim/types';
import { statusIcon } from './describe';
import type { Selection } from './selection';
import './panels.css';

/**
 * Con varios colonos elegidos (spec H4e §3.2), en el sitio de la ficha: sus nombres (pulsar uno
 * deja elegido solo a ese) y el botón Combate, que pone o quita el modo combate a todos.
 */
export function mountGroupPanel(
  root: HTMLElement,
  opts: { world: World; selection: Selection },
): { update(): void } {
  const panel = document.createElement('aside');
  panel.className = 'sheet group';
  panel.dataset.testid = 'group-panel';
  panel.hidden = true;
  const head = document.createElement('header');
  const title = document.createElement('h2');
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'close';
  x.textContent = '✕';
  x.dataset.testid = 'group-close';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', () => opts.selection.set(null));
  head.append(title, x);
  const draft = document.createElement('button');
  draft.type = 'button';
  draft.className = 'draft';
  draft.dataset.testid = 'group-draft';
  draft.textContent = es.draftButton;
  draft.title = es.draftHint;
  draft.addEventListener('click', () => {
    const o = draftToggle(opts.world, opts.selection.ids);
    if (o) issue(opts.world, o);
    draft.blur();
  });
  const list = document.createElement('div');
  list.className = 'names';
  panel.append(head, draft, list);
  root.append(panel);

  let shown = '';
  return {
    update() {
      const w = opts.world;
      const ss = opts.selection.ids
        .map((id) => w.survivors.find((s) => s.id === id))
        .filter((s) => s !== undefined);
      if (ss.length < 2) {
        panel.hidden = true;
        shown = '';
        return;
      }
      panel.hidden = false;
      draft.classList.toggle(
        'active',
        ss.some((s) => effectiveDrafted(w, s)),
      );
      const rows = ss.map((s) => ({ id: s.id, name: s.name, icon: statusIcon(s)?.icon ?? '' }));
      const key = JSON.stringify(rows);
      if (key === shown) return;
      shown = key;
      title.textContent = es.groupTitle(ss.length);
      list.replaceChildren(
        ...rows.map((r) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.dataset.testid = `group-name-${r.id}`;
          b.textContent = r.name;
          b.addEventListener('click', () => opts.selection.set(r.id));
          const icon = document.createElement('span');
          icon.className = 'status';
          icon.textContent = r.icon;
          const row = document.createElement('div');
          row.append(b, icon);
          return row;
        }),
      );
    },
  };
}
