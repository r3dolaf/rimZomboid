// El menú del clic derecho (spec H5c1 §8): en una ventana, una puerta, un muro dañado o un plano,
// lo que se puede hacer allí, con lo que gasta y lo que tienes. U1 §7: además, saquear un mueble,
// un cuerpo o una casa, ver la casa, talar un árbol y fabricar en la mesa (así casi no hace falta
// cambiar de herramienta). Solo cuando el clic derecho no es una orden de modo combate.
import { t as es } from '../i18n';
import { toggleContainer, toggleHouse } from '../game/designate';
import { containerAt, houseAt, tableAt } from '../game/pick';
import { liveBlueprints, pendingPlacements, toggleTree } from '../game/tools';
import { BUILD, CURTAINS_COST } from '../sim/balance';
import { canPlace, treeMarked } from '../sim/build';
import { getTile } from '../sim/map/grid';
import { effectiveDesignated, houseMarked, issue, markable } from '../sim/orders';
import { radioOf, radioOn } from '../sim/radio';
import { generatorOf, generatorOn } from '../sim/power';
import { Tile, type BuildKind, type Point, type World } from '../sim/types';
import { buildingThe } from './describe';
import './panels.css';

/** Lo que no es un plano (U1 §7). */
type OtherKind =
  'cancel' | 'loot' | 'lootHouse' | 'viewHouse' | 'chop' | 'craft' | 'radio' | 'generatorSwitch';

export interface ContextOption {
  /** El plano que pone, o lo demás (`cancel`, `loot`…): para su `data-testid`, `ctx-<kind>`. */
  kind: BuildKind | OtherKind;
  label: string;
  /** Da la orden. */
  choose(): void;
}

/** Lo que el menú abre fuera del mapa (U1 §7): Fabricar y la ficha de una casa. */
export interface ContextActions {
  onCraft?: () => void;
  onHouse?: (houseId: number) => void;
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

/**
 * Lo que se puede hacer en esa casilla (con lo pedido en pausa ya aplicado); vacío si nada. Lo de
 * una casa vale aunque no se haya visto por dentro (como con la herramienta Saquear).
 */
export function contextOptions(w: World, p: Point, acts: ContextActions = {}): ContextOption[] {
  const seen = w.seen[p.y * w.grid.width + p.x] === 1;
  if (!seen) return houseOptions(w, p, false, acts);
  const at = (q: Point) => q.x === p.x && q.y === p.y;
  if (w.blueprints.some((b) => at(b.pos))) {
    const b = liveBlueprints(w).find((x) => at(x.pos));
    if (!b) return []; // ya se ha pedido cancelarlo
    const choose = () => issue(w, { type: 'cancelBlueprint', id: b.id });
    return [{ kind: 'cancel', label: es.contextMenu.cancel, choose }];
  }
  if (pendingPlacements(w).some((x) => at(x.pos))) return [];
  const have = w.storage.items;
  const out: ContextOption[] = KINDS.filter((k) => canPlace(w, k, p)).map((kind) => ({
    kind,
    label: label(w, kind, p, have.wood, have.curtains),
    choose: () => issue(w, { type: 'placeBlueprint', kind, x: p.x, y: p.y }),
  }));
  const t = es.contextMenu;
  // U1 §7: un mueble o un cuerpo con algo dentro (o sin registrar).
  const c = containerAt(w, p.x, p.y);
  if (c && markable(c)) {
    const on = effectiveDesignated(w, c);
    const what = es.containersThe[c.kind]; // I1: con su artículo, en cada idioma
    const text =
      c.kind === 'corpse' ? (on ? t.unsearch : t.search) : on ? t.unloot(what) : t.loot(what);
    out.push({ kind: 'loot', label: text, choose: () => toggleContainer(w, c.id) });
  }
  // C1: la radio, encenderla o apagarla (con lo pedido en pausa).
  const radio = radioOf(w);
  if (radio && radio.pos.x === p.x && radio.pos.y === p.y) {
    const on = radioOn(w);
    out.push({
      kind: 'radio',
      label: on ? t.radioOff : t.radioOn,
      choose: () => issue(w, { type: 'setRadio', on: !on }),
    });
  }
  // E1: el generador, encenderlo o apagarlo (con lo pedido en pausa).
  const gen = generatorOf(w);
  if (gen && gen.pos.x === p.x && gen.pos.y === p.y) {
    const on = generatorOn(w);
    out.push({
      kind: 'generatorSwitch',
      label: on ? t.generatorOff : t.generatorOn,
      choose: () => issue(w, { type: 'setGenerator', on: !on }),
    });
  }
  // La mesa: Fabricar.
  if (acts.onCraft && tableAt(w, p.x, p.y))
    out.push({ kind: 'craft', label: t.craft, choose: acts.onCraft });
  // Un árbol: talar o no.
  if (getTile(w.grid, p.x, p.y) === Tile.Tree) {
    const on = treeMarked(w, p.x, p.y);
    out.push({
      kind: 'chop',
      label: on ? t.unchop : t.chop,
      choose: () => toggleTree(w, p.x, p.y),
    });
  }
  return [...out, ...houseOptions(w, p, true, acts)];
}

/** U1 §7: en una casa (no la base), saquearla o dejarlo y, si se ha visto, ver su ficha. */
function houseOptions(w: World, p: Point, seen: boolean, acts: ContextActions): ContextOption[] {
  const h = houseAt(w, p.x, p.y);
  if (!h) return [];
  const t = es.contextMenu;
  const the = buildingThe(w, h.id);
  const out: ContextOption[] = [];
  const marked = houseMarked(w, h.id);
  const left = w.containers.some((c) => c.houseId === h.id && markable(c));
  if (marked || left)
    out.push({
      kind: 'lootHouse',
      label: marked ? t.unlootHouse(the) : t.lootHouse(the),
      choose: () => toggleHouse(w, h.id),
    });
  if (seen && acts.onHouse) {
    const open = acts.onHouse;
    out.push({ kind: 'viewHouse', label: t.viewHouse(the), choose: () => open(h.id) });
  }
  return out;
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
  opts: { world: World } & ContextActions,
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
  // Con `pointerdown`, también al tocar fuera con el dedo (M1).
  document.addEventListener('pointerdown', (ev) => {
    if (!menu.hidden && !menu.contains(ev.target as Node)) close();
  });
  return {
    open(tile, screen) {
      const options = contextOptions(opts.world, tile, opts);
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
