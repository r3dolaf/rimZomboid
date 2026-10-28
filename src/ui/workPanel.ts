import { es } from '../i18n/es';
import { issue } from '../sim/orders';
import { SKILLS } from '../sim/skills';
import { effectiveOutfits } from '../sim/outfits';
import type { SkillId, Stance, Survivor, WorkType, World } from '../sim/types';
import type { Flag } from './flag';
import './panels.css';

export const STANCES: readonly Stance[] = ['fight', 'flee', 'decide'];

/** Columnas, en el orden de criticidad (spec H4a §3.1). */
export const WORKS: readonly WorkType[] = [
  'heal',
  'social',
  'build',
  'craft',
  'haul',
  'chop',
  'loot',
];

/**
 * Panel de Trabajos (spec H4a §5) como matriz (spec H4c §5): una fila por colono y una columna por
 * habilidad, con la prioridad del trabajo (spec H4d §5) y su nivel (el mejor de cada columna, en
 * negrita); en Pelear, el nivel y la postura (spec H4b §8).
 */
export function mountWorkPanel(
  root: HTMLElement,
  opts: { world: World; open: Flag },
): { update(): void } {
  const panel = document.createElement('aside');
  panel.className = 'work-panel';
  panel.dataset.testid = 'work-panel';
  panel.hidden = true;
  const head = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = es.workPanel;
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'close';
  x.textContent = '✕';
  x.dataset.testid = 'work-close';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', () => opts.open.set(false));
  head.append(title, x);

  const table = document.createElement('table');
  const headRow = document.createElement('tr');
  for (const text of [
    '',
    ...WORKS.map((k) => es.works[k]),
    es.skills.fight,
    es.outfitsUi.column, // H5b
  ]) {
    const th = document.createElement('th');
    th.textContent = text;
    headRow.append(th);
  }
  const thead = document.createElement('thead');
  thead.append(headRow);
  const tbody = document.createElement('tbody');
  table.append(thead, tbody);
  panel.append(head, table);
  root.append(panel);

  // Una fila por colono; se crean y se quitan según quién está (las casillas no se rehacen).
  const rows = new Map<
    number,
    {
      tr: HTMLTableRowElement;
      cells: HTMLButtonElement[];
      stance: HTMLSelectElement;
      outfit: HTMLSelectElement;
      levels: Record<SkillId, HTMLSpanElement>;
    }
  >();
  let outfitsShown = '';
  const levelSpan = (s: Survivor, k: SkillId) => {
    const span = document.createElement('span');
    span.className = 'level';
    span.dataset.testid = `work-${s.id}-${k}-level`;
    span.title = `${s.name}: ${es.skills[k]}`;
    return span;
  };
  const addRow = (s: Survivor) => {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = s.name;
    tr.append(name);
    const levels = {} as Record<SkillId, HTMLSpanElement>;
    // Prioridad de cada trabajo (H4d): un botón que pasa por — → 1 → 2 → 3 → 4 → —.
    const cells = WORKS.map((work) => {
      const td = document.createElement('td');
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'prio';
      cell.dataset.testid = `work-${s.id}-${work}`;
      cell.addEventListener('click', () => {
        cyclePriority(opts.world, s, work);
        cell.blur();
      });
      levels[work] = levelSpan(s, work);
      td.append(cell, levels[work]);
      tr.append(td);
      return cell;
    });
    // Postura (H4b): Pelear, Huir o Decidir.
    const td = document.createElement('td');
    const stance = document.createElement('select');
    stance.dataset.testid = `work-${s.id}-stance`;
    stance.title = `${s.name}: ${es.stanceTitle}`;
    for (const k of STANCES) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = es.stances[k];
      o.title = es.stanceHints[k];
      stance.append(o);
    }
    stance.addEventListener('change', () =>
      issue(opts.world, {
        type: 'setStance',
        survivorId: s.id,
        stance: stance.value as Stance,
      }),
    );
    levels.fight = levelSpan(s, 'fight');
    td.append(levels.fight, stance);
    tr.append(td);
    // Atuendo (H5b §8).
    const outfitTd = document.createElement('td');
    const outfit = document.createElement('select');
    outfit.dataset.testid = `work-${s.id}-outfit`;
    outfit.title = `${s.name}: ${es.outfitsUi.column}`;
    outfit.addEventListener('change', () =>
      issue(opts.world, { type: 'setOutfit', survivorId: s.id, outfitId: Number(outfit.value) }),
    );
    outfitTd.append(outfit);
    tr.append(outfitTd);
    tbody.append(tr);
    rows.set(s.id, { tr, cells, stance, outfit, levels });
    outfitsShown = ''; // que la fila nueva tenga sus opciones
  };

  return {
    update() {
      const { world } = opts;
      if (panel.hidden === opts.open.value) panel.hidden = !opts.open.value;
      if (!opts.open.value) return;
      const here = new Set(world.survivors.map((s) => s.id));
      for (const [id, r] of rows)
        if (!here.has(id)) {
          r.tr.remove();
          rows.delete(id);
        }
      // El mejor de cada columna (si empatan, todos) va en negrita.
      const best = {} as Record<SkillId, number>;
      for (const k of SKILLS) best[k] = Math.max(...world.survivors.map((s) => s.skills[k].level));
      for (const s of world.survivors) if (!rows.has(s.id)) addRow(s);
      // Los atuendos (con las órdenes pendientes) en cada desplegable.
      const outfits = effectiveOutfits(world);
      const outfitsKey = JSON.stringify(outfits.map((o) => [o.id, o.name]));
      if (outfitsKey !== outfitsShown) {
        outfitsShown = outfitsKey;
        for (const r of rows.values())
          r.outfit.replaceChildren(
            ...outfits.map((o) => {
              const opt = document.createElement('option');
              opt.value = String(o.id);
              opt.textContent = o.name;
              return opt;
            }),
          );
      }
      for (const s of world.survivors) {
        const r = rows.get(s.id)!;
        for (const k of SKILLS) {
          const span = r.levels[k];
          const text = String(s.skills[k].level);
          if (span.textContent !== text) span.textContent = text;
          span.classList.toggle('best', s.skills[k].level === best[k]);
        }
        r.cells.forEach((cell, i) => showPriority(cell, world, s, WORKS[i]!));
        const st = effectiveStance(world, s);
        if (r.stance.value !== st) r.stance.value = st;
        const o = String(effectiveOutfit(world, s));
        if (r.outfit.value !== o) r.outfit.value = o;
      }
    },
  };
}

/** Su atuendo con las órdenes pendientes ya aplicadas (H5b). */
export function effectiveOutfit(w: World, s: Survivor): number {
  let id = s.outfitId;
  for (const o of w.orders) if (o.type === 'setOutfit' && o.survivorId === s.id) id = o.outfitId;
  return id;
}

/** El permiso con las órdenes pendientes ya aplicadas (para verlo marcado aunque esté en pausa). */
export function effectiveWork(w: World, s: Survivor, work: WorkType): boolean {
  let on = s.work[work];
  for (const o of w.orders)
    if (o.type === 'setWork' && o.survivorId === s.id && o.work === work) on = o.enabled;
  return on;
}

/** La prioridad (1–4) con las órdenes pendientes ya aplicadas. */
export function effectivePriority(w: World, s: Survivor, work: WorkType): number {
  let p = s.priorities[work];
  for (const o of w.orders)
    if (o.type === 'setPriority' && o.survivorId === s.id && o.work === work) {
      if (Number.isInteger(o.priority) && o.priority >= 1 && o.priority <= 4) p = o.priority;
    }
  return p;
}

/** Un clic en la prioridad (spec H4d §5): — → 1 → 2 → 3 → 4 → —. */
export function cyclePriority(w: World, s: Survivor, work: WorkType): void {
  if (!effectiveWork(w, s, work)) {
    issue(w, { type: 'setWork', survivorId: s.id, work, enabled: true });
    issue(w, { type: 'setPriority', survivorId: s.id, work, priority: 1 });
    return;
  }
  const p = effectivePriority(w, s, work);
  if (p < 4) issue(w, { type: 'setPriority', survivorId: s.id, work, priority: p + 1 });
  else issue(w, { type: 'setWork', survivorId: s.id, work, enabled: false });
}

/** Pinta la prioridad en `el`: "—" (apagada) o el número, con su ayuda. */
export function showPriority(el: HTMLElement, w: World, s: Survivor, work: WorkType): void {
  const on = effectiveWork(w, s, work);
  const p = on ? effectivePriority(w, s, work) : null;
  const text = p === null ? es.priorityOff : String(p);
  if (el.textContent !== text) el.textContent = text;
  el.classList.toggle('off', p === null);
  const title = `${es.priorityHint(s.name, es.works[work], p)}\n${es.priorityHelp}`;
  if (el.title !== title) el.title = title;
}

/** La postura con las órdenes pendientes ya aplicadas. */
export function effectiveStance(w: World, s: Survivor): Stance {
  let st = s.stance;
  for (const o of w.orders) if (o.type === 'setStance' && o.survivorId === s.id) st = o.stance;
  return st;
}

/** Si tiene el arma fijada, con las órdenes pendientes ya aplicadas. */
export function effectiveLock(w: World, s: Survivor): boolean {
  let on = s.weaponLocked;
  for (const o of w.orders) if (o.type === 'lockWeapon' && o.survivorId === s.id) on = o.locked;
  return on;
}
