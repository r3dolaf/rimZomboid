// El panel «Partida» (spec H6b §2): guardar ahora, cargar la guardada (confirmando), exportar a un
// archivo e importar uno.
import { es } from '../i18n/es';
import type { NarratorStyle } from '../sim/types';
import type { Flag } from './flag';
import { importInput } from './saveStore';
import './panels.css';

export function mountGamePanel(
  root: HTMLElement,
  opts: {
    open: Flag;
    /** H6c: la semilla y el narrador de la partida (antes, en la barra de arriba). */
    seed: number;
    narrator?: NarratorStyle;
    hasSave: () => boolean;
    /** Guarda; `false` si no se ha podido. */
    onSave: () => boolean;
    onLoad: () => void;
    onExport: () => void;
    onImport: (text: string) => void;
  },
): { update(): void; say(text: string): void } {
  const t = es.game;
  const panel = document.createElement('aside');
  panel.className = 'game-panel';
  panel.dataset.testid = 'game-panel';
  panel.hidden = true;
  const head = document.createElement('header');
  const h2 = document.createElement('h2');
  h2.textContent = t.title;
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'close';
  x.textContent = '✕';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', () => opts.open.set(false));
  head.append(h2, x);
  const status = document.createElement('p');
  status.className = 'muted';
  status.dataset.testid = 'game-status';
  const button = (text: string, testid: string, act: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.dataset.testid = testid;
    b.addEventListener('click', () => {
      act();
      b.blur();
    });
    return b;
  };
  const say = (text: string) => (status.textContent = text);
  const save = button(t.save, 'game-save', () => say(opts.onSave() ? t.saved : t.saveFailed));
  const confirm = button(t.loadConfirm, 'game-load-confirm', () => {
    confirm.hidden = true;
    opts.onLoad();
  });
  confirm.hidden = true;
  const load = button(t.load, 'game-load', () => {
    confirm.hidden = false;
    say(t.loadWarning);
  });
  const exp = button(t.export, 'game-export', () => opts.onExport());
  const label = document.createElement('label');
  label.className = 'import';
  label.append(document.createTextNode(`${t.import} `), importInput('game-import', opts.onImport));
  const row = document.createElement('div');
  row.className = 'buttons';
  row.append(save, load, confirm, exp, label);
  const seed = document.createElement('p');
  seed.className = 'muted';
  seed.dataset.testid = 'game-seed';
  seed.textContent = es.seed(opts.seed);
  const narrator = document.createElement('p');
  narrator.className = 'muted';
  narrator.dataset.testid = 'game-narrator';
  narrator.textContent = es.narratorLabel(es.narrators[opts.narrator ?? 'balanced'].name);
  panel.append(head, seed, narrator, row, status);
  root.append(panel);
  return {
    update() {
      panel.hidden = !opts.open.value;
      if (panel.hidden) {
        confirm.hidden = true;
        return;
      }
      load.disabled = !opts.hasSave();
    },
    say,
  };
}
