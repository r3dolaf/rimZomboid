// @vitest-environment jsdom
// H4d §8: el panel Fabricar — lo que hay, la mesa, los pedidos y sus botones.
import { expect, test } from 'vitest';
import { BILL_DEFAULT_TARGET } from '../sim/balance';
import { effectiveBills, issue, ordersSystem } from '../sim/orders';
import type { Bill } from '../sim/types';
import { createWorld } from '../sim/world';
import { mountCraftPanel } from './craftPanel';
import { createFlag } from './flag';

test('los pedidos con las órdenes pendientes ya aplicadas (con los ids que tendrán), sin tocar el mundo', () => {
  const w = createWorld(5);
  issue(w, { type: 'addBill', recipe: 'bandages' });
  ordersSystem(w);
  const a = w.bills[0]!;
  issue(w, { type: 'addBill', recipe: 'curtains' });
  issue(w, { type: 'setBill', billId: a.id, mode: 'count', target: 3 });
  issue(w, { type: 'moveBill', billId: a.id + 1, dir: -1 });
  const seen = effectiveBills(w);
  expect(seen).toEqual([
    { id: a.id + 1, recipe: 'curtains', mode: 'until', target: BILL_DEFAULT_TARGET, done: 0 },
    { id: a.id, recipe: 'bandages', mode: 'count', target: 3, done: 0 },
  ]);
  expect(w.bills).toEqual([
    { id: a.id, recipe: 'bandages', mode: 'until', target: BILL_DEFAULT_TARGET, done: 0 },
  ]);
  expect(w.nextBillId).toBe(a.id + 1);
  issue(w, { type: 'removeBill', billId: a.id });
  expect(effectiveBills(w).map((b) => b.id)).toEqual([a.id + 1]);
  ordersSystem(w);
  expect(w.bills).toEqual(effectiveBills(w));
});

function setup() {
  const root = document.createElement('div');
  document.body.replaceChildren(root); // los select solo avisan del cambio si están en el documento
  const world = createWorld(5);
  const open = createFlag();
  const panel = mountCraftPanel(root, { world, open });
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  return { root, world, open, panel, q };
}

test('oculto hasta que se abre; lo que hay en el almacén y "Hace falta una mesa" si no hay', () => {
  const { world, open, panel, q } = setup();
  world.furniture = world.furniture.filter((f) => f.kind !== 'table');
  world.storage.items = { ...world.storage.items, cloth: 6, thread: 10, curtains: 1, needle: 0 };
  panel.update();
  expect(q('craft-panel').hidden).toBe(true);
  open.set(true);
  panel.update();
  expect(q('craft-panel').hidden).toBe(false);
  expect(q('craft-stock').textContent).toBe(
    'En el almacén: 6 telas · 0 retales de vaquero · 0 tiras de cuero · 10 usos de hilo · 1 juego de cortinas · 0 agujas',
  );
  expect(q('craft-no-table').hidden).toBe(false);
  expect(q('craft-no-table').textContent).toBe('Hace falta una mesa');
  world.furniture.push({ id: 900, kind: 'table', pos: { x: 1, y: 1 } });
  panel.update();
  expect(q('craft-no-table').hidden).toBe(true);
});

test('un botón por receta; añadir se ve al momento aunque esté en pausa', () => {
  const { world, open, panel, q } = setup();
  open.set(true);
  panel.update();
  expect(q('craft-add-bandages').textContent).toBe('+ Vendas');
  expect(q('craft-add-curtains').textContent).toBe('+ Coser cortinas'); // H5c1
  expect(q('craft-add-unpick').textContent).toBe('+ Deshacer cortinas');
  expect(q('craft-line-curtains').textContent).toContain('3 telas y 2 usos de hilo, con aguja'); // H5c1
  expect(q('craft-empty').hidden).toBe(false);
  q('craft-add-bandages').click();
  expect(world.orders).toContainEqual({ type: 'addBill', recipe: 'bandages' });
  panel.update();
  const id = world.nextBillId;
  expect(q('craft-empty').hidden).toBe(true);
  expect(q(`bill-${id}`).querySelector('.name')!.textContent).toBe('Vendas');
  expect((q(`bill-${id}-mode`) as HTMLSelectElement).value).toBe('until');
  expect(q(`bill-${id}-target`).textContent).toBe(String(BILL_DEFAULT_TARGET));
  expect(q(`bill-${id}-done`).hidden).toBe(true);
});

test('cada fila: modo, − N +, ↑ ↓ y ✕ dan su orden; "hechos x/N" en los de veces', () => {
  const { world, open, panel, q } = setup();
  issue(world, { type: 'addBill', recipe: 'bandages' });
  issue(world, { type: 'addBill', recipe: 'curtains' });
  ordersSystem(world);
  const [a, b] = world.bills as [Bill, Bill];
  open.set(true);
  panel.update();
  const mode = q(`bill-${a.id}-mode`) as HTMLSelectElement;
  expect([...mode.options].map((o) => o.textContent)).toEqual([
    `Hasta tener ${BILL_DEFAULT_TARGET} vendas`,
    `Hacer ${BILL_DEFAULT_TARGET} veces`,
  ]);
  mode.value = 'count';
  mode.dispatchEvent(new Event('change'));
  q(`bill-${a.id}-more`).click();
  q(`bill-${b.id}-less`).click();
  q(`bill-${b.id}-up`).click();
  expect(world.orders).toEqual([
    { type: 'setBill', billId: a.id, mode: 'count' },
    { type: 'setBill', billId: a.id, target: BILL_DEFAULT_TARGET + 1 },
    { type: 'setBill', billId: b.id, target: BILL_DEFAULT_TARGET - 1 },
    { type: 'moveBill', billId: b.id, dir: -1 },
  ]);
  panel.update();
  const rows = [...q('craft-bills').children].map((r) => (r as HTMLElement).dataset.testid);
  expect(rows).toEqual([`bill-${b.id}`, `bill-${a.id}`]);
  expect(q(`bill-${a.id}-target`).textContent).toBe(String(BILL_DEFAULT_TARGET + 1));
  expect(q(`bill-${a.id}-done`).hidden).toBe(false);
  expect(q(`bill-${a.id}-done`).textContent).toBe(`hechos 0/${BILL_DEFAULT_TARGET + 1}`);
  // El de arriba no sube y el de abajo no baja; N no baja de 1.
  expect((q(`bill-${b.id}-up`) as HTMLButtonElement).disabled).toBe(true);
  expect((q(`bill-${a.id}-down`) as HTMLButtonElement).disabled).toBe(true);
  ordersSystem(world);
  issue(world, { type: 'setBill', billId: b.id, target: 1 });
  panel.update();
  expect((q(`bill-${b.id}-less`) as HTMLButtonElement).disabled).toBe(true);
  q(`bill-${b.id}-down`).click();
  q(`bill-${a.id}-remove`).click();
  expect(world.orders.slice(-2)).toEqual([
    { type: 'moveBill', billId: b.id, dir: 1 },
    { type: 'removeBill', billId: a.id },
  ]);
  panel.update();
  expect(q(`bill-${a.id}`)).toBeNull();
});

test('la ✕ lo cierra', () => {
  const { open, panel, q } = setup();
  open.set(true);
  panel.update();
  q('craft-close').click();
  expect(open.value).toBe(false);
});
