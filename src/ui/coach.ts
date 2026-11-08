// U1 §9: la tarjeta de los primeros pasos y los consejos, abajo a la derecha. Lo que decide qué
// toca está en guide.ts; aquí, lo que ha hecho el jugador en la interfaz, lo guardado en el
// navegador y la tarjeta.
import type { TimeController } from '../game/timeController';
import { es } from '../i18n/es';
import type { World } from '../sim/types';
import type { Flag } from './flag';
import {
  currentStep,
  dueTip,
  GUIDE_STEPS,
  NEW_GUIDE,
  stepDone,
  type DueTip,
  type GuideSeen,
  type GuideState,
} from './guide';
import type { Selection } from './selection';
import { screenIs } from './screen';
import type { Tool } from './tool';
import { TOUCH_SCREEN } from './toolHint';
import './panels.css';

const KEY = 'rimzomboid.guide';
/** Cada cuántos fotogramas se mira el mundo (no hace falta en todos). */
const CHECK_EVERY = 15;
/** «¡Ya sabes lo básico!» se va solo a los 20 s. */
const FINISHED_MS = 20_000;

export interface GuideStore {
  get(): GuideState;
  set(s: GuideState): void;
}

/** Lo guardado en el navegador; sin almacenamiento, solo dura esta partida. */
export function createGuideStore(): GuideStore {
  let mem: GuideState = load();
  return {
    get: () => mem,
    set(s) {
      mem = s;
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {
        // sin almacenamiento: solo esta partida
      }
    },
  };
}

function load(): GuideState {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') return { ...NEW_GUIDE, ...(raw as Partial<GuideState>) };
  } catch {
    // estropeado o sin almacenamiento: como nuevo
  }
  return { ...NEW_GUIDE };
}

export interface Coach {
  update(): void;
  /** Ha salido un aviso (puede que pause el juego: entonces, su consejo). */
  noticed(): void;
  /** Vuelve a empezar los primeros pasos (desde la Ayuda). */
  restart(): void;
  /** Si salen los consejos (la casilla de la Ayuda). */
  readonly tips: { get(): boolean; set(on: boolean): void };
}

export function mountCoach(
  root: HTMLElement,
  opts: {
    /** La base (con lo de todos los mapas). */
    world: World;
    time: TimeController;
    tool: Tool;
    selection: Selection;
    /** El panel Trabajos (abrirlo es un paso). */
    workOpen: Flag;
    store?: GuideStore;
    touch?: () => boolean;
    /** Zombis a la vista en el mapa que se ve. */
    zombiesSeen?: () => number;
    /** La hora, para quitar «¡Ya sabes lo básico!» (los tests la pasan). */
    now?: () => number;
  },
): Coach {
  const store = opts.store ?? createGuideStore();
  const touch = opts.touch ?? (() => screenIs(TOUCH_SCREEN));
  const now = opts.now ?? (() => performance.now());
  const seen: GuideSeen = { selected: false, fast: false, workOpened: false };
  opts.selection.onChange(() => {
    if (opts.selection.ids.length > 0) seen.selected = true;
  });
  opts.workOpen.onChange((on) => {
    if (on) seen.workOpened = true;
  });

  const card = document.createElement('section');
  card.className = 'coach';
  card.dataset.testid = 'coach';
  card.setAttribute('aria-live', 'polite');
  card.hidden = true;
  root.append(card);

  let frame = 0;
  /** Ha salido un aviso con el juego en marcha (si ahora está en pausa, la ha puesto él). */
  let noticePending = false;
  let tip: DueTip | null = null;
  let finishedAt: number | null = null;
  let shown = '';

  const save = (patch: Partial<GuideState>) => store.set({ ...store.get(), ...patch });

  /** Lo hecho desde la última vez; dice si ha cambiado algo. */
  const checkSteps = () => {
    const s = store.get();
    const fresh = GUIDE_STEPS.filter((k) => !s.done.includes(k) && stepDone(k, opts.world, seen));
    if (fresh.length > 0) save({ done: [...s.done, ...fresh] });
  };

  const checkTip = () => {
    const s = store.get();
    if (tip || s.tipsOff) return;
    const pausedByNotice = noticePending && opts.time.speed === 0;
    noticePending = false;
    const ctx = { pausedByNotice, zombiesSeen: opts.zombiesSeen?.() ?? 0 };
    const due = dueTip(opts.world, ctx, s.tipsShown);
    if (!due) return;
    tip = due;
    save({ tipsShown: [...s.tipsShown, due.id] }); // una sola vez, aunque se recargue
  };

  const button = (text: string, testid: string, act: () => void, cls?: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.dataset.testid = testid;
    if (cls) b.className = cls;
    b.addEventListener('click', () => {
      act();
      b.blur();
      shown = '';
      render();
    });
    return b;
  };
  const p = (text: string, cls?: string) => {
    const e = document.createElement('p');
    e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };

  /** Lo que se enseña ahora, como texto (para no rehacer la tarjeta si no cambia). */
  function what(): string {
    if (opts.tool.active) return 'none'; // ya está el letrero de la herramienta
    if (tip) return `tip:${tip.id}:${tip.who ?? ''}`;
    const s = store.get();
    if (s.hidden) return 'none';
    const step = currentStep(s.done);
    if (step) return `step:${step}:${s.folded}:${s.done.length}`;
    if (s.finished) return 'none';
    return 'finished';
  }

  function render(): void {
    const key = `${what()}:${touch()}`;
    if (key === shown) return;
    shown = key;
    const s = store.get();
    card.className = 'coach';
    card.replaceChildren();
    card.hidden = key.startsWith('none');
    if (card.hidden) return;
    const of = GUIDE_STEPS.length;
    if (tip) {
      const t = es.tips[tip.id];
      const title = typeof t.title === 'function' ? t.title(tip.who ?? '') : t.title;
      card.classList.add('tip');
      card.dataset.tip = tip.id;
      const head = document.createElement('strong');
      head.textContent = `${es.tips.icon} ${title}`;
      card.append(
        head,
        p(t.text(touch())),
        button(es.tips.ok, 'coach-ok', () => (tip = null), 'primary'),
      );
      return;
    }
    delete card.dataset.tip;
    const step = currentStep(s.done);
    if (!step) {
      const f = es.guide.finished;
      const head = document.createElement('strong');
      head.textContent = f.title;
      card.append(
        head,
        p(f.text),
        button(f.close, 'coach-finish', () => save({ finished: true }), 'primary'),
      );
      return;
    }
    const n = s.done.length + 1;
    if (s.folded) {
      card.classList.add('folded');
      card.append(
        button(es.guide.folded(n, of), 'coach-unfold', () => save({ folded: false }), 'unfold'),
      );
      return;
    }
    const top = document.createElement('div');
    top.className = 'coach-top';
    top.append(
      p(`${es.guide.title} · ${es.guide.progress(n, of)}`, 'muted'),
      button('▾', 'coach-fold', () => save({ folded: true }), 'fold'),
    );
    const fold = top.querySelector('.fold') as HTMLElement;
    fold.title = es.guide.fold;
    fold.setAttribute('aria-label', es.guide.fold);
    const head = document.createElement('strong');
    head.textContent = es.guide.steps[step].title;
    head.dataset.testid = `coach-step-${step}`;
    const hide = button(es.guide.hide, 'coach-hide', () => save({ hidden: true }));
    hide.title = es.guide.hideHint;
    const progress = document.createElement('div');
    progress.className = 'coach-progress';
    for (const k of GUIDE_STEPS) {
      const dot = document.createElement('span');
      dot.className = s.done.includes(k) ? 'dot done' : k === step ? 'dot now' : 'dot';
      progress.append(dot);
    }
    card.append(top, head, p(es.guide.steps[step].text(touch())), progress, hide);
  }

  return {
    update() {
      if (opts.time.speed >= 2) seen.fast = true;
      if (frame++ % CHECK_EVERY === 0 || noticePending) {
        checkSteps();
        checkTip();
      }
      // «¡Ya sabes lo básico!» se va solo al rato.
      const s = store.get();
      if (!s.finished && !s.hidden && currentStep(s.done) === null && !tip) {
        finishedAt ??= now();
        if (now() - finishedAt > FINISHED_MS) save({ finished: true });
      }
      render();
    },
    noticed() {
      if (opts.time.speed !== 0) noticePending = true;
    },
    restart() {
      seen.selected = false;
      seen.fast = false;
      seen.workOpened = false;
      finishedAt = null;
      save({ done: [], hidden: false, finished: false, folded: false });
      shown = '';
    },
    tips: {
      get: () => !store.get().tipsOff,
      set: (on) => {
        save({ tipsOff: !on });
        if (!on) tip = null;
      },
    },
  };
}
