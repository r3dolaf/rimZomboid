// @vitest-environment jsdom
// H5 §10: la salud en pantalla — iconos y Sangre en las tarjetas, la pestaña Salud, la ficha de la
// cama, los analgésicos arriba, los avisos nuevos y los nombres de quien ya no está.
import { expect, test } from 'vitest';
import { createTimeController } from '../game/timeController';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../sim/balance';
import { addWound } from '../sim/body';
import { startFever } from '../sim/illness';
import { logEvent, type LogEntry } from '../sim/log';
import { ordersSystem } from '../sim/orders';
import { addBase, emptyWorld } from '../sim/testing/fixtures';
import type { World } from '../sim/types';
import { createWorld } from '../sim/world';
import { mountBedPanel } from './bedPanel';
import { mountCards } from './cards';
import { healthIcons, healthView, logText, noticeFor, personName, zombieLabel } from './describe';
import { mountHud } from './hud';
import { NOTICE_GROUPS } from './noticePrefs';
import { createSelection } from './selection';
import { mountSheet } from './sheet';
import { createTool } from './tool';

function world(): World {
  const w = addBase(emptyWorld(30, 30), { x: 2, y: 2, w: 10, h: 8 });
  w.tick = TICKS_PER_DAY / 2;
  return w;
}

test('iconos de salud: sangrando, fiebre, náuseas, analgésico, pierna y brazo inutilizados; la infección no se ve', () => {
  const w = world();
  const s = w.survivors[0]!;
  expect(healthIcons(s, w.tick)).toEqual([]);
  s.infection = { at: w.tick, deathAt: w.tick + 50 * TICKS_PER_HOUR };
  expect(healthIcons(s, w.tick)).toEqual([]);
  addWound(w, s, 'leftArm', 'cut');
  startFever(w, s, 'flu');
  s.fever!.stage = 'nausea';
  s.painkillerUntil = w.tick + 10;
  for (let i = 0; i < 3; i++) addWound(w, s, 'rightLeg', 'bite').bleeding = false;
  for (let i = 0; i < 5; i++) addWound(w, s, 'rightArm', 'cut').bleeding = false;
  expect(healthIcons(s, w.tick).map((i) => i.icon)).toEqual(['🩸', '🤒', '🤢', '💊', '🦿', '💪']);
});

test('la pestaña Salud: cada parte con su vida y sus heridas, la Sangre y lo que sufre; nunca la infección', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.infection = { at: w.tick, deathAt: w.tick + 50 * TICKS_PER_HOUR };
  const cut = addWound(w, s, 'leftLeg', 'cut');
  cut.bleeding = false;
  cut.cleanUntil = w.tick + 10;
  addWound(w, s, 'rightArm', 'scratch');
  s.blood = 72.4;
  const v = healthView(s, w);
  expect(v.parts.map((p) => p.name)).toEqual([
    'Cabeza',
    'Torso',
    'Brazo izquierdo',
    'Brazo derecho',
    'Pierna izquierda',
    'Pierna derecha',
  ]);
  expect(v.parts[4]).toEqual({
    name: 'Pierna izquierda',
    hp: 19,
    max: 25,
    wounds: ['Corte, vendado (se cura en 2 días)'],
  });
  expect(v.parts[3]!.wounds).toEqual(['Arañazo, sangra']);
  expect(v.blood).toBe(72);
  expect(v.symptoms).toEqual([expect.stringMatching(/^Dolor: \d+$/)]);
  cut.cleanUntil = w.tick - 1;
  expect(healthView(s, w).parts[4]!.wounds).toEqual(['Corte, venda sucia (se cura en 3 días)']);
  startFever(w, s, 'infection');
  s.painkillerUntil = w.tick + 2 * TICKS_PER_HOUR;
  expect(healthView(s, w).symptoms).toEqual(expect.arrayContaining(['Fiebre', 'Analgésico (2 h)']));
  expect(JSON.stringify(healthView(s, w))).not.toMatch(/nfec/);
});

test('ficha: pestaña Salud con Dar analgésico (apagado si no quedan)', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const w = world();
  const selection = createSelection();
  const sheet = mountSheet(root, { world: w, selection });
  const s = w.survivors[0]!;
  addWound(w, s, 'leftLeg', 'cut');
  selection.set(s.id);
  (root.querySelector('[data-testid="sheet-tab-health"]') as HTMLButtonElement).click();
  sheet.update();
  const pane = root.querySelector('[data-testid="sheet-pane-health"]') as HTMLElement;
  expect(pane.hidden).toBe(false);
  expect(pane.textContent).toContain('Pierna izquierda');
  expect(pane.textContent).toContain('Corte, sangra');
  expect(pane.textContent).toContain('Sangre: 100');
  const give = root.querySelector('[data-testid="sheet-painkiller"]') as HTMLButtonElement;
  expect(give.disabled).toBe(true);
  w.storage.items.painkillers = 2;
  sheet.update();
  expect(give.disabled).toBe(false);
  give.click();
  expect(w.orders).toContainEqual({ type: 'givePainkiller', survivorId: s.id });
  ordersSystem(w);
  sheet.update();
  expect(give.disabled).toBe(true); // ya se lo van a dar
  (root.querySelector('[data-testid="sheet-tab-general"]') as HTMLButtonElement).click();
  root.remove();
});

test('tarjeta: barra de Sangre bajo la de Salud e iconos de salud', () => {
  const root = document.createElement('div');
  const w = createWorld(5);
  const cards = mountCards(root, { world: w, selection: createSelection() });
  const s = w.survivors[0]!;
  s.blood = 40;
  addWound(w, s, 'torso', 'scratch');
  cards.update();
  const card = root.querySelector(`[data-testid="card-${s.id}"]`)!;
  const bars = [...card.querySelectorAll('.bar')].map((b) => (b as HTMLElement).dataset.need);
  expect(bars.slice(0, 2)).toEqual(['health', 'blood']);
  expect((card.querySelector('[data-need="blood"] .fill') as HTMLElement).style.width).toBe('40%');
  expect(card.querySelector('[data-testid="health-icons"]')?.textContent).toBe('🩸');
});

test('ficha de la cama: de quién es y la casilla Cama de hospital', () => {
  const root = document.createElement('div');
  const w = world();
  const selection = createSelection();
  const panel = mountBedPanel(root, { world: w, selection });
  const el = () => root.querySelector('[data-testid="bed-panel"]') as HTMLElement;
  panel.update();
  expect(el().hidden).toBe(true);
  const bed = w.beds[0]!;
  selection.set(bed.id);
  panel.update();
  expect(el().hidden).toBe(false);
  expect(el().textContent).toContain(`Cama de ${w.survivors[0]!.name}`);
  const box = root.querySelector('[data-testid="bed-medical"]') as HTMLInputElement;
  expect(box.checked).toBe(false);
  box.checked = true;
  box.dispatchEvent(new Event('change'));
  expect(w.orders).toContainEqual({ type: 'setMedical', bedId: bed.id, on: true });
  ordersSystem(w);
  panel.update();
  expect(el().textContent).toContain('Cama de hospital');
  expect(box.checked).toBe(true);
  selection.set(null);
  panel.update();
  expect(el().hidden).toBe(true);
});

test('arriba, también los analgésicos', () => {
  const root = document.createElement('div');
  const w = world();
  const hud = mountHud(root, {
    seed: 1,
    time: createTimeController(),
    tool: createTool(),
    narrator: 'balanced',
    toggleWork: () => {},
    toggleCraft: () => {},
    toggleNotices: () => {},
  });
  w.storage.items.painkillers = 3;
  hud.update({ day: 1, hour: 8, minute: 0 }, w.storage.items);
  expect(root.querySelector('[data-testid="hud-painkillers"]')?.textContent).toContain('3');
});

test('nombres de quien ya no está (muertos, idos) y de los zombis que lo tienen', () => {
  const w = world();
  const s = w.survivors[0]!;
  expect(personName(w, s.id)).toBe(s.name);
  w.dead.push({ id: 77, name: 'Lola', day: 2, cause: 'blood' });
  expect(personName(w, 77)).toBe('Lola');
  expect(personName(w, 999)).toBe('?');
  expect(zombieLabel({ name: 'Lola' })).toBe('Lola (zombi)');
  expect(zombieLabel({})).toBeNull();
});

test('avisos nuevos: rojos (muerte, se levanta, mordisco, lo visto), que no pausan (se ha ido) y en el menú de Avisos', () => {
  const w = world();
  const s = w.survivors[0]!;
  const e = (x: Parameters<typeof logEvent>[1]) => ({ tick: 0, ...x }) as LogEntry;
  expect(noticeFor(e({ kind: 'died', name: 'Ana', cause: 'blood' }))?.tone).toBe('bad');
  expect(noticeFor(e({ kind: 'rose', name: 'Ana' }))?.tone).toBe('bad');
  expect(noticeFor(e({ kind: 'sawTurned', name: 'Ana' }))?.tone).toBe('bad');
  expect(noticeFor(e({ kind: 'killedForNothing', name: 'Ana' }))?.tone).toBe('bad');
  expect(
    noticeFor(e({ kind: 'wounded', survivorId: s.id, part: 'leftArm', wound: 'bite' }))?.tone,
  ).toBe('bad');
  expect(
    noticeFor(e({ kind: 'wounded', survivorId: s.id, part: 'leftArm', wound: 'scratch' })),
  ).toBeNull();
  expect(noticeFor(e({ kind: 'banished', name: 'Ana' }))?.tone).toBe('mixed');
  expect(noticeFor(e({ kind: 'returned', name: 'Ana' }))?.tone).toBe('mixed');
  const kinds = NOTICE_GROUPS.flatMap((g) => g.kinds);
  for (const k of [
    'died',
    'rose',
    'wounded',
    'sawTurned',
    'killedForNothing',
    'banished',
    'returned',
  ])
    expect(kinds).toContain(k);
  // El registro: muertes con su causa y nombres de los que ya no están.
  w.dead.push({ id: 77, name: 'Lola', day: 2, cause: 'blood' });
  expect(logText(e({ kind: 'bandaged', survivorId: s.id, otherId: 77 }), w)).toBe(
    `${s.name} ha vendado a Lola`,
  );
  expect(logText(e({ kind: 'died', name: 'Lola', cause: 'hunger' }), w)).toBe(
    'Lola ha muerto de hambre',
  );
});
