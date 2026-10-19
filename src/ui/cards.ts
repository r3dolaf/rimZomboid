import { es } from '../i18n/es';
import type { Needs, World } from '../sim/types';
import { barLevel, statusIcon } from './describe';
import type { Selection } from './selection';
import './panels.css';

const NEEDS: readonly (keyof Needs)[] = ['hunger', 'sleep', 'mood'];

/** Barra inferior: una tarjeta por superviviente con sus necesidades. */
export function mountCards(
  root: HTMLElement,
  opts: { world: World; selection: Selection },
): { update(): void } {
  const bar = document.createElement('div');
  bar.className = 'cards';
  root.append(bar);

  const cards = opts.world.survivors.map((s) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.dataset.testid = `card-${s.id}`;
    card.addEventListener('click', () => {
      opts.selection.set(opts.selection.id === s.id ? null : s.id);
      card.blur();
    });

    const head = document.createElement('div');
    head.className = 'card-head';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = s.name;
    const status = document.createElement('span');
    status.className = 'status';
    head.append(name, status);
    card.append(head);

    const fills = NEEDS.map((k) => {
      const row = document.createElement('div');
      row.className = 'bar';
      row.dataset.need = k;
      row.title = es.needs[k];
      const fill = document.createElement('div');
      fill.className = 'fill';
      row.append(fill);
      card.append(row);
      return fill;
    });

    bar.append(card);
    return { id: s.id, card, status, fills };
  });

  return {
    update() {
      for (const c of cards) {
        const s = opts.world.survivors.find((x) => x.id === c.id);
        if (!s) continue;
        NEEDS.forEach((k, i) => {
          const v = Math.round(s.needs[k]);
          const fill = c.fills[i]!;
          const width = `${v}%`;
          if (fill.style.width !== width) fill.style.width = width;
          const level = barLevel(v, k === 'mood' ? 'mood' : 'need');
          fill.className = `fill ${level}`;
        });
        const icon = statusIcon(s);
        const text = icon?.icon ?? '';
        if (c.status.textContent !== text) {
          c.status.textContent = text;
          c.status.title = icon?.label ?? '';
        }
        c.card.classList.toggle('selected', opts.selection.id === s.id);
      }
    },
  };
}
