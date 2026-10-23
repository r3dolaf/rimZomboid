import type { TimeController } from '../game/timeController';
import { es } from '../i18n/es';
import { gameTime } from '../sim/clock';
import { emptyInventory, ITEM_KINDS } from '../sim/items';
import type { World } from '../sim/types';
import { formatItems } from './describe';
import './start.css';

/** Lo más saqueado: las 3 cosas de las que más se ha traído. */
function topLooted(w: World): string {
  const top = ITEM_KINDS.filter((k) => w.stats.looted[k] > 0)
    .sort((a, b) => w.stats.looted[b] - w.stats.looted[a])
    .slice(0, 3);
  if (top.length === 0) return es.end.nothing;
  const inv = emptyInventory();
  for (const k of top) inv[k] = w.stats.looted[k];
  // formatItems va en el orden de siempre; aquí, de más a menos.
  return formatItems(inv, top);
}

/**
 * Pantalla final (spec H5 §9): al caer la colonia, el resumen de la partida, con Otra partida y
 * Volver a la portada. Pausa al salir; el juego queda detrás.
 */
export function mountEndScreen(
  root: HTMLElement,
  opts: { world: World; time: TimeController; onRestart(): void; onTitle(): void },
): { update(): void } {
  let shown = false;
  const t = es.end;
  return {
    update() {
      const w = opts.world;
      if (shown || w.over === null) return;
      shown = true;
      opts.time.setSpeed(0);
      const screen = document.createElement('div');
      screen.className = 'start end';
      screen.dataset.testid = 'end-screen';
      const panel = document.createElement('div');
      panel.className = 'start-panel';
      const line = (tag: string, text: string) => {
        const el = document.createElement(tag);
        el.textContent = text;
        return el;
      };
      const list = (items: string[]) => {
        if (items.length === 0) return line('p', t.nobody);
        const ul = document.createElement('ul');
        for (const i of items) ul.append(line('li', i));
        return ul;
      };
      const row = document.createElement('div');
      row.className = 'end-buttons';
      const button = (id: string, text: string, onClick: () => void) => {
        const b = line('button', text) as HTMLButtonElement;
        b.type = 'button';
        b.dataset.testid = id;
        b.addEventListener('click', onClick);
        return b;
      };
      row.append(
        button('end-restart', t.restart, opts.onRestart),
        button('end-title', t.title, opts.onTitle),
      );
      panel.append(
        line('h1', t.fell),
        line('p', t.survived(gameTime(w.over.tick).day)),
        line('h2', t.dead),
        list(w.dead.map((d) => t.deadLine(d.name, d.day, es.deathCauses[d.cause]))),
        line('h2', t.joined),
        list(w.stats.joined),
        line('p', t.kills(w.stats.kills)),
        line('p', t.sieges(w.stats.siegesRepelled)),
        line('p', t.looted(topLooted(w))),
        row,
      );
      screen.append(panel);
      root.append(screen);
    },
  };
}
