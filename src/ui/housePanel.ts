import { es } from '../i18n/es';
import { isEmpty } from '../sim/items';
import { houseMarked } from '../sim/orders';
import type { World } from '../sim/types';
import type { Selection } from './selection';
import './panels.css';

/** Ficha de la casa seleccionada: si está marcada y cómo va el saqueo. */
export function mountHousePanel(
  root: HTMLElement,
  opts: { world: World; selection: Selection },
): { update(): void } {
  const panel = document.createElement('aside');
  panel.className = 'sheet house';
  panel.dataset.testid = 'house-panel';
  panel.hidden = true;
  const head = document.createElement('header');
  const title = document.createElement('h2');
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'close';
  x.textContent = '✕';
  x.dataset.testid = 'house-close';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', () => opts.selection.set(null));
  head.append(title, x);
  const body = document.createElement('ul');
  panel.append(head, body);
  root.append(panel);

  let shown = '';
  return {
    update() {
      const id = opts.selection.id;
      const house = opts.world.houses.find((h) => h.id === id);
      if (!house) {
        panel.hidden = true;
        shown = '';
        return;
      }
      const cs = opts.world.containers.filter((c) => c.houseId === house.id);
      const lines = [
        houseMarked(opts.world, house.id) ? es.houseMarked : es.houseUnmarked,
        es.houseSearched(cs.filter((c) => c.searched).length, cs.length),
        es.houseEmpty(cs.filter((c) => c.searched && isEmpty(c.items)).length),
      ];
      panel.hidden = false;
      const key = `${house.id}|${lines.join('|')}`;
      if (key === shown) return;
      shown = key;
      title.textContent = es.house(house.id);
      body.replaceChildren(
        ...lines.map((t) => {
          const li = document.createElement('li');
          li.textContent = t;
          return li;
        }),
      );
    },
  };
}
