// El menú del clic derecho (spec H5c1 §8): en una ventana, una puerta, un muro dañado o un plano,
// lo que se puede hacer allí, con lo que gasta y lo que tienes. Solo cuando el clic derecho no es
// una orden de modo combate.
import { es } from '../i18n/es';
import { liveBlueprints, pendingPlacements } from '../game/tools';
import { BUILD, CURTAINS_COST } from '../sim/balance';
import { canPlace } from '../sim/build';
import { getTile } from '../sim/map/grid';
import { issue } from '../sim/orders';
import { Tile, type BuildKind, type Point, type World } from '../sim/types';
import './panels.css';

export interface ContextOption {
  /** El plano que pone, o `cancel`. */
  kind: BuildKind | 'cancel';
  label: string;
  /** Da la orden. */
  choose(): void;
}

/** Lo que se puede poner con el clic derecho, en este orden; cada uno, solo donde encaja. */
const KINDS: readonly BuildKind[] = [
  'board',
  'unboard',
  'hangCurtains',
  'curtains',
  'takeDownCurtains',
  'smashWindow',
  'repair',
  'fixDoor',
];

/** Lo que se puede hacer en esa casilla (con lo pedido en pausa ya aplicado); vacío si nada. */
export function contextOptions(w: World, p: Point): ContextOption[] {
  if (w.seen[p.y * w.grid.width + p.x] !== 1) return [];
  const at = (q: Point) => q.x === p.x && q.y === p.y;
  if (w.blueprints.some((b) => at(b.pos))) {
    const b = liveBlueprints(w).find((x) => at(x.pos));
    if (!b) return []; // ya se ha pedido cancelarlo
    const choose = () => issue(w, { type: 'cancelBlueprint', id: b.id });
    return [{ kind: 'cancel', label: es.contextMenu.cancel, choose }];
  }
  if (pendingPlacements(w).some((x) => at(x.pos))) return [];
  const have = w.storage.items;
  return KINDS.filter((k) => canPlace(w, k, p)).map((kind) => ({
    kind,
    label: label(w, kind, p, have.wood, have.curtains),
    choose: () => issue(w, { type: 'placeBlueprint', kind, x: p.x, y: p.y }),
  }));
}

function label(w: World, kind: BuildKind, p: Point, wood: number, curtains: number): string {
  if (kind === 'curtains')
    return getTile(w.grid, p.x, p.y) === Tile.CurtainedWindow
      ? es.contextMenu.openCurtains
      : es.contextMenu.drawCurtains;
  const name = es.buildMenu[kind];
  const need = CURTAINS_COST[kind];
  if (need) return es.contextMenu.withCurtains(name, need, curtains);
  return BUILD[kind].wood > 0 ? es.buildOption(name, BUILD[kind].wood, wood) : name;
}

/**
 * El menú en pantalla: `open` lo abre en `screen` con lo que hay en `tile` (y dice si había algo);
 * `close` lo cierra (y dice si estaba abierto, para Esc). Un clic fuera también lo cierra.
 */
export function mountContextMenu(
  root: HTMLElement,
  opts: { world: World },
): {
  open(tile: Point, screen: Point): boolean;
  close(): boolean;
} {
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.dataset.testid = 'context-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  root.append(menu);
  const close = () => {
    if (menu.hidden) return false;
    menu.hidden = true;
    menu.replaceChildren();
    return true;
  };
  document.addEventListener('mousedown', (ev) => {
    if (!menu.hidden && !menu.contains(ev.target as Node)) close();
  });
  return {
    open(tile, screen) {
      const options = contextOptions(opts.world, tile);
      close();
      if (options.length === 0) return false;
      menu.replaceChildren(
        ...options.map((o) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('role', 'menuitem');
          b.dataset.testid = `ctx-${o.kind}`;
          b.textContent = o.label;
          b.addEventListener('click', () => {
            o.choose();
            close();
          });
          return b;
        }),
      );
      menu.hidden = false;
      // Que no se salga de la pantalla cerca de los bordes.
      const r = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(0, Math.min(screen.x, window.innerWidth - r.width - 4))}px`;
      menu.style.top = `${Math.max(0, Math.min(screen.y, window.innerHeight - r.height - 4))}px`;
      return true;
    },
    close,
  };
}
