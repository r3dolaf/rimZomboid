// El panel «Partida» (spec H6b §2): guardar ahora, cargar la guardada (confirmando), exportar a un
// archivo e importar uno; y el sonido (S1 §3).
import type { SoundPrefs, SoundPrefsStore } from '../audio/prefs';
import { t as es, type Lang } from '../i18n';
import { langSwitch } from './langSwitch';
import type { GameSetup, NarratorStyle } from '../sim/types';
import { setupLine } from './describe';
import type { Flag } from './flag';
import { importInput } from './saveStore';
import { DEFAULT_SETUP } from '../sim/setup';
import { achievementsList, type AchievementStore } from './achievements';
import './panels.css';

export function mountGamePanel(
  root: HTMLElement,
  opts: {
    open: Flag;
    /** H6c: la semilla y el narrador de la partida (antes, en la barra de arriba). */
    seed: number;
    narrator?: NarratorStyle;
    /** C2: el comienzo y los ajustes. */
    setup?: GameSetup;
    hasSave: () => boolean;
    /** Guarda; `false` si no se ha podido. */
    onSave: () => boolean;
    onLoad: () => void;
    onExport: () => void;
    onImport: (text: string) => void;
    /** S1: los ajustes del sonido (volúmenes y Silenciar). */
    sound?: SoundPrefsStore;
    /** I1: elegir otro idioma (guarda la partida y recarga). */
    onLanguage?: (l: Lang) => void;
    /** C3: los logros (lo conseguido en el navegador) y si en esta partida hay trampas. */
    achievements?: { store: AchievementStore; cheated: () => boolean };
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
  label.className = 'import file-button';
  label.append(document.createTextNode(t.import), importInput('game-import', opts.onImport));
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
  const setup = document.createElement('p');
  setup.className = 'muted';
  setup.dataset.testid = 'game-setup';
  setup.textContent = setupLine(opts.setup ?? DEFAULT_SETUP);
  panel.append(head, seed, narrator, setup, row, status);
  if (opts.onLanguage) panel.append(langSwitch(opts.onLanguage)); // I1
  const sound = opts.sound ? soundSection(opts.sound) : null;
  if (sound) panel.append(sound.el);
  const trophies = opts.achievements ? achievementsSection(opts.achievements) : null;
  if (trophies) panel.append(trophies.el);
  root.append(panel);
  return {
    update() {
      panel.hidden = !opts.open.value;
      if (panel.hidden) {
        confirm.hidden = true;
        return;
      }
      load.disabled = !opts.hasSave();
      sound?.update();
      trophies?.update();
    },
    say,
  };
}

/** La sección Sonido (S1 §3): General, Música y Efectos (0–100) y Silenciar. */
function soundSection(store: SoundPrefsStore): { el: HTMLElement; update(): void } {
  const t = es.sound;
  const el = document.createElement('section');
  el.className = 'sound';
  const h3 = document.createElement('h3');
  h3.textContent = t.title;
  el.append(h3);
  const sliders = (['master', 'music', 'sfx'] as const).map((key) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '5';
    input.dataset.testid = `sound-${key}`;
    input.addEventListener('input', () =>
      store.set({ ...store.get(), [key]: Number(input.value) }),
    );
    label.append(document.createTextNode(`${t[key]} `), input);
    el.append(label);
    return { key, input };
  });
  const label = document.createElement('label');
  const muted = document.createElement('input');
  muted.type = 'checkbox';
  muted.dataset.testid = 'sound-muted';
  muted.addEventListener('change', () => store.set({ ...store.get(), muted: muted.checked }));
  label.append(muted, document.createTextNode(` ${t.muted}`));
  el.append(label);
  return {
    el,
    update() {
      const p: SoundPrefs = store.get();
      for (const s of sliders) {
        const v = String(p[s.key]);
        // Mientras se arrastra no se toca (si no, saltaría).
        if (s.input.value !== v && document.activeElement !== s.input) s.input.value = v;
      }
      if (muted.checked !== p.muted) muted.checked = p.muted;
    },
  };
}

/** C3: «🏆 Logros 5/20» y la lista (lo que falta, apagado, con cómo se consigue). */
function achievementsSection(a: { store: AchievementStore; cheated: () => boolean }): {
  el: HTMLElement;
  update(): void;
} {
  const t = es.achievements;
  const el = document.createElement('section');
  el.className = 'achievements';
  el.dataset.testid = 'game-achievements';
  let shown = '';
  return {
    el,
    update() {
      const list = achievementsList(a.store);
      const done = list.filter((x) => x.done).length;
      const key = `${done}:${a.cheated()}`;
      if (key === shown) return;
      shown = key;
      const h3 = document.createElement('h3');
      h3.textContent = t.count(done, list.length);
      const ul = document.createElement('ul');
      for (const x of list) {
        const li = document.createElement('li');
        li.className = x.done ? 'done' : 'muted';
        li.dataset.testid = `achievement-row-${x.id}`;
        li.textContent = `${x.done ? '🏆' : '·'} ${x.name} — ${x.how}`;
        ul.append(li);
      }
      el.replaceChildren(h3);
      if (a.cheated()) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = t.cheated;
        el.append(p);
      }
      el.append(ul);
    },
  };
}
