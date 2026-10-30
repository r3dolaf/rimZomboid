import { es } from '../i18n/es';
import { BUILD } from '../sim/balance';
import type { BuildKind, World } from '../sim/types';
import type { Tool } from './tool';
import './panels.css';

/** Por grupos (H5c1 §8): lo que se pone, y Reparar para muchas cosas seguidas. */
const GROUPS: readonly { title: keyof typeof es.buildGroups; kinds: readonly BuildKind[] }[] = [
  { title: 'furniture', kinds: ['bed', 'table', 'campfire', 'tub'] },
  { title: 'walls', kinds: ['woodWall', 'woodDoor'] },
  // Reparar elige el plano según la casilla (spec H4b §4.2). Lo de las ventanas, con el clic
  // derecho (H5c1 §8).
  { title: 'fix', kinds: ['repair'] },
];

/**
 * Menú de la herramienta Construir (spec H4a §5): qué se coloca al hacer clic en el mapa, por
 * grupos, cada cosa con lo que gasta y lo que hay en el almacén (del mapa que se ve), y abajo qué
 * hace lo elegido (H5c1 §8).
 */
export function mountBuildMenu(
  root: HTMLElement,
  opts: { tool: Tool; world: World },
): { update(): void } {
  const menu = document.createElement('div');
  menu.className = 'build-menu';
  menu.dataset.testid = 'build-menu';
  menu.title = es.buildMenuHint;
  menu.hidden = true;
  const buttons: { kind: BuildKind; b: HTMLButtonElement }[] = [];
  for (const g of GROUPS) {
    const group = document.createElement('div');
    group.className = 'build-group';
    const title = document.createElement('h3');
    title.textContent = es.buildGroups[g.title];
    group.append(title);
    for (const kind of g.kinds) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.testid = `build-${kind}`;
      b.title = es.buildDesc[kind];
      b.addEventListener('click', () => {
        opts.tool.setBuildKind(kind);
        b.blur();
      });
      group.append(b);
      buttons.push({ kind, b });
    }
    menu.append(group);
  }
  const desc = document.createElement('p');
  desc.className = 'build-desc';
  desc.dataset.testid = 'build-desc';
  menu.append(desc);
  root.append(menu);
  return {
    update() {
      const show = opts.tool.mode === 'build';
      if (menu.hidden === show) menu.hidden = !show;
      if (!show) return;
      const have = opts.world.storage.items.wood;
      for (const { kind, b } of buttons) {
        b.classList.toggle('selected', opts.tool.buildKind === kind);
        const wood = kind === 'repair' ? es.repairWood : BUILD[kind].wood;
        const text = es.buildOption(es.buildMenu[kind], wood, have);
        if (b.textContent !== text) b.textContent = text;
      }
      const text = es.buildDesc[opts.tool.buildKind];
      if (desc.textContent !== text) desc.textContent = text;
    },
  };
}
