import { es } from '../i18n/es';
import { moodModifiers, moodTarget } from '../sim/mood';
import type { World } from '../sim/types';
import { activityText, formatModifier } from './describe';
import type { Selection } from './selection';
import './panels.css';

/** Ficha del superviviente seleccionado: qué hace, rasgos, necesidades y por qué de su ánimo. */
export function mountSheet(
  root: HTMLElement,
  opts: { world: World; selection: Selection },
): { update(): void } {
  const panel = document.createElement('aside');
  panel.className = 'sheet';
  panel.dataset.testid = 'sheet';
  panel.hidden = true;
  root.append(panel);

  const close = () => opts.selection.set(null);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // La cabecera (nombre y ✕) se crea una vez: si la ✕ se rehiciera mientras se pulsa,
  // el navegador no daría el clic por bueno.
  const head = document.createElement('header');
  const title = document.createElement('h2');
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'close';
  x.textContent = '✕';
  x.dataset.testid = 'sheet-close';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', close);
  head.append(title, x);
  const body = document.createElement('div');
  panel.append(head, body);

  let shown = ''; // firma de lo pintado, para no rehacer el DOM en cada fotograma

  return {
    update() {
      const { world } = opts;
      const s = world.survivors.find((x) => x.id === opts.selection.id);
      if (!s) {
        panel.hidden = true;
        shown = '';
        return;
      }
      const mods = moodModifiers(s, world.tick).map((m) => formatModifier(m, world.tick));
      const view = {
        name: s.name,
        doing: activityText(s),
        traits: s.traits.map((t) => es.traits[t]),
        needs: (['hunger', 'sleep'] as const).map(
          (k) => `${es.needs[k]}: ${Math.round(s.needs[k])}`,
        ),
        mood: es.moodArrow(Math.round(s.needs.mood), Math.round(moodTarget(s, world.tick))),
        mods,
      };
      const key = JSON.stringify(view);
      panel.hidden = false;
      if (key === shown) return;
      shown = key;
      title.textContent = view.name;
      body.replaceChildren(render(view));
    },
  };
}

/** El cuerpo de la ficha, debajo de la cabecera. */
function render(v: {
  doing: string;
  traits: { name: string; desc: string }[];
  needs: string[];
  mood: string;
  mods: string[];
}): DocumentFragment {
  const f = document.createDocumentFragment();
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };

  f.append(el('p', v.doing, 'doing'));

  f.append(el('h3', es.traitsTitle));
  const traits = el('ul');
  for (const t of v.traits) {
    const li = el('li');
    li.append(el('strong', t.name), document.createTextNode(` — ${t.desc}`));
    traits.append(li);
  }
  f.append(traits);

  f.append(el('h3', es.needsTitle));
  const needs = el('ul', undefined, 'needs');
  for (const n of v.needs) needs.append(el('li', n));
  f.append(needs);

  const moodHead = el('h3', `${es.moodTitle}: `);
  const mood = el('span', v.mood);
  mood.dataset.testid = 'mood';
  moodHead.append(mood);
  f.append(moodHead, el('h4', es.moodReasonsTitle));
  const mods = el('ul', undefined, 'mods');
  if (v.mods.length === 0) mods.append(el('li', es.noReasons, 'muted'));
  for (const m of v.mods) {
    const li = el('li', m);
    li.dataset.testid = 'modifier';
    li.classList.add(m.includes('−') ? 'neg' : 'pos');
    mods.append(li);
  }
  f.append(mods);
  return f;
}
