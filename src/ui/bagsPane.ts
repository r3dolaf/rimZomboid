// La pestaña Bolsas de la ficha (H5b2 §7): bolsas puestas, fijarlas, sus listas, lo de las manos y
// «Llevar siempre». Cambia el mundo solo con órdenes; muestra lo pedido aunque esté en pausa.
import { es } from '../i18n/es';
import { effectiveKeep, effectiveList, effectivePinned } from '../sim/bags';
import { ITEM_KINDS, type ItemKind } from '../sim/items';
import { issue } from '../sim/orders';
import type { BagSlot, Survivor, World } from '../sim/types';
import { bagsView } from './describe';

type View = ReturnType<typeof bagsView>;
type Row = View['keep'][number];

export function mountBagsPane(opts: { world: World; survivor: () => Survivor | undefined }): {
  pane: HTMLElement;
  update(s: Survivor): void;
} {
  const pane = document.createElement('div');
  pane.className = 'bags';
  pane.dataset.testid = 'sheet-pane-bags';
  let shown = '';

  /** Lo que pide una lista (de una bolsa o «Llevar siempre») ahora mismo, con lo pendiente. */
  const current = (s: Survivor, bagId: number | null, item: ItemKind): number => {
    if (bagId === null) return effectiveKeep(opts.world, s)[item] ?? 0;
    const b = Object.values(s.bags).find((x) => x?.id === bagId);
    return b ? (effectiveList(opts.world, b)[item] ?? 0) : 0;
  };
  const setCount = (s: Survivor, bagId: number | null, item: ItemKind, n: number) => {
    const v = Math.max(0, Math.min(99, n));
    issue(
      opts.world,
      bagId === null
        ? { type: 'setKeep', survivorId: s.id, item, n: v }
        : { type: 'setBagList', pieceId: bagId, item, n: v },
    );
  };
  const bagIdOf = (el: HTMLElement) => (el.dataset.bag === 'keep' ? null : Number(el.dataset.bag));

  pane.addEventListener('click', (ev) => {
    const s = opts.survivor();
    const el = (ev.target as HTMLElement).closest('button');
    if (!s || !el) return;
    if (el.dataset.pin) {
      const slot = el.dataset.pin as BagSlot;
      const on = !effectivePinned(opts.world, s).includes(slot);
      issue(opts.world, { type: 'pinBag', survivorId: s.id, slot, on });
    } else if (el.dataset.item) {
      const item = el.dataset.item as ItemKind;
      const bagId = bagIdOf(el);
      setCount(s, bagId, item, current(s, bagId, item) + Number(el.dataset.delta));
    }
    el.blur();
  });
  pane.addEventListener('change', (ev) => {
    const s = opts.survivor();
    const el = ev.target as HTMLSelectElement;
    if (!s || el.tagName !== 'SELECT' || !el.value) return;
    const item = el.value as ItemKind;
    const bagId = bagIdOf(el);
    if (current(s, bagId, item) === 0) setCount(s, bagId, item, 1);
  });

  return {
    pane,
    update(s) {
      const v = bagsView(opts.world, s);
      const key = JSON.stringify(v);
      if (key === shown) return;
      shown = key;
      pane.replaceChildren(render(v));
    },
  };
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};

/** Una lista con + y − por cosa y un desplegable para añadir; `bag`: su id o `keep`. */
function listEditor(rows: Row[], bag: string, testid: string): HTMLElement {
  const box = el('div', undefined, 'bag-list');
  box.dataset.testid = `${testid}-list`;
  for (const r of rows) {
    const row = el('div', undefined, 'bag-row');
    const btn = (label: string, delta: number, name: string) => {
      const b = el('button', label);
      b.type = 'button';
      b.dataset.bag = bag;
      b.dataset.item = r.item;
      b.dataset.delta = String(delta);
      b.dataset.testid = `${testid}-${name}-${r.item}`;
      return b;
    };
    row.append(
      btn('−', -1, 'minus'),
      el('span', es.bagsUi.count(r.n, r.name)),
      btn('+', 1, 'plus'),
    );
    box.append(row);
  }
  const add = el('select');
  add.dataset.bag = bag;
  add.dataset.testid = `${testid}-add`;
  const none = el('option', es.bagsUi.add);
  none.value = '';
  add.append(none);
  for (const k of ITEM_KINDS) {
    if (rows.some((r) => r.item === k)) continue;
    const o = el('option', es.items[k][1]);
    o.value = k;
    add.append(o);
  }
  box.append(add);
  return box;
}

function render(v: View): DocumentFragment {
  const f = document.createDocumentFragment();
  const u = es.bagsUi;
  for (const x of v.slots) {
    const row = el('div', undefined, 'bag-slot');
    row.dataset.testid = `bags-${x.slot}`;
    const head = el('div');
    head.append(el('strong', `${x.name}: `));
    if (!x.bag) {
      head.append(el('span', u.nothing, 'muted'));
      row.append(head);
      f.append(row);
      continue;
    }
    head.append(el('span', `${x.bag.name} · ${x.bag.load} `));
    const pin = el('button', x.bag.pinned ? u.pinned : u.pin, x.bag.pinned ? 'selected' : '');
    pin.type = 'button';
    pin.dataset.pin = x.slot;
    pin.dataset.testid = `bag-pin-${x.slot}`;
    head.append(pin);
    row.append(head, el('p', u.inside(x.bag.contents), 'muted'), el('p', u.list));
    row.append(listEditor(x.bag.list, String(x.bag.id), `bag-${x.bag.id}`));
    f.append(row);
  }
  f.append(el('p', v.hands), el('h3', u.keep), listEditor(v.keep, 'keep', 'keep'));
  return f;
}
