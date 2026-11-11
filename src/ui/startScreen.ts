import { seedFromText } from '../game/seed';
import { es } from '../i18n/es';
import type { SaveMeta } from '../sim/save';
import { DEFAULT_SETUP } from '../sim/setup';
import type { GameSetup, NarratorStyle, ScenarioId, SetupLevel, ZombieLevel } from '../sim/types';
import { importInput } from './saveStore';
import './start.css';

const STYLES: readonly NarratorStyle[] = ['calm', 'balanced', 'chaotic'];
const LEVELS: readonly ZombieLevel[] = ['few', 'normal', 'many'];
const SCENARIOS: readonly ScenarioId[] = ['town', 'solo', 'family', 'bare'];
const SETUP_LEVELS: readonly SetupLevel[] = ['low', 'normal', 'high'];
const SETTINGS = ['infection', 'loot', 'sieges', 'needs', 'cold'] as const;

/** Portada (spec H3c §5.1 y H4b §8): elegir narrador, zombis y semilla, y Empezar. */
export function mountStartScreen(
  root: HTMLElement,
  opts: {
    seed: number;
    randomSeed: () => number;
    onStart(seed: number, style: NarratorStyle, zombies: ZombieLevel, setup: GameSetup): void;
    /** H6b: la partida guardada, si hay, para «Continuar». */
    saved?: SaveMeta | null;
    onContinue?: () => void;
    /** H6b: «Importar partida» desde un archivo. */
    onImport?: (text: string) => void;
    /** U1 §10: «❓ Cómo se juega», que abre la Ayuda. */
    onHelp?: () => void;
  },
): { remove(): void; say(text: string): void } {
  const screen = document.createElement('div');
  screen.className = 'start';
  screen.dataset.testid = 'start';
  const panel = document.createElement('div');
  panel.className = 'start-panel';

  const title = document.createElement('h1');
  title.textContent = es.title;
  const subtitle = document.createElement('p');
  subtitle.className = 'start-subtitle';
  subtitle.textContent = es.start.subtitle;
  // U1 §10: de qué va, y la Ayuda.
  const pitch = document.createElement('p');
  pitch.className = 'start-pitch';
  pitch.dataset.testid = 'start-pitch';
  pitch.textContent = es.start.pitch;
  if (opts.onHelp) {
    const help = document.createElement('button');
    help.type = 'button';
    help.className = 'start-help';
    help.dataset.testid = 'start-help';
    help.textContent = es.help.startButton;
    help.addEventListener('click', () => opts.onHelp?.());
    pitch.append(' ', help);
  }
  /** U1 §10: «Para empezar», en lo recomendado para la primera partida. */
  const starter = () => {
    const tag = document.createElement('em');
    tag.className = 'start-starter';
    tag.textContent = es.start.forStarters;
    return tag;
  };
  // C2: el comienzo, con el objetivo debajo.
  const setup: GameSetup = { ...DEFAULT_SETUP };
  const chooseStart = document.createElement('h2');
  chooseStart.textContent = es.start.scenario;
  const scenarioCards = document.createElement('div');
  scenarioCards.className = 'start-narrators start-scenarios';
  const scenarioButtons = SCENARIOS.map((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'start-narrator';
    b.dataset.testid = `scenario-${id}`;
    const name = document.createElement('strong');
    name.textContent = es.scenarios[id].name;
    const desc = document.createElement('span');
    desc.textContent = es.scenarios[id].desc;
    b.append(name, desc);
    if (id === 'town') b.append(starter());
    b.addEventListener('click', () => {
      setup.scenario = id;
      refreshScenarios();
    });
    scenarioCards.append(b);
    return b;
  });
  const refreshScenarios = () =>
    scenarioButtons.forEach((b, i) =>
      b.classList.toggle('selected', SCENARIOS[i] === setup.scenario),
    );
  refreshScenarios();
  const objective = document.createElement('p');
  objective.className = 'start-objective';
  objective.dataset.testid = 'start-objective';
  objective.textContent = es.start.objective;

  const choose = document.createElement('h2');
  choose.textContent = es.start.choose;

  let style: NarratorStyle = 'balanced';
  const cards = document.createElement('div');
  cards.className = 'start-narrators';
  const buttons = STYLES.map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'start-narrator';
    b.dataset.testid = `narrator-${s}`;
    const name = document.createElement('strong');
    name.textContent = es.narrators[s].name;
    const desc = document.createElement('span');
    desc.textContent = es.narrators[s].desc;
    b.append(name, desc);
    if (s === 'calm') b.append(starter());
    b.addEventListener('click', () => {
      style = s;
      refresh();
    });
    cards.append(b);
    return b;
  });
  const refresh = () =>
    buttons.forEach((b, i) => b.classList.toggle('selected', STYLES[i] === style));
  refresh();

  // Zombis (H4b): pocos, normal o muchos.
  let zombies: ZombieLevel = 'normal';
  const zombiesRow = document.createElement('div');
  zombiesRow.className = 'start-zombies';
  const zombiesTitle = document.createElement('span');
  zombiesTitle.textContent = es.start.zombies;
  zombiesRow.append(zombiesTitle);
  const levelButtons = LEVELS.map((level) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.testid = `zombies-${level}`;
    b.textContent = es.zombieLevels[level];
    if (level === 'few') b.append(' ', starter());
    b.addEventListener('click', () => {
      zombies = level;
      refreshLevels();
    });
    zombiesRow.append(b);
    return b;
  });
  const refreshLevels = () =>
    levelButtons.forEach((b, i) => b.classList.toggle('selected', LEVELS[i] === zombies));
  refreshLevels();

  // C2: los ajustes a medida, plegados (el resumen dice cuántos no son normales).
  const custom = document.createElement('details');
  custom.className = 'start-custom';
  custom.dataset.testid = 'start-custom';
  const summary = document.createElement('summary');
  custom.append(summary);
  const settingButtons = SETTINGS.map((key) => {
    const row = document.createElement('div');
    row.className = 'start-zombies start-setting';
    const label = document.createElement('span');
    label.textContent = es.setup.names[key];
    label.title = es.setup.hints[key];
    row.append(label);
    const bs = SETUP_LEVELS.map((level) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.testid = `setup-${key}-${level}`;
      b.textContent = es.setup.levels[key][level];
      b.title = es.setup.hints[key];
      b.addEventListener('click', () => {
        setup[key] = level;
        refreshSettings();
      });
      row.append(b);
      return b;
    });
    custom.append(row);
    return { key, bs };
  });
  const refreshSettings = () => {
    for (const { key, bs } of settingButtons)
      bs.forEach((b, i) => b.classList.toggle('selected', SETUP_LEVELS[i] === setup[key]));
    summary.textContent = es.start.custom(SETTINGS.filter((k) => setup[k] !== 'normal').length);
  };
  refreshSettings();

  const seedRow = document.createElement('label');
  seedRow.className = 'start-seed';
  seedRow.append(document.createTextNode(es.start.seed));
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.value = String(opts.seed);
  input.dataset.testid = 'start-seed';
  const reroll = document.createElement('button');
  reroll.type = 'button';
  reroll.textContent = es.start.reroll;
  reroll.dataset.testid = 'start-reroll';
  reroll.addEventListener('click', () => {
    input.value = String(opts.randomSeed());
    input.classList.remove('invalid');
  });
  seedRow.append(input, reroll);

  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'start-go';
  go.textContent = es.start.go;
  go.dataset.testid = 'start-go';
  go.addEventListener('click', () => {
    const n = seedFromText(input.value.trim());
    if (n === null) {
      input.classList.add('invalid');
      return;
    }
    opts.onStart(n, style, zombies, { ...setup });
  });

  // H6b: seguir la partida guardada (arriba), o importar una (abajo).
  const top: HTMLElement[] = [];
  const bottom: HTMLElement[] = [];
  if (opts.saved && opts.onContinue) {
    const cont = document.createElement('button');
    cont.type = 'button';
    cont.className = 'start-go start-continue';
    cont.textContent = es.game.continue(opts.saved.day);
    cont.dataset.testid = 'start-continue';
    cont.addEventListener('click', () => opts.onContinue?.());
    top.push(cont);
  }
  if (opts.onImport) {
    const label = document.createElement('label');
    label.className = 'start-import file-button';
    label.append(
      document.createTextNode(es.game.importStart),
      importInput('start-import', opts.onImport),
    );
    bottom.push(label);
  }
  const message = document.createElement('p');
  message.className = 'start-message';
  message.dataset.testid = 'start-message';
  panel.append(
    title,
    subtitle,
    pitch,
    ...top,
    chooseStart,
    scenarioCards,
    objective,
    choose,
    cards,
    zombiesRow,
    custom,
    seedRow,
    go,
    ...bottom,
    message,
  );
  screen.append(panel);
  root.append(screen);
  return { remove: () => screen.remove(), say: (text) => (message.textContent = text) };
}
