import type { TimeController } from '../game/timeController';
import { es } from '../i18n/es';
import { gameTime } from '../sim/clock';
import { emptyInventory, ITEM_KINDS } from '../sim/items';
import type { World } from '../sim/types';
import { formatItems, setupLine } from './describe';
import { setupOf } from '../sim/setup';
import './start.css';

/** Lo más saqueado: las 3 cosas de las que más se ha traído. */
function topLooted(w: World): string {
  const top = ITEM_KINDS.filter((k) => w.common.stats.looted[k] > 0)
    .sort((a, b) => w.common.stats.looted[b] - w.common.stats.looted[a])
    .slice(0, 3);
  if (top.length === 0) return es.end.nothing;
  const inv = emptyInventory();
  for (const k of top) inv[k] = w.common.stats.looted[k];
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
      if (shown || w.common.over === null) return;
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
      // C1: con victoria, el rescate; si cayó después de un helicóptero, también quién se salvó.
      const won = w.common.over.won === true;
      const day = gameTime(w.common.over.tick).day;
      const rescued = w.common.rescued ?? [];
      if (won) screen.classList.add('won');
      panel.append(
        line('h1', won ? t.won : t.fell),
        line('p', won ? t.wonDays(day) : t.survived(day)),
        line('p', setupLine(setupOf(w))), // C2: el comienzo y los ajustes cambiados
        ...(rescued.length > 0
          ? [line('h2', t.rescued), list(rescued.map((r) => t.rescuedLine(r.name, r.day)))]
          : []),
        line('h2', t.dead),
        list(w.common.dead.map((d) => t.deadLine(d.name, d.day, es.deathCauses[d.cause]))),
        line('h2', t.joined),
        list(w.common.stats.joined),
        line('p', t.kills(w.common.stats.kills)),
        line('p', t.sieges(w.common.stats.siegesRepelled)),
        line('p', t.looted(topLooted(w))),
        ...(w.common.stats.harvested > 0 ? [line('p', t.harvested(w.common.stats.harvested))] : []),
        row,
      );
      screen.append(panel);
      root.append(screen);
    },
  };
}
