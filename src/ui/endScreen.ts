import type { TimeController } from '../game/timeController';
import { t as es } from '../i18n';
import { gameTime } from '../sim/clock';
import { emptyInventory, ITEM_KINDS } from '../sim/items';
import type { World } from '../sim/types';
import { formatItems, setupLine } from './describe';
import { setupOf } from '../sim/setup';
import { achieved, type AchievementStore } from './achievements';
import { chronicleImage, chronicleLines, shareText } from './chronicle';
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
  opts: {
    world: World;
    time: TimeController;
    onRestart(): void;
    onTitle(): void;
    /** C3: el enlace para jugar la misma partida (en lo que se comparte). */
    shareUrl?: string;
    /** C3: lo conseguido (lo de esta vez, «¡nuevo!»). */
    achievements?: AchievementStore;
    now?: () => Date;
  },
): { update(): void } {
  let shown = false;
  const t = es.end;
  // C3: lo conseguido desde que se abrió la partida (o aún sin guardar) es nuevo.
  const since = (opts.now?.() ?? new Date()).toISOString();
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
      const chronicle = () => {
        const lines = chronicleLines(w);
        if (lines.length === 0) return line('p', t.nothing);
        const ul = document.createElement('ul');
        ul.className = 'chronicle';
        ul.dataset.testid = 'end-chronicle';
        for (const l of lines) ul.append(line('li', t.chronicleLine(l.day, l.text)));
        return ul;
      };
      const url = opts.shareUrl ?? location.href;
      const shareRow = () => {
        const box = document.createElement('div');
        box.className = 'end-buttons end-share';
        const status = line('p', '');
        status.className = 'muted';
        status.dataset.testid = 'end-share-status';
        box.append(
          button('end-copy', t.copy, () => {
            copyText(shareText(w, url)).then(
              (ok) => (status.textContent = ok ? t.copied : t.copyFailed),
              () => (status.textContent = t.copyFailed),
            );
          }),
          button('end-image', t.image, () => {
            const canvas = chronicleImage(w, url);
            if (!canvas) return;
            canvas.toBlob((blob) => {
              if (!blob) return;
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `villamuerta-${gameTime(w.common.over?.tick ?? w.tick).day}.png`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }, 'image/png');
          }),
        );
        const wrap = document.createElement('div');
        wrap.append(box, status);
        return wrap;
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
        // C3: los logros de esta partida, la crónica y compartirla.
        line('h2', t.achievements),
        w.common.cheated
          ? line('p', t.cheated)
          : list(
              achieved(w).map((id) => {
                const name = `🏆 ${es.achievements.items[id].name}`;
                const at = opts.achievements?.get()[id];
                const fresh = opts.achievements && (at === undefined || at >= since);
                return fresh ? `${name} · ${es.achievements.fresh}` : name;
              }),
            ),
        line('h2', t.chronicle),
        chronicle(),
        shareRow(),
        row,
      );
      screen.append(panel);
      root.append(screen);
    },
  };
}

/** Copia un texto (con el portapapeles del navegador o, si no hay, a la antigua). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // sin permiso: a la antigua
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}
