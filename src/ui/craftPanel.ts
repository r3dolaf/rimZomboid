import { es } from '../i18n/es';
import type { ItemKind } from '../sim/items';
import { effectiveBills, issue } from '../sim/orders';
import type { Bill, RecipeId, World } from '../sim/types';
import type { Flag } from './flag';
import './panels.css';

const RECIPE_IDS: readonly RecipeId[] = ['bandages', 'curtains', 'unpick'];

/** Lo que se enseña del almacén (spec H4d §8). */
const STOCK: readonly ItemKind[] = ['cloth', 'thread', 'curtains', 'needle'];

const count = (k: ItemKind, n: number) => `${n} ${es.items[k][n === 1 ? 0 : 1]}`;

/**
 * Panel Fabricar (spec H4d §8): lo que hay en el almacén, si falta la mesa y los pedidos, de arriba
 * abajo, con su modo, su N, las flechas y la ✕; debajo, un botón para añadir cada receta.
 */
export function mountCraftPanel(
  root: HTMLElement,
  opts: { world: World; open: Flag },
): { update(): void } {
  const panel = document.createElement('aside');
  panel.className = 'work-panel craft-panel';
  panel.dataset.testid = 'craft-panel';
  panel.hidden = true;
  const head = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = es.craftPanel;
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'close';
  x.textContent = '✕';
  x.dataset.testid = 'craft-close';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', () => opts.open.set(false));
  head.append(title, x);

  const stock = document.createElement('p');
  stock.className = 'craft-stock';
  stock.dataset.testid = 'craft-stock';
  const noTable = document.createElement('p');
  noTable.className = 'craft-warning';
  noTable.dataset.testid = 'craft-no-table';
  noTable.textContent = es.craftNoTable;
  const empty = document.createElement('p');
  empty.className = 'craft-empty';
  empty.dataset.testid = 'craft-empty';
  empty.textContent = es.craftEmpty;
  const list = document.createElement('ol');
  list.className = 'craft-bills';
  list.dataset.testid = 'craft-bills';

  const add = document.createElement('div');
  add.className = 'craft-add';
  for (const recipe of RECIPE_IDS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.testid = `craft-add-${recipe}`;
    b.textContent = es.craftAdd(es.recipes[recipe].name);
    b.title = es.craftNeeds[recipe];
    b.addEventListener('click', () => {
      issue(opts.world, { type: 'addBill', recipe });
      b.blur();
    });
    add.append(b);
  }
  panel.append(head, stock, noTable, empty, list, add);
  root.append(panel);

  const button = (testid: string, text: string, hint: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.testid = testid;
    b.textContent = text;
    b.title = hint;
    b.setAttribute('aria-label', hint);
    b.addEventListener('click', () => {
      onClick();
      b.blur();
    });
    return b;
  };

  /** Una fila por pedido; se rehace la lista entera cuando cambia algo (pasa pocas veces). */
  const row = (bill: Bill, i: number, n: number) => {
    const { world } = opts;
    const id = bill.id;
    const li = document.createElement('li');
    li.dataset.testid = `bill-${id}`;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = es.recipes[bill.recipe].name;
    const mode = document.createElement('select');
    mode.dataset.testid = `bill-${id}-mode`;
    for (const k of ['until', 'count'] as const) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = es.billModes[k];
      mode.append(o);
    }
    mode.value = bill.mode;
    mode.addEventListener('change', () =>
      issue(world, { type: 'setBill', billId: id, mode: mode.value as Bill['mode'] }),
    );
    const target = document.createElement('span');
    target.className = 'target';
    target.dataset.testid = `bill-${id}-target`;
    target.textContent = String(bill.target);
    const less = button(`bill-${id}-less`, '−', es.billLess, () =>
      issue(world, { type: 'setBill', billId: id, target: bill.target - 1 }),
    );
    less.disabled = bill.target <= 1;
    const more = button(`bill-${id}-more`, '+', es.billMore, () =>
      issue(world, { type: 'setBill', billId: id, target: bill.target + 1 }),
    );
    const up = button(`bill-${id}-up`, '↑', es.billUp, () =>
      issue(world, { type: 'moveBill', billId: id, dir: -1 }),
    );
    up.disabled = i === 0;
    const down = button(`bill-${id}-down`, '↓', es.billDown, () =>
      issue(world, { type: 'moveBill', billId: id, dir: 1 }),
    );
    down.disabled = i === n - 1;
    const remove = button(`bill-${id}-remove`, '✕', es.billRemove, () =>
      issue(world, { type: 'removeBill', billId: id }),
    );
    const done = document.createElement('span');
    done.className = 'done';
    done.dataset.testid = `bill-${id}-done`;
    done.textContent = es.billDone(bill.done, bill.target);
    done.hidden = bill.mode !== 'count';
    li.append(name, mode, less, target, more, done, up, down, remove);
    return li;
  };

  let shown = '';
  return {
    update() {
      const { world } = opts;
      if (panel.hidden === opts.open.value) panel.hidden = !opts.open.value;
      if (!opts.open.value) return;
      const stockText = es.craftStock(STOCK.map((k) => count(k, world.storage.items[k])));
      if (stock.textContent !== stockText) stock.textContent = stockText;
      const hasTable = world.furniture.some((f) => f.kind === 'table');
      if (noTable.hidden !== hasTable) noTable.hidden = hasTable;
      const bills = effectiveBills(world);
      if (empty.hidden !== bills.length > 0) empty.hidden = bills.length > 0;
      const key = JSON.stringify(bills);
      if (key === shown) return;
      shown = key;
      list.replaceChildren(...bills.map((b, i) => row(b, i, bills.length)));
    },
  };
}
