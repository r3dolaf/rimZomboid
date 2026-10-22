import { es } from '../i18n/es';
import { isEmpty } from '../sim/items';
import { houseMarked } from '../sim/orders';
import { Tile, type World } from '../sim/types';
import { buildingTitle } from './describe';
import type { Selection } from './selection';
import './panels.css';

/** Ficha del edificio seleccionado: su nombre, si está marcado o atrancado y cómo va el saqueo. */
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
      // Solo cuenta los contenedores que se han visto: el resto el jugador no los conoce.
      const w = opts.world;
      const cs = w.containers.filter(
        (c) => c.houseId === house.id && w.seen[c.pos.y * w.grid.width + c.pos.x] === 1,
      );
      const lines = [houseMarked(w, house.id) ? es.houseMarked : es.houseUnmarked];
      // Puerta atrancada (H4d), si se ha visto.
      const door = house.door.y * w.grid.width + house.door.x;
      if (w.seen[door] === 1 && w.grid.tiles[door] === Tile.LockedDoor) lines.push(es.houseLocked);
      if (cs.length === 0) lines.push(es.houseUnexplored);
      else
        lines.push(
          es.houseSearched(cs.filter((c) => c.searched).length, cs.length),
          es.houseEmpty(cs.filter((c) => c.searched && isEmpty(c.items)).length),
        );
      panel.hidden = false;
      const key = `${house.id}|${lines.join('|')}`;
      if (key === shown) return;
      shown = key;
      title.textContent = buildingTitle(w, house.id);
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
