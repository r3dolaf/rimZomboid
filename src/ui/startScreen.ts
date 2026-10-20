import { seedFromText } from '../game/seed';
import { es } from '../i18n/es';
import type { NarratorStyle } from '../sim/types';
import './start.css';

const STYLES: readonly NarratorStyle[] = ['calm', 'balanced', 'chaotic'];

/** Portada (spec H3c §5.1): elegir narrador y semilla, y Empezar. */
export function mountStartScreen(
  root: HTMLElement,
  opts: {
    seed: number;
    randomSeed: () => number;
    onStart(seed: number, style: NarratorStyle): void;
  },
): { remove(): void } {
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
    opts.onStart(n, style);
  });

  panel.append(title, subtitle, choose, cards, seedRow, go);
  screen.append(panel);
  root.append(screen);
  return { remove: () => screen.remove() };
}
