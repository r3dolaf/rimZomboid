import { es } from '../i18n/es';
import { RECIPES, TICKS_PER_HOUR } from '../sim/balance';
import type { ItemKind } from '../sim/items';
import { craftBlocker } from '../sim/jobs/craft';
import { effectiveBills, issue } from '../sim/orders';
import type { Bill, RecipeId, World } from '../sim/types';
import { listNames } from './describe';
import type { Flag } from './flag';
import './panels.css';

/** Las recetas por grupos (H5c1 §8). */
const GROUPS: readonly { title: keyof typeof es.craftGroups; recipes: readonly RecipeId[] }[] = [
  { title: 'heal', recipes: ['bandages'] },
  { title: 'cloth', recipes: ['curtains', 'unpick'] },
  // H5b: sobre prendas
  { title: 'clothes', recipes: ['mend', 'pad', 'unpickGarment', 'wash'] },
  { title: 'bags', recipes: ['sewBag'] }, // H5b2
];

/** Lo que se enseña del almacén (spec H4d §8; H5b, los retales y las tiras). */
const STOCK: readonly ItemKind[] = ['cloth', 'denim', 'leather', 'thread', 'curtains', 'needle'];

const count = (k: ItemKind, n: number) => `${n} ${es.items[k][n === 1 ? 0 : 1]}`;
const entries = (part: Partial<Record<ItemKind, number>>) =>
  Object.entries(part) as [ItemKind, number][];

/** «usa → da · dónde · tiempo» (H5c1 §8). */
export function recipeLine(id: RecipeId): string {
  const r = RECIPES[id];
  const uses = [
    ...(r.piece ? [es.craftPiece[r.piece]] : []),
    ...entries(r.input).map(([k, n]) => count(k, n)),
    ...(r.material ? [es.craftMaterial(r.material)] : []),
    ...(r.water ? [es.craftWater(r.water)] : []),
  ];
  const tool = r.tool ? `, ${es.craftWith[r.tool]}` : '';
  const gives = r.makes
    ? `1 ${es.bags[r.makes]}`
    : (es.craftGives[id] ?? listNames(entries(r.output).map(([k, n]) => count(k, n))));
  const minutes = Math.round((r.ticks / TICKS_PER_HOUR) * 60);
  return es.craftLine(
    `${listNames(uses)}${tool}`,
    gives,
    es.stations[r.station ?? 'table'],
    es.duration(minutes),
  );
}

/** Por qué no se puede hacer ahora, o `null` si se puede. */
function whyNot(w: World, id: RecipeId): string | null {
  const b = craftBlocker(w, RECIPES[id]);
  const t = es.craftWhy;
  if (!b) return null;
  switch (b.kind) {
    case 'station':
      return t.station[b.station];
    case 'water':
      return t.water;
    case 'tool':
      return t.tool[b.tool];
    case 'input':
      return t.input(count(b.item, b.missing), b.missing);
    case 'material':
      return t.material;
    case 'piece':
      return t.piece[b.piece];
  }
}

/** El modo de un pedido, dicho claro: «Hacer 5 veces», «Hasta tener 10 vendas»… */
function modeText(bill: Bill, mode: Bill['mode']): string {
  if (mode === 'always') return es.billModes.always;
  if (mode === 'count') return es.billModes.count(bill.target);
  const r = RECIPES[bill.recipe];
  const many = bill.target !== 1;
  const first = entries(r.output)[0]?.[0];
  const what = r.makes
    ? es.bagsMany(r.makes, many)
    : first
      ? es.items[first][many ? 1 : 0]
      : es.recipes[bill.recipe].name;
  return es.billModes.until(bill.target, what);
}

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
  const noTub = document.createElement('p');
  noTub.className = 'craft-warning';
  noTub.dataset.testid = 'craft-no-tub';
  noTub.textContent = es.craftNoTub;
  const empty = document.createElement('p');
  empty.className = 'craft-empty';
  empty.dataset.testid = 'craft-empty';
  empty.textContent = es.craftEmpty;
  const list = document.createElement('ol');
  list.className = 'craft-bills';
  list.dataset.testid = 'craft-bills';

  // Para añadir pedidos, por grupos: cada receta con «usa → da · dónde · tiempo» y, si ahora no se
  // puede, por qué (H5c1 §8).
  const add = document.createElement('div');
  add.className = 'craft-add';
  const whys: { recipe: RecipeId; el: HTMLElement }[] = [];
  for (const g of GROUPS) {
    const group = document.createElement('div');
    group.className = 'craft-group';
    const h = document.createElement('h3');
    h.textContent = es.craftGroups[g.title];
    group.append(h);
    for (const recipe of g.recipes) {
      const row = document.createElement('div');
      row.className = 'craft-recipe';
      row.dataset.testid = `craft-recipe-${recipe}`;
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.testid = `craft-add-${recipe}`;
      b.textContent = es.craftAdd(es.recipes[recipe].name);
      b.addEventListener('click', () => {
        issue(opts.world, { type: 'addBill', recipe });
        b.blur();
      });
      const line = document.createElement('span');
      line.className = 'line';
      line.dataset.testid = `craft-line-${recipe}`;
      line.textContent = recipeLine(recipe);
      const why = document.createElement('span');
      why.className = 'why';
      why.dataset.testid = `craft-why-${recipe}`;
      why.hidden = true;
      row.append(b, line, why);
      group.append(row);
      whys.push({ recipe, el: why });
    }
    add.append(group);
  }
  panel.append(head, stock, noTable, noTub, empty, list, add);
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
    // Sobre prendas (H5b): "siempre que haya" o "veces"; lo demás, "hasta tener" o "veces".
    const piece = RECIPES[bill.recipe].piece !== undefined;
    for (const k of piece ? (['always', 'count'] as const) : (['until', 'count'] as const)) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = modeText(bill, k);
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
    target.hidden = bill.mode === 'always';
    const less = button(`bill-${id}-less`, '−', es.billLess, () =>
      issue(world, { type: 'setBill', billId: id, target: bill.target - 1 }),
    );
    less.disabled = bill.target <= 1;
    less.hidden = bill.mode === 'always';
    const more = button(`bill-${id}-more`, '+', es.billMore, () =>
      issue(world, { type: 'setBill', billId: id, target: bill.target + 1 }),
    );
    more.hidden = bill.mode === 'always';
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
      const bills = effectiveBills(world);
      // Falta la mesa (o el barreño, para lavar) si hay algún pedido que la necesite… o ninguno.
      const needs = (station: 'table' | 'tub') =>
        bills.length === 0
          ? station === 'table'
          : bills.some((b) => (RECIPES[b.recipe].station ?? 'table') === station);
      const hasTable = !needs('table') || world.furniture.some((f) => f.kind === 'table');
      if (noTable.hidden !== hasTable) noTable.hidden = hasTable;
      const hasTub = !needs('tub') || world.furniture.some((f) => f.kind === 'tub');
      if (noTub.hidden !== hasTub) noTub.hidden = hasTub;
      if (empty.hidden !== bills.length > 0) empty.hidden = bills.length > 0;
      // Si arriba ya dice que falta la mesa o el barreño, no se repite en cada receta.
      const said = [!noTable.hidden && es.craftNoTable, !noTub.hidden && es.craftNoTub];
      for (const { recipe, el } of whys) {
        const raw = whyNot(world, recipe);
        const why = raw !== null && said.includes(raw) ? null : raw;
        if (el.hidden !== (why === null)) el.hidden = why === null;
        if (why !== null && el.textContent !== why) el.textContent = why;
      }
      const key = JSON.stringify(bills);
      if (key === shown) return;
      shown = key;
      list.replaceChildren(...bills.map((b, i) => row(b, i, bills.length)));
    },
  };
}
