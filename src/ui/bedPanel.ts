import { es } from '../i18n/es';
import { issue } from '../sim/orders';
import type { World } from '../sim/types';
import { personName } from './describe';
import type { Selection } from './selection';
import './panels.css';

/** Ficha de la cama (H5 §6): de quién es y la casilla Cama de hospital. */
export function mountBedPanel(
  root: HTMLElement,
  opts: { world: World; selection: Selection },
): { update(): void } {
  const panel = document.createElement('aside');
  panel.className = 'bed-panel';
  panel.dataset.testid = 'bed-panel';
  panel.hidden = true;
  const head = document.createElement('header');
  const title = document.createElement('h2');
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'close';
  x.textContent = '✕';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', () => opts.selection.set(null));
  head.append(title, x);
  const label = document.createElement('label');
  label.title = es.bed.hospitalHint;
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.dataset.testid = 'bed-medical';
  box.addEventListener('change', () => {
    const id = opts.selection.id;
    if (id !== null) issue(opts.world, { type: 'setMedical', bedId: id, on: box.checked });
  });
  label.append(box, document.createTextNode(` ${es.bed.hospital}`));
  panel.append(head, label);
  root.append(panel);

  return {
    update() {
      const w = opts.world;
      const bed = w.beds.find((b) => b.id === opts.selection.id);
      panel.hidden = !bed;
      if (!bed) return;
      // Con la orden aún sin aplicar, lo que se ha pedido.
      const pending = w.orders.find((o) => o.type === 'setMedical' && o.bedId === bed.id);
      const medical = pending?.type === 'setMedical' ? pending.on : bed.medical === true;
      const text = medical
        ? es.bed.hospital
        : bed.ownerId === null
          ? es.bed.noOwner
          : es.bed.of(personName(w, bed.ownerId));
      if (title.textContent !== text) title.textContent = text;
      if (box.checked !== medical) box.checked = medical;
    },
  };
}
