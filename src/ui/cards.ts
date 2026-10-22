import { es } from '../i18n/es';
import type { Needs, Survivor, World } from '../sim/types';
import { effectiveDrafted } from '../game/command';
import { barLevel, statusIcon } from './describe';
import type { Selection } from './selection';
import './panels.css';

const NEEDS: readonly (keyof Needs)[] = ['hunger', 'sleep', 'social', 'mood'];

interface Card {
  card: HTMLButtonElement;
  love: HTMLElement;
  status: HTMLElement;
  fills: HTMLElement[];
  health: HTMLElement;
}

/**
 * Barra inferior: una tarjeta por colono con su Salud y sus necesidades. Siguen a quien está en
 * la colonia.
 */
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
    card.addEventListener('click', (ev) => {
      // Mayús (H4e): lo añade o lo quita; si no, solo él (o nadie, si ya era el único).
      if (ev.shiftKey) opts.selection.toggle(s.id);
      else opts.selection.set(opts.selection.id === s.id ? null : s.id);
      card.blur();
    });

    const head = document.createElement('div');
    head.className = 'card-head';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = s.name;
    const love = document.createElement('span');
    love.className = 'love';
    love.textContent = es.partnerIcon;
    love.title = es.hasPartner;
    love.hidden = true;
    const status = document.createElement('span');
    status.className = 'status';
    const who = document.createElement('span');
    who.append(name, love);
    head.append(who, status);
    card.append(head);

    const barRow = (key: string, title: string) => {
      const row = document.createElement('div');
      row.className = 'bar';
      row.dataset.need = key;
      row.title = title;
      const fill = document.createElement('div');
      fill.className = 'fill';
      row.append(fill);
      card.append(row);
      return fill;
    };
    const health = barRow('health', es.health); // Salud (H4b), la primera
    const fills = NEEDS.map((k) => barRow(k, es.needs[k]));

    bar.append(card);
    return { card, love, status, fills, health };
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
        const hp = Math.round(s.health);
        const hpWidth = `${hp}%`;
        if (card.health.style.width !== hpWidth) card.health.style.width = hpWidth;
        card.health.className = `fill ${barLevel(hp, 'need')}`;
        const icon = statusIcon(s);
        const text = icon?.icon ?? '';
        if (c.status.textContent !== text) {
          c.status.textContent = text;
          c.status.title = icon?.label ?? '';
        }
        const coupled = s.partnerId !== null;
        if (c.love.hidden === coupled) c.love.hidden = !coupled;
        c.card.classList.toggle('selected', opts.selection.ids.includes(s.id));
        c.card.classList.toggle('drafted', effectiveDrafted(opts.world, s));
      }
    },
  };
}
