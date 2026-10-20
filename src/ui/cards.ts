import { es } from '../i18n/es';
import type { Needs, Survivor, World } from '../sim/types';
import { barLevel, statusIcon } from './describe';
import type { Selection } from './selection';
import './panels.css';

const NEEDS: readonly (keyof Needs)[] = ['hunger', 'sleep', 'social', 'mood'];

interface Card {
  card: HTMLButtonElement;
  love: HTMLElement;
  status: HTMLElement;
  fills: HTMLElement[];
}

/** Barra inferior: una tarjeta por colono con sus necesidades. Siguen a quien está en la colonia. */
export function mountCards(
  root: HTMLElement,
  opts: { world: World; selection: Selection },
): { update(): void } {
  const bar = document.createElement('div');
  bar.className = 'cards';
  root.append(bar);

  const cards = new Map<number, Card>();
  const create = (s: Survivor): Card => {
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
    const love = document.createElement('span');
    love.className = 'love';
    love.textContent = '💕';
    love.title = es.hasPartner;
    love.hidden = true;
    name.append(love);
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
    return { card, love, status, fills };
  };

  return {
    update() {
      const here = new Set(opts.world.survivors.map((s) => s.id));
      for (const [id, c] of cards)
        if (!here.has(id)) {
          c.card.remove();
          cards.delete(id);
        }
      for (const s of opts.world.survivors) {
        let c = cards.get(s.id);
        if (!c) {
          c = create(s);
          cards.set(s.id, c);
        }
        const card = c;
        NEEDS.forEach((k, i) => {
          const v = Math.round(s.needs[k]);
          const fill = card.fills[i]!;
          const width = `${v}%`;
          if (fill.style.width !== width) fill.style.width = width;
          const level = barLevel(v, k === 'mood' || k === 'social' ? k : 'need');
          fill.className = `fill ${level}`;
        });
        const icon = statusIcon(s);
        const text = icon?.icon ?? '';
        if (c.status.textContent !== text) {
          c.status.textContent = text;
          c.status.title = icon?.label ?? '';
        }
        const coupled = s.partnerId !== null;
        if (c.love.hidden === coupled) c.love.hidden = !coupled;
        c.card.classList.toggle('selected', opts.selection.id === s.id);
      }
    },
  };
}
