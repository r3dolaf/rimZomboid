import { es } from '../i18n/es';
import { weightOf } from '../sim/items';
import { moodModifiers, moodTarget } from '../sim/mood';
import { draftToggle, effectiveDrafted } from '../game/command';
import { canDraft } from '../sim/draft';
import { issue } from '../sim/orders';
import { effectiveOutfits } from '../sim/outfits';
import { SKILL_MAX } from '../sim/balance';
import { capacityKg, SKILLS, xpToNext } from '../sim/skills';
import { opinionOf, relationLabel } from '../sim/social';
import type { Survivor, World } from '../sim/types';
import {
  activityText,
  clothesView,
  formatItems,
  formatModifier,
  healthView,
  mapThe,
  personName,
  signed,
} from './describe';
import { mountBagsPane } from './bagsPane';
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
  opts: {
    world: World;
    selection: Selection;
    /** La base, para buscar nombres en todos los mapas (H5c1); sin ella, `world`. */
    base?: World;
  },
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
  // Modo combate (H4e): el botón Combate, fijo como lo demás.
  const draft = document.createElement('button');
  draft.type = 'button';
  draft.className = 'draft';
  draft.dataset.testid = 'sheet-draft';
  draft.textContent = es.draftButton;
  draft.title = es.draftHint;
  draft.addEventListener('click', () => {
    const o = draftToggle(opts.world, opts.selection.ids);
    if (o) issue(opts.world, o);
    draft.blur();
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
  general.append(work, draft, stanceRow, weaponRow, carrying, body);
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
  // Salud (H5 §10): el cuerpo, la Sangre, lo que sufre y Dar analgésico.
  const healthPane = document.createElement('div');
  healthPane.className = 'health';
  healthPane.dataset.testid = 'sheet-pane-health';
  const healthBody = document.createElement('div');
  const painkiller = document.createElement('button');
  painkiller.type = 'button';
  painkiller.className = 'painkiller';
  painkiller.dataset.testid = 'sheet-painkiller';
  painkiller.textContent = es.healthUi.givePainkiller;
  painkiller.title = es.healthUi.givePainkillerHint;
  painkiller.addEventListener('click', () => {
    const id = opts.selection.id;
    if (id !== null) issue(opts.world, { type: 'givePainkiller', survivorId: id });
    painkiller.blur();
  });
  healthPane.append(healthBody, painkiller);
  let healthShown = '';
  // Ropa (H5b §8): cada zona con lo que lleva, su atuendo, favorita y odiada.
  const clothesPane = document.createElement('div');
  clothesPane.className = 'clothes';
  clothesPane.dataset.testid = 'sheet-pane-clothes';
  const outfitRow = document.createElement('label');
  outfitRow.className = 'outfit';
  outfitRow.textContent = `${es.clothesUi.outfit}: `;
  const outfitSelect = document.createElement('select');
  outfitSelect.dataset.testid = 'sheet-outfit';
  outfitSelect.addEventListener('change', () => {
    const id = opts.selection.id;
    if (id !== null)
      issue(opts.world, {
        type: 'setOutfit',
        survivorId: id,
        outfitId: Number(outfitSelect.value),
      });
  });
  outfitRow.append(outfitSelect);
  const clothesBody = document.createElement('div');
  clothesPane.append(outfitRow, clothesBody);
  let clothesShown = '';
  let outfitsShown = '';

  // Bolsas (H5b2 §7).
  const bags = mountBagsPane({
    world: opts.world,
    survivor: () => opts.world.survivors.find((x) => x.id === opts.selection.id),
  });

  const tabs = document.createElement('nav');
  tabs.className = 'tabs';
  const panes: Record<SheetTab, HTMLElement> = {
    general,
    skills: skillsPane,
    health: healthPane,
    clothes: clothesPane,
    bags: bags.pane,
  };
  let tab = loadTab();
  const tabButtons = SHEET_TABS.map((k) => {
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
    for (const k of SHEET_TABS) panes[k].hidden = k !== tab;
  };
  showTab();
  panel.append(head, tabs, general, skillsPane, healthPane, clothesPane, bags.pane);

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
      const nameOf = (id: number) => personName(opts.base ?? world, id);
      const mods = moodModifiers(s, world.tick, world.base.rect).map((m) =>
        formatModifier(m, world.tick, nameOf),
      );
      const view = {
        name: s.name,
        // En un sitio, dónde está (H5c1 §7).
        where: world.mapId === 0 ? null : es.maps.inSite(mapThe(world)),
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
      const drafted = effectiveDrafted(world, s);
      draft.classList.toggle('active', drafted);
      draft.disabled = !drafted && !canDraft(s);
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

      // Dar analgésico: apagado si no quedan, si ya lo tiene o si ya se lo van a dar.
      const asked =
        s.painkillerWanted ||
        world.orders.some((o) => o.type === 'givePainkiller' && o.survivorId === s.id);
      painkiller.disabled =
        world.storage.items.painkillers === 0 || asked || s.painkillerUntil > world.tick;
      const health = healthView(s, world);
      const healthKey = JSON.stringify(health);
      if (healthKey !== healthShown) {
        healthShown = healthKey;
        healthBody.replaceChildren(renderHealth(health));
      }

      // Ropa: los atuendos (con las órdenes pendientes) y el suyo.
      const outfits = effectiveOutfits(world);
      const outfitsKey = JSON.stringify(outfits.map((o) => [o.id, o.name]));
      if (outfitsKey !== outfitsShown) {
        outfitsShown = outfitsKey;
        outfitSelect.replaceChildren(
          ...outfits.map((o) => {
            const opt = document.createElement('option');
            opt.value = String(o.id);
            opt.textContent = o.name;
            return opt;
          }),
        );
      }
      let outfitId = String(s.outfitId);
      for (const o of world.orders)
        if (o.type === 'setOutfit' && o.survivorId === s.id) outfitId = String(o.outfitId);
      if (outfitSelect.value !== outfitId && document.activeElement !== outfitSelect)
        outfitSelect.value = outfitId;
      const clothes = clothesView(s);
      const clothesKey = JSON.stringify(clothes);
      if (clothesKey !== clothesShown) {
        clothesShown = clothesKey;
        clothesBody.replaceChildren(renderClothes(clothes));
      }
      bags.update(s);

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

const SHEET_TABS = ['general', 'skills', 'health', 'clothes', 'bags'] as const;
type SheetTab = (typeof SHEET_TABS)[number];
const TAB_KEY = 'rimzomboid.sheetTab';

/** La última pestaña que abrió; si el navegador no deja guardarlo, General. */
function loadTab(): SheetTab {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    return SHEET_TABS.find((t) => t === saved) ?? 'general';
  } catch {
    return 'general';
  }
}

/** La pestaña Salud: cada parte con su barra y sus heridas, la Sangre y lo que sufre. */
function renderHealth(v: ReturnType<typeof healthView>): DocumentFragment {
  const f = document.createDocumentFragment();
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const t = es.healthUi;
  f.append(el('h3', t.bodyTitle));
  for (const p of v.parts) {
    const row = el('div', undefined, 'part');
    row.append(el('span', `${p.name}: ${p.hp} / ${p.max}`));
    const bar = el('div', undefined, 'bar');
    const fill = el('div', undefined, 'fill');
    fill.style.width = `${Math.round((100 * p.hp) / p.max)}%`;
    bar.append(fill);
    row.append(bar);
    if (p.wounds.length > 0) {
      const ul = el('ul', undefined, 'wounds');
      for (const wd of p.wounds) ul.append(el('li', wd));
      row.append(ul);
    }
    f.append(row);
  }
  f.append(el('p', t.bloodValue(v.blood), 'blood'));
  f.append(el('h3', t.sufferingTitle));
  const ul = el('ul');
  if (v.symptoms.length === 0) ul.append(el('li', t.nothing, 'muted'));
  for (const x of v.symptoms) ul.append(el('li', x));
  f.append(ul);
  return f;
}

/** La pestaña Ropa: cada zona con sus capas y lo que protege; favorita y odiada. */
function renderClothes(v: ReturnType<typeof clothesView>): DocumentFragment {
  const f = document.createDocumentFragment();
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const c = es.clothesUi;
  f.append(el('h3', c.zonesTitle));
  for (const z of v.zones) {
    const row = el('div', undefined, 'zone');
    row.dataset.testid = `clothes-${z.part}`;
    row.append(el('strong', z.name), el('span', ` · ${z.protection}`, 'muted'));
    const ul = el('ul');
    if (z.layers.length === 0) ul.append(el('li', c.nothing, 'muted'));
    for (const g of z.layers) ul.append(el('li', g));
    row.append(ul);
    f.append(row);
  }
  f.append(el('p', v.likes), el('p', v.hates));
  return f;
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
  where: string | null;
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

  if (v.where) f.append(el('p', `${es.maps.awayIcon} ${v.where}`, 'where'));
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
