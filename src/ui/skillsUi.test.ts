// @vitest-environment jsdom
// H4c §5: ficha con pestañas (General y Habilidades), textos del registro y aviso al subir de nivel.
import { beforeEach, expect, test } from 'vitest';
import { TICKS_PER_HOUR } from '../sim/balance';
import { logEvent } from '../sim/log';
import { createWorld } from '../sim/world';
import { formatLogEntry, noticeFor } from './describe';
import { createSelection } from './selection';
import { mountSheet } from './sheet';
import { createFlag } from './flag';
import { mountWorkPanel } from './workPanel';
import type { Survivor } from '../sim/types';

const q = (root: HTMLElement, id: string) =>
  root.querySelector(`[data-testid="${id}"]`) as HTMLElement;

function setup() {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const world = createWorld(5);
  const selection = createSelection();
  const sheet = mountSheet(root, { world, selection });
  const s = world.survivors[0]!;
  selection.set(s.id);
  sheet.update();
  return { root, world, selection, sheet, s };
}

beforeEach(() => localStorage.clear());

test('ficha con dos pestañas: General (lo de siempre) y Habilidades', () => {
  const { root, sheet } = setup();
  const general = q(root, 'sheet-pane-general');
  const skills = q(root, 'sheet-pane-skills');
  expect(q(root, 'sheet-tab-general').textContent).toBe('General');
  expect(q(root, 'sheet-tab-skills').textContent).toBe('Habilidades');
  expect(q(root, 'sheet-tab-general').classList.contains('selected')).toBe(true);
  expect(general.hidden).toBe(false);
  expect(skills.hidden).toBe(true);
  expect(general.contains(q(root, 'sheet-weapon'))).toBe(true);
  q(root, 'sheet-tab-skills').click();
  sheet.update();
  expect(general.hidden).toBe(true);
  expect(skills.hidden).toBe(false);
  expect(q(root, 'sheet-tab-skills').classList.contains('selected')).toBe(true);
});

test('Habilidades: una fila por habilidad con su nivel y la barrita de la práctica ("máx." a 10)', () => {
  const { root, sheet, s } = setup();
  q(root, 'sheet-tab-skills').click();
  s.skills.build = { level: 4, xp: 2.5 * TICKS_PER_HOUR }; // la mitad de las 5 h que cuesta
  s.skills.fight = { level: 10, xp: 0 };
  sheet.update();
  const rows = [...root.querySelectorAll('[data-testid^="sheet-skill-"]')];
  expect(rows.map((r) => r.querySelector('.name')!.textContent)).toEqual([
    'Sanar', // H4e
    'Social',
    'Construir',
    'Fabricar',
    'Transportar',
    'Talar',
    'Saquear',
    'Pelear',
  ]);
  const build = q(root, 'sheet-skill-build');
  expect(build.querySelector('.level')!.textContent).toBe('4');
  expect((build.querySelector('.fill') as HTMLElement).style.width).toBe('50%');
  const fight = q(root, 'sheet-skill-fight');
  expect(fight.querySelector('.level')!.textContent).toBe('10');
  expect(fight.textContent).toContain('máx.');
  expect((fight.querySelector('.fill') as HTMLElement).style.width).toBe('100%');
});

test('la ficha recuerda la última pestaña (y sin poder guardarlo, abre General)', () => {
  const first = setup();
  q(first.root, 'sheet-tab-skills').click();
  const again = setup();
  expect(q(again.root, 'sheet-pane-skills').hidden).toBe(false);
  q(again.root, 'sheet-tab-general').click();
  expect(q(setup().root, 'sheet-pane-general').hidden).toBe(false);
});

test('los rasgos nuevos salen con su explicación', () => {
  const { root, sheet, s } = setup();
  s.traits = ['handy', 'fastLearner'];
  sheet.update();
  const text = q(root, 'sheet-pane-general').textContent!;
  expect(text).toContain('Manitas — +2 en Construir y en Fabricar.');
  expect(text).toContain('Aprende rápido — La práctica le cunde un 50 % más.');
});

test('registro: sube de nivel, falla al construir y consuela sin éxito; solo lo primero avisa (verde)', () => {
  const w = createWorld(5);
  const a = w.survivors[0]!;
  const b = w.survivors[1]!;
  logEvent(w, { kind: 'skillUp', survivorId: a.id, skill: 'build', level: 4 });
  logEvent(w, { kind: 'buildFailed', survivorId: a.id, what: 'woodWall', wood: 1 });
  logEvent(w, { kind: 'consoleFailed', survivorId: a.id, otherId: b.id });
  const [up, failed, console] = w.common.log;
  expect(formatLogEntry(up!, w)).toContain(`${a.name} ha mejorado en Construir (nivel 4)`);
  expect(formatLogEntry(failed!, w)).toContain(
    `${a.name} ha fallado al levantar el muro (−1 de madera)`,
  );
  expect(formatLogEntry(console!, w)).toContain(
    `${a.name} ha intentado consolar a ${b.name}, sin éxito`,
  );
  expect(noticeFor(up!)).toEqual({ tone: 'good', title: 'Mejora', focusId: a.id });
  expect(noticeFor(failed!)).toBeNull();
  expect(noticeFor(console!)).toBeNull();
});

test('panel de Trabajos como matriz: columnas por habilidad, casilla y nivel; el mejor, en negrita', () => {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const world = createWorld(5);
  const open = createFlag();
  const panel = mountWorkPanel(root, { world, open });
  open.set(true);
  const [a, b, c] = world.survivors as [Survivor, Survivor, Survivor];
  a.skills.build.level = 7;
  b.skills.build.level = 3;
  c.skills.build.level = 7;
  a.skills.fight.level = 2;
  b.skills.fight.level = 9;
  c.skills.fight.level = 1;
  panel.update();
  expect([...root.querySelectorAll('th')].map((t) => t.textContent)).toEqual([
    '',
    'Sanar', // H4e
    'Social',
    'Construir',
    'Fabricar',
    'Transportar',
    'Talar',
    'Saquear',
    'Pelear',
    'Atuendo', // H5b
  ]);
  const level = (s: Survivor, k: string) => q(root, `work-${s.id}-${k}-level`);
  expect(level(a, 'build').textContent).toBe('7');
  expect(level(b, 'build').textContent).toBe('3');
  // Empatados, los dos en negrita.
  expect(level(a, 'build').classList.contains('best')).toBe(true);
  expect(level(c, 'build').classList.contains('best')).toBe(true);
  expect(level(b, 'build').classList.contains('best')).toBe(false);
  // En Pelear, el nivel junto a la postura (sin casilla).
  expect(level(b, 'fight').classList.contains('best')).toBe(true);
  const fightCell = level(b, 'fight').closest('td')!;
  expect(fightCell.contains(q(root, `work-${b.id}-stance`))).toBe(true);
  expect(fightCell.querySelector('input[type="checkbox"]')).toBeNull();
  // Las casillas siguen dando órdenes.
  expect(q(root, `work-${a.id}-build`).closest('td')).toBe(level(a, 'build').closest('td'));
  b.skills.build.level = 8;
  panel.update();
  expect(level(b, 'build').classList.contains('best')).toBe(true);
  expect(level(a, 'build').classList.contains('best')).toBe(false);
});
