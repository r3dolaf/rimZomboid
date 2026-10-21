import { es } from '../i18n/es';
import { issue } from '../sim/orders';
import type { Stance, Survivor, WorkType, World } from '../sim/types';
import type { Flag } from './flag';
import './panels.css';

export const STANCES: readonly Stance[] = ['fight', 'flee', 'decide'];

/** Columnas, en el orden de criticidad (spec H4a §3.1). */
export const WORKS: readonly WorkType[] = ['social', 'build', 'haul', 'chop', 'loot'];

/**
 * Panel de Trabajos (spec H4a §5): una fila por colono, una casilla por trabajo y su postura
 * (spec H4b §8).
 */
export function mountWorkPanel(
  root: HTMLElement,
  opts: { world: World; open: Flag },
): { update(): void } {
  const panel = document.createElement('aside');
  panel.className = 'work-panel';
  panel.dataset.testid = 'work-panel';
  panel.hidden = true;
  const head = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = es.workPanel;
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'close';
  x.textContent = '✕';
  x.dataset.testid = 'work-close';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', () => opts.open.set(false));
  head.append(title, x);

  const table = document.createElement('table');
  const headRow = document.createElement('tr');
  for (const text of ['', ...WORKS.map((k) => es.works[k]), es.stanceTitle]) {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.append(th);
  }
  const thead = document.createElement('thead');
  thead.append(headRow);
  const tbody = document.createElement('tbody');
  table.append(thead, tbody);
  panel.append(head, table);
  root.append(panel);

  // Una fila por colono; se crean y se quitan según quién está (las casillas no se rehacen).
  const rows = new Map<
    number,
    { tr: HTMLTableRowElement; boxes: HTMLInputElement[]; stance: HTMLSelectElement }
  >();
  const addRow = (s: Survivor) => {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = s.name;
    tr.append(name);
    const boxes = WORKS.map((work) => {
      const td = document.createElement('td');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.testid = `work-${s.id}-${work}`;
      box.title = `${s.name}: ${es.works[work]}`;
      box.addEventListener('change', () =>
        issue(opts.world, { type: 'setWork', survivorId: s.id, work, enabled: box.checked }),
      );
      td.append(box);
      tr.append(td);
      return box;
    });
    // Postura (H4b): Pelear, Huir o Decidir.
    const td = document.createElement('td');
    const stance = document.createElement('select');
    stance.dataset.testid = `work-${s.id}-stance`;
    stance.title = `${s.name}: ${es.stanceTitle}`;
    for (const k of STANCES) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = es.stances[k];
      o.title = es.stanceHints[k];
      stance.append(o);
    }
    stance.addEventListener('change', () =>
      issue(opts.world, {
        type: 'setStance',
        survivorId: s.id,
        stance: stance.value as Stance,
      }),
    );
    td.append(stance);
    tr.append(td);
    tbody.append(tr);
    rows.set(s.id, { tr, boxes, stance });
  };

  return {
    update() {
      const { world } = opts;
      if (panel.hidden === opts.open.value) panel.hidden = !opts.open.value;
      if (!opts.open.value) return;
      const here = new Set(world.survivors.map((s) => s.id));
      for (const [id, r] of rows)
        if (!here.has(id)) {
          r.tr.remove();
          rows.delete(id);
        }
      for (const s of world.survivors) {
        if (!rows.has(s.id)) addRow(s);
        const r = rows.get(s.id)!;
        r.boxes.forEach((box, i) => {
          box.checked = effectiveWork(world, s, WORKS[i]!);
        });
        const st = effectiveStance(world, s);
        if (r.stance.value !== st) r.stance.value = st;
      }
    },
  };
}

/** El permiso con las órdenes pendientes ya aplicadas (para verlo marcado aunque esté en pausa). */
export function effectiveWork(w: World, s: Survivor, work: WorkType): boolean {
  let on = s.work[work];
  for (const o of w.orders)
    if (o.type === 'setWork' && o.survivorId === s.id && o.work === work) on = o.enabled;
  return on;
}

/** La postura con las órdenes pendientes ya aplicadas. */
export function effectiveStance(w: World, s: Survivor): Stance {
  let st = s.stance;
  for (const o of w.orders) if (o.type === 'setStance' && o.survivorId === s.id) st = o.stance;
  return st;
}

/** Si tiene el arma fijada, con las órdenes pendientes ya aplicadas. */
export function effectiveLock(w: World, s: Survivor): boolean {
  let on = s.weaponLocked;
  for (const o of w.orders) if (o.type === 'lockWeapon' && o.survivorId === s.id) on = o.locked;
  return on;
}
