import { es } from '../i18n/es';
import { BUILD } from '../sim/balance';
import type { BuildKind } from '../sim/types';
import type { Tool } from './tool';
import './panels.css';

const KINDS: readonly BuildKind[] = [
  'bed',
  'table',
  'campfire',
  'woodWall',
  'woodDoor',
  'board',
  'unboard',
  'repair', // elige el plano según la casilla (spec H4b §4.2)
  // H4d: "Cortinas" también elige: correrlas o abrirlas, o colgar unas si no hay.
  'curtains',
  'takeDownCurtains',
  'smashWindow',
];

const NAME_ONLY: ReadonlySet<BuildKind> = new Set(['curtains', 'takeDownCurtains', 'smashWindow']);

/** Menú de la herramienta Construir (spec H4a §5): qué se coloca al hacer clic en el mapa. */
export function mountBuildMenu(root: HTMLElement, opts: { tool: Tool }): { update(): void } {
  const menu = document.createElement('div');
  menu.className = 'build-menu';
  menu.dataset.testid = 'build-menu';
  menu.title = es.buildMenuHint;
  menu.hidden = true;
  const buttons = KINDS.map((kind) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.testid = `build-${kind}`;
    const wood = kind === 'repair' ? es.repairWood : BUILD[kind].wood;
    // Las cortinas y romper ventana no gastan madera (H4d): solo el nombre.
    b.textContent = NAME_ONLY.has(kind)
      ? es.buildMenu[kind]
      : es.buildOption(es.buildMenu[kind], wood);
    b.addEventListener('click', () => {
      opts.tool.setBuildKind(kind);
      b.blur();
    });
    menu.append(b);
    return { kind, b };
  });
  root.append(menu);
  return {
    update() {
      const show = opts.tool.mode === 'build';
      if (menu.hidden === show) menu.hidden = !show;
      if (!show) return;
      for (const x of buttons) x.b.classList.toggle('selected', opts.tool.buildKind === x.kind);
    },
  };
}
