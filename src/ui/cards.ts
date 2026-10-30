import { es } from '../i18n/es';
import type { Needs, Survivor, World } from '../sim/types';
import { effectiveDrafted } from '../game/command';
import { allColonists, mapById } from '../sim/game';
import { barLevel, healthIcons, statusIcon, whereText } from './describe';
import type { MapView } from './mapView';
import type { Selection } from './selection';
import './panels.css';

const NEEDS: readonly (keyof Needs)[] = ['hunger', 'sleep', 'social', 'mood'];

interface Card {
  card: HTMLButtonElement;
  love: HTMLElement;
  status: HTMLElement;
  /** Iconos de salud (H5): sangrando, fiebre, náuseas… */
  icons: HTMLElement;
  fills: HTMLElement[];
  health: HTMLElement;
  blood: HTMLElement;
  /** Dónde está, si no es en el mapa que se ve (H5c1 §7). */
  where: HTMLElement;
}

/**
 * Barra inferior: una tarjeta por colono con su Salud y sus necesidades. Siguen a quien está en
 * la colonia, en cualquier mapa o de viaje (H5c1): los de fuera dicen dónde están y, al pulsar, se
 * pasa a su mapa.
 */
export function mountCards(
  root: HTMLElement,
  opts: { world: World; selection: Selection; view?: MapView },
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
      card.blur();
      const where = allColonists(opts.world).find((x) => x.s.id === s.id)?.where;
      if (where === 'travel') return; // de viaje no hay mapa al que ir
      if (opts.view && where !== undefined && where !== opts.view.mapId) {
        opts.view.set(where);
        opts.selection.set(s.id);
        return;
      }
      // Mayús (H4e): lo añade o lo quita; si no, solo él (o nadie, si ya era el único).
      if (ev.shiftKey) opts.selection.toggle(s.id);
      else opts.selection.set(opts.selection.id === s.id ? null : s.id);
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
    const icons = document.createElement('span');
    icons.className = 'health-icons';
    icons.dataset.testid = 'health-icons';
    const who = document.createElement('span');
    who.append(name, love);
    const right = document.createElement('span');
    right.append(icons, status);
    head.append(who, right);
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
    const blood = barRow('blood', es.healthUi.blood); // Sangre (H5), justo debajo
    const fills = NEEDS.map((k) => barRow(k, es.needs[k]));
    const where = document.createElement('div');
    where.className = 'where';
    where.hidden = true;
    card.append(where);

    bar.append(card);
    return { card, love, status, icons, fills, health, blood, where };
  };

  return {
    update() {
      const everyone = allColonists(opts.world);
      const here = new Set(everyone.map(({ s }) => s.id));
      for (const [id, c] of cards)
        if (!here.has(id)) {
          c.card.remove();
          cards.delete(id);
        }
      const seen = opts.view?.mapId ?? 0;
      for (const { s, where } of everyone) {
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
        const blood = `${Math.round(s.blood)}%`;
        if (card.blood.style.width !== blood) card.blood.style.width = blood;
        const icons = healthIcons(s, opts.world.tick);
        const iconText = icons.map((i) => i.icon).join('');
        if (card.icons.textContent !== iconText) {
          card.icons.textContent = iconText;
          card.icons.title = icons.map((i) => i.label).join(', ');
        }
        const icon = statusIcon(s);
        const text = icon?.icon ?? '';
        if (c.status.textContent !== text) {
          c.status.textContent = text;
          c.status.title = icon?.label ?? '';
        }
        const coupled = s.partnerId !== null;
        if (c.love.hidden === coupled) c.love.hidden = !coupled;
        c.card.classList.toggle('selected', opts.selection.ids.includes(s.id));
        const map = where === 'travel' ? undefined : mapById(opts.world, where);
        c.card.classList.toggle('drafted', map !== undefined && effectiveDrafted(map, s));
        const away = where !== seen;
        c.card.classList.toggle('away', away);
        if (c.where.hidden === away) c.where.hidden = !away;
        if (away) {
          const icon = where === 'travel' ? es.maps.travelIcon : es.maps.awayIcon;
          const text = `${icon} ${whereText(opts.world, s.id)}`;
          if (c.where.textContent !== text) c.where.textContent = text;
        }
      }
    },
  };
}
