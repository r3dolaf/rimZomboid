// U1 §8: la Ayuda: cómo se juega, los controles (primero los del aparato), qué es cada cosa de la
// pantalla y consejos; abajo, volver a ver los primeros pasos y si salen los consejos. En la partida
// la pausa mientras está abierta; también se abre desde la portada.
import type { TimeController } from '../game/timeController';
import { es } from '../i18n/es';
import type { Flag } from './flag';
import { screenIs } from './screen';
import { TOUCH_SCREEN } from './toolHint';
import './panels.css';

const TABS = ['basics', 'controls', 'screen', 'tips'] as const;
type HelpTab = (typeof TABS)[number];

/** Las barras de la tarjeta, en su orden (con su color, el de la tarjeta). */
const BARS = ['health', 'blood', 'hunger', 'sleep', 'social', 'mood'] as const;

export function mountHelp(
  root: HTMLElement,
  opts: {
    open: Flag;
    /** En la partida: la Ayuda la pausa y, al cerrarla, sigue (si la pausó ella). */
    time?: TimeController;
    /** Con el dedo, los controles del dedo primero; sin decirlo, lo mira la pantalla. */
    touch?: () => boolean;
    /** «Ver otra vez los primeros pasos» (en la partida). */
    onGuide?: () => void;
    /** «Mostrar consejos» (en la partida). */
    tips?: { get(): boolean; set(on: boolean): void };
  },
): { remove(): void } {
  const touch = opts.touch ?? (() => screenIs(TOUCH_SCREEN));
  const t = es.help;
  const panel = document.createElement('aside');
  panel.className = 'help-panel';
  panel.dataset.testid = 'help-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', t.title);
  panel.hidden = true;

  const head = document.createElement('header');
  const h2 = document.createElement('h2');
  h2.textContent = `${es.helpButton.icon} ${t.title}`;
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'close';
  x.textContent = '✕';
  x.dataset.testid = 'help-close';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', () => opts.open.set(false));
  head.append(h2, x);

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  /** Una lista de «qué — cómo». */
  const pairs = (rows: readonly [string, string][]) => {
    const dl = el('dl', undefined, 'pairs');
    for (const [k, v] of rows) dl.append(el('dt', k), el('dd', v));
    return dl;
  };

  const panes: Record<HelpTab, HTMLElement> = {
    basics: el('div'),
    controls: el('div'),
    screen: el('div'),
    tips: el('div'),
  };
  panes.basics.append(el('p', t.intro, 'intro'), pairs(t.basics));

  const fillControls = () => {
    const mouse = [el('h3', t.controlsMouse), pairs(t.mouse)];
    const fingers = [el('h3', t.controlsTouch), pairs(t.touch)];
    panes.controls.replaceChildren(...(touch() ? [...fingers, ...mouse] : [...mouse, ...fingers]));
  };

  // Las barras, dibujadas como en la tarjeta (mismo estilo), con su nombre.
  const bars = el('div', undefined, 'help-bars');
  for (const k of BARS) {
    const row = el('div', undefined, 'help-bar');
    const bar = el('span', undefined, 'bar');
    bar.dataset.need = k;
    const fill = el('span', undefined, 'fill');
    bar.append(fill);
    row.append(bar, el('span', `${es.meters[k].icon} ${es.meters[k].name}`));
    bars.append(row);
  }
  panes.screen.append(pairs(t.screen), el('p', t.barsTitle, 'bars-title'), bars);

  const tipsList = el('ul', undefined, 'help-tips');
  for (const tip of t.tips) tipsList.append(el('li', tip));
  panes.tips.append(tipsList);

  const nav = el('nav', undefined, 'panel-tabs');
  nav.setAttribute('role', 'tablist');
  let tab: HelpTab = 'basics';
  const tabButtons = TABS.map((k) => {
    const b = el('button', t.tabs[k]);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.testid = `help-tab-${k}`;
    b.addEventListener('click', () => {
      tab = k;
      show();
      b.blur();
    });
    nav.append(b);
    return { k, b };
  });
  const show = () => {
    for (const { k, b } of tabButtons) {
      b.classList.toggle('selected', k === tab);
      b.setAttribute('aria-selected', String(k === tab));
    }
    for (const k of TABS) panes[k].hidden = k !== tab;
  };

  // Abajo: los primeros pasos otra vez y los consejos (solo en la partida).
  const foot = el('footer');
  if (opts.onGuide) {
    const again = el('button', t.guideAgain);
    again.type = 'button';
    again.dataset.testid = 'help-guide-again';
    again.addEventListener('click', () => {
      opts.onGuide?.();
      opts.open.set(false);
    });
    foot.append(again);
  }
  const tipsBox = opts.tips;
  if (tipsBox) {
    const label = el('label');
    const check = el('input');
    check.type = 'checkbox';
    check.dataset.testid = 'help-show-tips';
    check.checked = tipsBox.get();
    check.addEventListener('change', () => tipsBox.set(check.checked));
    label.append(check, document.createTextNode(` ${t.showTips}`));
    foot.append(label);
    opts.open.onChange((on) => {
      if (on) check.checked = tipsBox.get();
    });
  }

  panel.append(head, nav, ...TABS.map((k) => panes[k]), foot);
  root.append(panel);
  show();

  // Pausa al abrirla (si iba el tiempo) y sigue al cerrarla, si nadie lo ha tocado entretanto.
  let pausedByHelp = false;
  opts.open.onChange((on) => {
    panel.hidden = !on;
    if (on) {
      fillControls();
      const time = opts.time;
      pausedByHelp = !!time && time.speed !== 0;
      if (pausedByHelp) time!.togglePause();
    } else {
      if (pausedByHelp && opts.time?.speed === 0) opts.time.togglePause();
      pausedByHelp = false;
    }
  });
  return { remove: () => panel.remove() };
}
