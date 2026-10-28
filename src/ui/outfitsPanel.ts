import { es } from '../i18n/es';
import { GARMENTS } from '../sim/balance';
import { GARMENT_KINDS } from '../sim/clothes';
import { issue } from '../sim/orders';
import { effectiveOutfits } from '../sim/outfits';
import type { BodyPart, GarmentKind, Outfit, World } from '../sim/types';
import type { Flag } from './flag';
import './panels.css';

/** Las prendas agrupadas por zona: cabeza, torso y brazos, piernas. */
const covering = (z: BodyPart) =>
  GARMENT_KINDS.filter((k) => (GARMENTS[k].covers as readonly BodyPart[]).includes(z));
const GROUPS: readonly { id: 'head' | 'torso' | 'legs'; kinds: GarmentKind[] }[] = [
  { id: 'head', kinds: covering('head') },
  { id: 'torso', kinds: covering('torso') },
  { id: 'legs', kinds: covering('leftLeg') },
];

/**
 * Panel Atuendos (spec H5b §8): los atuendos arriba (uno elegido), y del elegido su nombre, las
 * casillas de cada prenda por zona y "Acepta ropa de muertos"; crear y borrar. Ve las órdenes
 * pendientes, así responde también en pausa.
 */
export function mountOutfitsPanel(
  root: HTMLElement,
  opts: { world: World; open: Flag },
): { update(): void } {
  const t = es.outfitsUi;
  const panel = document.createElement('aside');
  panel.className = 'work-panel outfits-panel';
  panel.dataset.testid = 'outfits-panel';
  panel.hidden = true;
  const head = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = t.title;
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'close';
  x.textContent = '✕';
  x.dataset.testid = 'outfits-close';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', () => opts.open.set(false));
  head.append(title, x);

  const tabs = document.createElement('nav');
  tabs.className = 'tabs';
  const add = document.createElement('button');
  add.type = 'button';
  add.dataset.testid = 'outfit-add';
  add.textContent = t.add;
  add.title = t.addHint;
  add.addEventListener('click', () => {
    issue(opts.world, { type: 'addOutfit' });
    selectLast = true;
    add.blur();
  });

  // El elegido: nombre, borrar, ropa de muertos y las casillas.
  const nameRow = document.createElement('label');
  nameRow.textContent = `${t.name}: `;
  const name = document.createElement('input');
  name.type = 'text';
  name.dataset.testid = 'outfit-name';
  name.addEventListener('change', () => {
    if (selected !== null)
      issue(opts.world, { type: 'renameOutfit', outfitId: selected, name: name.value });
  });
  nameRow.append(name);
  const del = document.createElement('button');
  del.type = 'button';
  del.dataset.testid = 'outfit-delete';
  del.textContent = t.delete;
  del.title = t.deleteHint;
  del.addEventListener('click', () => {
    if (selected !== null) issue(opts.world, { type: 'deleteOutfit', outfitId: selected });
    del.blur();
  });
  const deadRow = document.createElement('label');
  const dead = document.createElement('input');
  dead.type = 'checkbox';
  dead.dataset.testid = 'outfit-dead';
  dead.addEventListener('change', () => {
    if (selected !== null)
      issue(opts.world, { type: 'setOutfitDead', outfitId: selected, on: dead.checked });
  });
  deadRow.append(dead, document.createTextNode(` ${t.dead}`));
  const boxes = new Map<GarmentKind, HTMLInputElement>();
  const groups = GROUPS.map((g) => {
    const box = document.createElement('div');
    box.className = 'outfit-group';
    const h = document.createElement('h3');
    h.textContent = t.groups[g.id];
    box.append(h);
    for (const k of g.kinds) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.testid = `outfit-garment-${k}`;
      input.addEventListener('change', () => {
        if (selected !== null)
          issue(opts.world, {
            type: 'setOutfitGarment',
            outfitId: selected,
            garment: k,
            on: input.checked,
          });
      });
      label.append(input, document.createTextNode(` ${es.garments[k].name}`));
      box.append(label);
      boxes.set(k, input);
    }
    return box;
  });
  panel.append(head, tabs, nameRow, del, deadRow, ...groups);
  root.append(panel);

  let selected: number | null = null;
  let selectLast = false;
  let tabsShown = '';

  const showTabs = (outfits: Outfit[]) => {
    tabs.replaceChildren(
      ...outfits.map((o) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.testid = `outfit-tab-${o.id}`;
        b.textContent = o.name;
        b.classList.toggle('selected', o.id === selected);
        b.addEventListener('click', () => {
          selected = o.id;
          tabsShown = '';
          b.blur();
        });
        return b;
      }),
      add,
    );
  };

  return {
    update() {
      if (panel.hidden === opts.open.value) panel.hidden = !opts.open.value;
      if (!opts.open.value) return;
      const outfits = effectiveOutfits(opts.world);
      if (selectLast && outfits.length > 0) {
        selected = outfits.at(-1)!.id;
        selectLast = false;
      }
      if (!outfits.some((o) => o.id === selected)) selected = outfits[0]?.id ?? null;
      const key = JSON.stringify([selected, outfits.map((o) => [o.id, o.name])]);
      if (key !== tabsShown) {
        tabsShown = key;
        showTabs(outfits);
      }
      const o = outfits.find((x) => x.id === selected);
      if (!o) return;
      if (document.activeElement !== name && name.value !== o.name) name.value = o.name;
      del.disabled = outfits.length <= 1;
      dead.checked = o.dead;
      for (const [k, input] of boxes) input.checked = o.allowed.includes(k);
    },
  };
}
