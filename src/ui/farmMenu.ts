import { t as es } from '../i18n';
import { CROP_KINDS, CROPS } from '../sim/balance';
import type { World } from '../sim/types';
import { itemIcon } from './icons';
import type { Tool } from './tool';
import './panels.css';

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * V4 §2.2: el selector de la herramienta Huerto (donde el de Construir): qué cultivo se marca al tocar
 * o arrastrar, cada uno con su dibujo, su nombre y las semillas que hay en el almacén (sin ninguna, más
 * apagado); abajo, la pista de lo elegido.
 */
export function mountFarmMenu(
  root: HTMLElement,
  opts: { tool: Tool; world: World },
): { update(): void } {
  const menu = document.createElement('div');
  menu.className = 'build-menu farm-menu';
  menu.dataset.testid = 'farm-menu';
  menu.hidden = true;
  const buttons = CROP_KINDS.map((kind) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.testid = `farm-${kind}`;
    b.title = es.seedHints[kind];
    const icon = itemIcon(kind);
    const label = document.createElement('span');
    if (icon) b.append(icon);
    b.append(label);
    b.addEventListener('click', () => {
      opts.tool.setCropKind(kind);
      b.blur();
    });
    menu.append(b);
    return { kind, b, label };
  });
  const desc = document.createElement('p');
  desc.className = 'build-desc';
  desc.dataset.testid = 'farm-desc';
  menu.append(desc);
  root.append(menu);
  return {
    update() {
      const show = opts.tool.mode === 'farm';
      if (menu.hidden === show) menu.hidden = !show;
      if (!show) return;
      for (const { kind, b, label } of buttons) {
        b.classList.toggle('selected', opts.tool.cropKind === kind);
        const n = opts.world.storage.items[CROPS[kind].seeds];
        const text = es.farmChoice(capital(es.items[kind][0]), n);
        if (label.textContent !== text) label.textContent = text;
        b.classList.toggle('short', n === 0);
      }
      const text = es.seedHints[opts.tool.cropKind];
      if (desc.textContent !== text) desc.textContent = text;
    },
  };
}
