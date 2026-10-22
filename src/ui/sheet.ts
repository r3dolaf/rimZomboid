import { es } from '../i18n/es';
import { weightOf } from '../sim/items';
import { moodModifiers, moodTarget } from '../sim/mood';
import { issue } from '../sim/orders';
import { SKILL_MAX } from '../sim/balance';
import { capacityKg, SKILLS, xpToNext } from '../sim/skills';
import { opinionOf, relationLabel } from '../sim/social';
import type { Survivor, World } from '../sim/types';
import { activityText, formatItems, formatModifier, signed } from './describe';
import type { Selection } from './selection';
import {
  cyclePriority,
  effectiveLock,
  effectiveStance,
  effectiveWork,
  showPriority,
  STANCES,
  WORKS,
} from './workPanel';
import './panels.css';

/**
 * Ficha del superviviente seleccionado, en dos pestañas: General (qué hace, trabajos, postura, arma,
 * carga, rasgos, necesidades, por qué de su ánimo y relaciones) y Habilidades (H4c).
 */
export function mountSheet(
  root: HTMLElement,
  opts: { world: World; selection: Selection },
): { update(): void } {
  const panel = document.createElement('aside');
  panel.className = 'sheet';
  panel.dataset.testid = 'sheet';
  panel.hidden = true;
  root.append(panel);

  // (Esc la cierra desde bindEscape, en main.ts.)
  const close = () => opts.selection.set(null);

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

  // Las prioridades de trabajo (H4d) también son fijas, por lo mismo que la ✕.
  const work = document.createElement('div');
  work.className = 'work';
  const cells = WORKS.map((k) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.dataset.testid = `sheet-work-${k}`;
    const prio = document.createElement('span');
    prio.className = 'prio';
    cell.append(prio, document.createTextNode(es.works[k]));
    cell.addEventListener('click', () => {
      const s = opts.world.survivors.find((x) => x.id === opts.selection.id);
      if (s) cyclePriority(opts.world, s, k);
      cell.blur();
    });
    work.append(cell);
    return { cell, prio };
  });
  // Postura (H4b): tres botones, fijos como las prioridades.
  const stanceRow = document.createElement('div');
  stanceRow.className = 'stance';
  stanceRow.append(document.createTextNode(`${es.stanceTitle}: `));
  const stanceButtons = STANCES.map((k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = es.stances[k];
    b.title = es.stanceHints[k];
    b.dataset.testid = `sheet-stance-${k}`;
    b.addEventListener('click', () => {
      const id = opts.selection.id;
      if (id !== null) issue(opts.world, { type: 'setStance', survivorId: id, stance: k });
      b.blur();
    });
    stanceRow.append(b);
    return b;
  });

  // Lo que lleva en la mano y la casilla Fijar.
  const weaponRow = document.createElement('div');
  weaponRow.className = 'weapon';
  weaponRow.dataset.testid = 'sheet-weapon';
  const weaponText = document.createElement('span');
  const lockLabel = document.createElement('label');
  lockLabel.title = es.lockWeaponHint;
  const lock = document.createElement('input');
  lock.type = 'checkbox';
  lock.dataset.testid = 'sheet-weapon-lock';
  lock.addEventListener('change', () => {
    const id = opts.selection.id;
    if (id !== null)
      issue(opts.world, { type: 'lockWeapon', survivorId: id, locked: lock.checked });
  });
  lockLabel.append(lock, document.createTextNode(es.lockWeapon));
  weaponRow.append(weaponText, lockLabel);

  const carrying = document.createElement('p');
  carrying.className = 'carrying';

  const body = document.createElement('div');

  // Pestañas (H4c): General, lo de siempre; Habilidades, sus niveles y la práctica.
  const general = document.createElement('div');
  general.dataset.testid = 'sheet-pane-general';
  general.append(work, stanceRow, weaponRow, carrying, body);
  const skillsPane = document.createElement('div');
  skillsPane.className = 'skills';
  skillsPane.dataset.testid = 'sheet-pane-skills';
  const skillRows = SKILLS.map((k) => {
    const row = document.createElement('div');
    row.className = 'skill';
    row.dataset.testid = `sheet-skill-${k}`;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = es.skills[k];
    const level = document.createElement('span');
    level.className = 'level';
    const bar = document.createElement('span');
    bar.className = 'bar';
    const fill = document.createElement('span');
    fill.className = 'fill';
    bar.append(fill);
    const note = document.createElement('span');
    note.className = 'note';
    row.append(name, level, bar, note);
    skillsPane.append(row);
    return { k, level, fill, note };
  });
  const tabs = document.createElement('nav');
  tabs.className = 'tabs';
  const panes: Record<SheetTab, HTMLElement> = { general, skills: skillsPane };
  let tab = loadTab();
  const tabButtons = (['general', 'skills'] as const).map((k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = es.sheetTabs[k];
    b.dataset.testid = `sheet-tab-${k}`;
    b.addEventListener('click', () => {
      tab = k;
      saveTab(k);
      showTab();
      b.blur();
    });
    tabs.append(b);
    return { k, b };
  });
  const showTab = () => {
    for (const { k, b } of tabButtons) b.classList.toggle('selected', k === tab);
    for (const k of ['general', 'skills'] as const) panes[k].hidden = k !== tab;
  };
  showTab();
  panel.append(head, tabs, general, skillsPane);

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
      const nameOf = (id: number) => world.survivors.find((x) => x.id === id)?.name ?? '?';
      const mods = moodModifiers(s, world.tick, world.base.rect).map((m) =>
        formatModifier(m, world.tick, nameOf),
      );
      const view = {
        name: s.name,
        doing: activityText(s, world),
        traits: s.traits.map((t) => es.traits[t]),
        needs: [
          `${es.health}: ${Math.round(s.health)}`,
          ...(['hunger', 'sleep', 'social'] as const).map(
            (k) => `${es.needs[k]}: ${Math.round(s.needs[k])}`,
          ),
        ],
        mood: es.moodArrow(
          Math.round(s.needs.mood),
          Math.round(moodTarget(s, world.tick, world.base.rect)),
        ),
        mods,
        partner: s.partnerId === null ? null : nameOf(s.partnerId),
        relations: relations(s, world),
      };
      // Las prioridades, con las órdenes pendientes ya aplicadas.
      cells.forEach(({ cell, prio }, i) => {
        showPriority(prio, world, s, WORKS[i]!);
        cell.classList.toggle('off', !effectiveWork(world, s, WORKS[i]!));
        if (cell.title !== prio.title) cell.title = prio.title;
      });
      const carryText = es.carrying(
        formatItems(s.carrying),
        weightOf(s.carrying).toFixed(1).replace('.', ','),
        kg(capacityKg(s)),
      );
      if (carrying.textContent !== carryText) carrying.textContent = carryText;
      const stance = effectiveStance(world, s);
      stanceButtons.forEach((b, i) => b.classList.toggle('selected', STANCES[i] === stance));
      const inHand = s.equipped ? es.inHand(es.items[s.equipped][0]) : es.noWeapon;
      if (weaponText.textContent !== inHand) weaponText.textContent = inHand;
      lock.checked = effectiveLock(world, s);
      for (const r of skillRows) {
        const { level, xp } = s.skills[r.k];
        const max = level >= SKILL_MAX;
        const levelText = String(level);
        if (r.level.textContent !== levelText) r.level.textContent = levelText;
        const width = `${max ? 100 : Math.round((100 * xp) / xpToNext(level))}%`;
        if (r.fill.style.width !== width) r.fill.style.width = width;
        const note = max ? es.skillMax : '';
        if (r.note.textContent !== note) r.note.textContent = note;
      }

      const key = JSON.stringify(view);
      panel.hidden = false;
      if (key === shown) return;
      shown = key;
      title.textContent = view.name;
      body.replaceChildren(render(view));
    },
  };
}

/** Kilos con una cifra decimal, salvo si son justos: "8", "7,2". */
const kg = (n: number) =>
  Number.isInteger(Math.round(n * 10) / 10)
    ? String(Math.round(n))
    : n.toFixed(1).replace('.', ',');

type SheetTab = 'general' | 'skills';
const TAB_KEY = 'rimzomboid.sheetTab';

/** La última pestaña que abrió; si el navegador no deja guardarlo, General. */
function loadTab(): SheetTab {
  try {
    return localStorage.getItem(TAB_KEY) === 'skills' ? 'skills' : 'general';
  } catch {
    return 'general';
  }
}

function saveTab(tab: SheetTab): void {
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    // sin poder guardarlo, la próxima vez se abre General
  }
}

/** "Bea: +45 · Amistad" por cada colono, de quien mejor le cae a quien peor. */
function relations(s: Survivor, w: World): string[] {
  return w.survivors
    .filter((o) => o !== s)
    .map((o) => ({ o, v: Math.round(opinionOf(s, o.id)) }))
    .sort((a, b) => b.v - a.v)
    .map(({ o, v }) => {
      const label = relationLabel(s, o.id);
      return `${o.name}: ${signed(v)}` + (label ? ` · ${es.relationLabels[label]}` : '');
    });
}

/** El cuerpo de la ficha, debajo de la cabecera. */
function render(v: {
  doing: string;
  traits: { name: string; desc: string }[];
  needs: string[];
  mood: string;
  mods: string[];
  partner: string | null;
  relations: string[];
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

  f.append(el('h3', es.relationsTitle));
  if (v.partner !== null) f.append(el('p', es.partner(v.partner), 'partner'));
  const rel = el('ul', undefined, 'relations');
  if (v.relations.length === 0) rel.append(el('li', es.noRelations, 'muted'));
  for (const r of v.relations) {
    const li = el('li', r);
    li.dataset.testid = 'relation';
    rel.append(li);
  }
  f.append(rel);
  return f;
}
