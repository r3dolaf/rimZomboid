import { es } from '../i18n/es';
import { bagsIn, effectiveList, garments } from '../sim/bags';
import { attachListHandlers, listEditor } from './bagsPane';
import { ITEM_KINDS } from '../sim/items';
import { bagName, formatItems, garmentText, listRows } from './describe';
import type { World } from '../sim/types';
import type { Flag } from './flag';
import './panels.css';

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Panel de Almacén (H5 §10): todos los materiales y cuántos hay, para cuando haya muchos más.
 * Se abre con el botón Almacén de arriba.
 */
export function mountStoragePanel(
  root: HTMLElement,
  opts: { world: World; open: Flag },
): { update(): void } {
  const panel = document.createElement('aside');
  panel.className = 'storage-panel';
  panel.dataset.testid = 'storage-panel';
  panel.hidden = true;
  const head = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = es.storage.title;
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'close';
  x.textContent = '✕';
  x.dataset.testid = 'storage-close';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', () => opts.open.set(false));
  head.append(title, x);
  const materials = document.createElement('h3');
  materials.textContent = es.clothesUi.materials;
  const list = document.createElement('ul');
  const counts = ITEM_KINDS.map((k) => {
    const li = document.createElement('li');
    li.dataset.testid = `storage-${k}`;
    const name = document.createElement('span');
    name.textContent = capital(es.items[k][1]);
    const n = document.createElement('span');
    n.className = 'count';
    li.append(name, n);
    list.append(li);
    return { k, n };
  });
  // La ropa (H5b §8): cada prenda con su estado.
  const clothesTitle = document.createElement('h3');
  clothesTitle.textContent = es.clothesUi.clothes;
  const clothes = document.createElement('ul');
  clothes.className = 'clothes';
  clothes.dataset.testid = 'storage-clothes';
  let clothesShown = '';
  // Las bolsas guardadas (H5b2 §7): lo de dentro y su lista, que se edita aquí.
  const bagsTitle = document.createElement('h3');
  bagsTitle.textContent = es.storageBags.title;
  const bags = document.createElement('div');
  bags.className = 'bags';
  bags.dataset.testid = 'storage-bags';
  attachListHandlers(bags, opts.world, () => undefined);
  let bagsShown = '';
  panel.append(head, materials, list, clothesTitle, clothes, bagsTitle, bags);
  root.append(panel);

  return {
    update() {
      panel.hidden = !opts.open.value;
      if (panel.hidden) return;
      for (const { k, n } of counts) {
        const text = String(opts.world.storage.items[k]);
        if (n.textContent !== text) n.textContent = text;
      }
      const stored = bagsIn(opts.world.storage.items.pieces).map((b) => ({
        id: b.id,
        name: bagName(b.kind),
        inside: formatItems(b.items),
        list: effectiveList(opts.world, b),
      }));
      const bagsKey = JSON.stringify(stored);
      if (bagsKey !== bagsShown) {
        bagsShown = bagsKey;
        bags.replaceChildren(
          ...(stored.length > 0 ? stored : [null]).map((b) => {
            const box = document.createElement('div');
            box.className = 'bag-slot';
            if (!b) {
              box.textContent = es.clothesUi.nothing;
              box.classList.add('muted');
              return box;
            }
            const title = document.createElement('strong');
            title.textContent = `${b.name}: `;
            const inside = document.createElement('span');
            inside.textContent = b.inside;
            box.append(title, inside, listEditor(listRows(b.list), String(b.id), `bag-${b.id}`));
            return box;
          }),
        );
      }
      const texts = garments(opts.world.storage.items.pieces).map(garmentText);
      const key = JSON.stringify(texts);
      if (key === clothesShown) return;
      clothesShown = key;
      clothes.replaceChildren(
        ...(texts.length > 0 ? texts : [es.clothesUi.nothing]).map((t) => {
          const li = document.createElement('li');
          li.textContent = t;
          if (texts.length === 0) li.className = 'muted';
          return li;
        }),
      );
    },
  };
}
