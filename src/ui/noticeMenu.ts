import { es } from '../i18n/es';
import type { Decision } from '../sim/types';
import type { Flag } from './flag';
import { CAN_BE_RED, NOTICE_GROUPS, pauses, shows, type PrefsStore } from './noticePrefs';
import './panels.css';

/**
 * El menú de Avisos (spec H4e §6): por grupos, cada tipo con Aparece y Pausa, y Como al principio.
 * Lo que se marca se guarda al momento (en el navegador).
 */
export function mountNoticeMenu(
  root: HTMLElement,
  opts: { prefs: PrefsStore; open: Flag },
): { update(): void } {
  const panel = document.createElement('aside');
  panel.className = 'work-panel notice-menu';
  panel.dataset.testid = 'notice-menu';
  panel.hidden = true;
  const head = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = es.noticeMenu.title;
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'close';
  x.textContent = '✕';
  x.dataset.testid = 'notice-menu-close';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', () => opts.open.set(false));
  head.append(title, x);
  panel.append(head);

  const label = (kind: string) => {
    if (!kind.startsWith('decision:')) return es.notices[kind as keyof typeof es.notices];
    const d = kind.slice('decision:'.length) as Decision['kind'];
    return es.noticeMenu.decision(es.decisions[d].title);
  };
  const rows: { kind: string; show: HTMLInputElement | null; pause: HTMLInputElement }[] = [];
  const change = (kind: string, field: 'show' | 'pause', on: boolean) => {
    const p = { ...opts.prefs.get() };
    p[kind] = { ...p[kind], [field]: on };
    opts.prefs.set(p);
  };
  const check = (testid: string, onClick: (on: boolean) => void) => {
    const c = document.createElement('input');
    c.type = 'checkbox';
    c.dataset.testid = testid;
    c.addEventListener('change', () => onClick(c.checked));
    return c;
  };
  for (const g of NOTICE_GROUPS) {
    const h = document.createElement('h3');
    h.textContent = es.noticeMenu.groups[g.id];
    const table = document.createElement('table');
    const headRow = document.createElement('tr');
    for (const t of ['', es.noticeMenu.show, es.noticeMenu.pause]) {
      const th = document.createElement('th');
      th.textContent = t;
      headRow.append(th);
    }
    table.append(headRow);
    for (const kind of g.kinds) {
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      name.textContent = label(kind);
      const showCell = document.createElement('td');
      const show = kind.startsWith('decision:')
        ? null
        : check(`notice-show-${kind}`, (on) => change(kind, 'show', on));
      if (show) showCell.append(show);
      const pauseCell = document.createElement('td');
      const pause = check(`notice-pause-${kind}`, (on) => change(kind, 'pause', on));
      pauseCell.append(pause);
      tr.append(name, showCell, pauseCell);
      table.append(tr);
      rows.push({ kind, show, pause });
    }
    panel.append(h, table);
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'reset';
  reset.dataset.testid = 'notice-reset';
  reset.textContent = es.noticeMenu.reset;
  reset.addEventListener('click', () => {
    opts.prefs.set({});
    reset.blur();
  });
  panel.append(reset);
  root.append(panel);

  return {
    update() {
      if (panel.hidden === opts.open.value) panel.hidden = !opts.open.value;
      if (!opts.open.value) return;
      const p = opts.prefs.get();
      for (const r of rows) {
        const on = shows(p, r.kind);
        if (r.show && r.show.checked !== on) r.show.checked = on;
        // Los de tono variable, según si pueden salir rojos.
        const pausing = pauses(p, r.kind, CAN_BE_RED.has(r.kind) ? 'bad' : 'mixed');
        if (r.pause.checked !== pausing) r.pause.checked = pausing;
        if (r.pause.disabled === on) r.pause.disabled = !on;
      }
    },
  };
}
