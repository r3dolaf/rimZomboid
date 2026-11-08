// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { createTimeController } from '../game/timeController';
import { TICKS_PER_DAY } from '../sim/balance';
import { addDecision } from '../sim/decisions';
import { strangersEvent } from '../sim/events/strangers';
import { logEvent } from '../sim/log';
import { createWorld } from '../sim/world';
import { mountNotices } from './notices';

function setup() {
  const root = document.createElement('div');
  const world = createWorld(2);
  world.tick = 1000;
  logEvent(world, { kind: 'outOfFood' }); // lo de antes de montar no sale
  const time = createTimeController();
  const onFocus = vi.fn();
  const notices = mountNotices(root, { world, time, onFocus });
  notices.update();
  const all = () => [...root.querySelectorAll('[data-testid="notice"]')] as HTMLElement[];
  return { root, world, time, onFocus, notices, all };
}

test('un suceso malo deja un aviso rojo con título y nombres, y pausa una vez', () => {
  const { world, time, notices, all } = setup();
  const s = world.survivors[0]!;
  logEvent(world, { kind: 'grief', survivorId: s.id });
  notices.update();
  expect(all()).toHaveLength(1);
  const n = all()[0]!;
  expect(n.classList.contains('bad')).toBe(true);
  expect(n.textContent).toContain('Malos recuerdos');
  expect(n.textContent).toContain(`${s.name} recuerda a los suyos`);
  expect(time.speed).toBe(0);
  time.setSpeed(2);
  notices.update();
  expect(time.speed).toBe(2);
});

test('uno bueno no pausa; lo que no es del narrador no deja aviso', () => {
  const { world, time, notices, all } = setup();
  logEvent(world, { kind: 'cache', survivorId: world.survivors[0]!.id, houseId: 2, cans: 4 });
  logEvent(world, { kind: 'houseEmptied', houseId: 1 });
  notices.update();
  expect(all()).toHaveLength(1);
  expect(all()[0]!.classList.contains('good')).toBe(true);
  expect(time.speed).toBe(1);
});

test('provisiones en la puerta y un buen día dejan aviso verde con su texto (H6c)', () => {
  const { world, time, notices, all } = setup();
  logEvent(world, { kind: 'supplies', food: 3, bandage: 1 });
  logEvent(world, { kind: 'goodDay' });
  logEvent(world, { kind: 'supplies', food: 2, bandage: 0 });
  notices.update();
  expect(all()).toHaveLength(3);
  for (const n of all()) expect(n.classList.contains('good')).toBe(true);
  const text = all()
    .map((n) => n.textContent)
    .join(' | ');
  expect(text).toContain('Provisiones en la puerta');
  expect(text).toContain('Alguien ha dejado provisiones en la puerta: 3 latas y 1 venda');
  expect(text).toContain('Un buen día');
  expect(text).toContain('Hace un buen día: todos están de mejor ánimo');
  expect(text).toContain('puerta: 2 latas');
  expect(text).not.toContain('2 latas y');
  expect(time.speed).toBe(1);
});

test('pulsar el aviso enfoca al colono; la ✕ lo cierra', () => {
  const { root, world, onFocus, notices, all } = setup();
  const s = world.survivors[1]!;
  logEvent(world, { kind: 'grief', survivorId: s.id });
  notices.update();
  all()[0]!.click();
  expect(onFocus).toHaveBeenCalledWith(s.id);
  (root.querySelector('[data-testid="notice-close"]') as HTMLElement).click();
  notices.update();
  expect(all()).toHaveLength(0);
  expect(onFocus).toHaveBeenCalledTimes(1);
});

test('desaparecen al cabo de un día y como mucho hay 5', () => {
  const { world, notices, all } = setup();
  for (let i = 0; i < 7; i++) logEvent(world, { kind: 'storm' });
  notices.update();
  expect(all()).toHaveLength(5);
  world.tick += TICKS_PER_DAY;
  notices.update();
  expect(all()).toHaveLength(0);
});

test('una decisión: aviso con sus botones (la fiebre, tres), pausa, sin ✕, y se oculta al contestar', () => {
  const { root, world, time, notices } = setup();
  const s = world.survivors[0]!;
  world.storage.items.antibiotics = 0; // sin ninguno (se empieza con START_ANTIBIOTICS, H6d)
  const d = addDecision(world, 'fever', [s.id]);
  notices.update();
  const el = root.querySelector('[data-testid="decision-fever"]') as HTMLElement;
  expect(el.hidden).toBe(false);
  expect(el.textContent).toContain(`${s.name} tiene fiebre. ¿Qué hacéis?`);
  expect(el.querySelector('[data-testid="notice-close"]')).toBeNull();
  expect(time.speed).toBe(0);
  const buttons = [...el.querySelectorAll('button')].map((b) => b.textContent);
  expect(buttons).toEqual([
    'Que descanse',
    'Que se vaya',
    'Acabar con su sufrimiento',
    'Antibióticos y que descanse (quedan 0)', // H6a: sin ninguno, apagado
  ]);
  expect(
    (el.querySelector('[data-testid="decision-option-3"]') as HTMLButtonElement).disabled,
  ).toBe(true);
  const rest = el.querySelector('[data-testid="decision-option-0"]') as HTMLButtonElement;
  rest.click();
  expect(world.orders).toContainEqual({ type: 'decide', decisionId: d.id, option: 0 });
  notices.update();
  expect(el.hidden).toBe(true);
});

test('cumpleaños sin 2 latas: el botón de celebrarlo está desactivado', () => {
  const { root, world, notices } = setup();
  world.storage.items.food = 1;
  addDecision(world, 'birthday', [world.survivors[0]!.id]);
  notices.update();
  const [party] = [...root.querySelectorAll('[data-testid="decision-birthday"] button')];
  expect((party as HTMLButtonElement).disabled).toBe(true);
  world.storage.items.food = 5;
  notices.update();
  expect((party as HTMLButtonElement).disabled).toBe(false);
});

test('desconocidos: nombres, rasgos y lo que llevan; Aceptar da la orden', () => {
  const { root, world, notices } = setup();
  world.tick = 3 * TICKS_PER_DAY;
  world.rng = { s: 1 };
  strangersEvent.happen(world);
  const s = world.stranger!.survivors[0]!;
  s.traits = ['glutton'];
  s.carrying = {
    food: 2,
    bandage: 1,
    knife: 0,
    bat: 0,
    axe: 0,
    wood: 0,
    cloth: 0,
    curtains: 0,
    thread: 0,
    needle: 0,
    crowbar: 0,
    machete: 0,
    painkillers: 0,
    antibiotics: 0,
    denim: 0,
    leather: 0,
    bucket: 0,
    waterBucket: 0,
    waterBottle: 0,
    hatchet: 0,
    roadMap: 0,
    note: 0,
    seeds: 0,
    veg: 0,
    meal: 0,
    pieces: [],
  };
  notices.update();
  const el = root.querySelector('[data-testid="decision-stranger"]') as HTMLElement;
  expect(el.textContent).toContain(s.name);
  expect(el.textContent).toContain('Glotón');
  expect(el.textContent).toContain('2 latas y 1 venda');
  const accept = el.querySelector('[data-testid="decision-option-0"]') as HTMLElement;
  expect(accept.textContent).toBe('Aceptar');
  accept.click();
  expect(world.orders).toContainEqual({
    type: 'decide',
    decisionId: world.decisions[0]!.id,
    option: 0,
  });
});

test('las decisiones resueltas desaparecen', () => {
  const { root, world, notices } = setup();
  addDecision(world, 'fever', [world.survivors[0]!.id]);
  notices.update();
  world.decisions = [];
  notices.update();
  expect(root.querySelector('[data-testid="decision-fever"]')).toBeNull();
});

test('lo que se aplica al dejar pasar una decisión también se avisa, en amarillo y sin pausa', () => {
  const { world, time, notices, all } = setup();
  const s = world.survivors[0]!;
  logEvent(world, { kind: 'theftIgnored', suspectId: s.id });
  logEvent(world, { kind: 'birthdaySkipped', survivorId: s.id });
  notices.update();
  expect(all()).toHaveLength(2);
  for (const n of all()) expect(n.classList.contains('mixed')).toBe(true);
  expect(time.speed).toBe(1);
});

test('zombis (H4b): derribado y zombis en la base, avisos rojos que pausan; lo demás, sin pausar', () => {
  const { world, time, notices, all, onFocus } = setup();
  const onFocusAt = vi.fn();
  const root2 = document.createElement('div');
  const n2 = mountNotices(root2, { world, time, onFocus, onFocusAt });
  n2.update();
  const s = world.survivors[0]!;
  time.setSpeed(1);
  logEvent(world, { kind: 'zombieSighted', x: 3, y: 4 });
  logEvent(world, { kind: 'broken', what: 'door', x: 1, y: 2, inBase: true });
  logEvent(world, { kind: 'broken', what: 'window', x: 9, y: 9, inBase: false }); // fuera: sin aviso
  logEvent(world, { kind: 'fled', survivorId: s.id });
  notices.update();
  expect(all()).toHaveLength(3);
  expect(all().every((n) => n.classList.contains('mixed'))).toBe(true);
  expect(time.speed).toBe(1);
  logEvent(world, { kind: 'downed', survivorId: s.id });
  notices.update();
  expect(all()[0]!.classList.contains('bad')).toBe(true);
  expect(time.speed).toBe(0);
  time.setSpeed(1);
  logEvent(world, { kind: 'zombiesInBase', x: 5, y: 6 });
  n2.update();
  const box = [...root2.querySelectorAll('[data-testid="notice"]')] as HTMLElement[];
  const inBase = box.find((n) => n.textContent?.includes('dentro de la base'))!;
  expect(inBase.classList.contains('bad')).toBe(true);
  expect(time.speed).toBe(0);
  inBase.click();
  expect(onFocusAt).toHaveBeenCalledWith({ x: 5, y: 6 }, 0); // en la base (H5c1)
});

test('menú de Avisos (H4e): lo que no aparece no sale; lo que pausa o no, según lo elegido', () => {
  const root = document.createElement('div');
  const world = createWorld(2);
  world.tick = 1000;
  const time = createTimeController();
  time.setSpeed(1);
  let prefs: import('./noticePrefs').NoticePrefs = {
    grief: { show: false },
    storm: { pause: false },
    zombieSighted: { pause: true },
    'decision:stranger': { pause: false },
  };
  const notices = mountNotices(root, { world, time, prefs: { get: () => prefs } });
  const all = () => [...root.querySelectorAll('[data-testid="notice"]')] as HTMLElement[];
  const s = world.survivors[0]!;
  logEvent(world, { kind: 'grief', survivorId: s.id });
  logEvent(world, { kind: 'storm' });
  notices.update();
  expect(all()).toHaveLength(1); // solo la tormenta
  expect(time.speed).toBe(1); // y no pausa
  logEvent(world, { kind: 'zombieSighted', x: 1, y: 1 });
  notices.update();
  expect(time.speed).toBe(0);
  time.setSpeed(1);
  strangersEvent.happen(world);
  notices.update();
  expect(root.querySelector('[data-testid="decision-stranger"]')).not.toBeNull();
  expect(time.speed).toBe(1);
  prefs = {};
  void prefs;
});

test('S1: cada aviso que aparece suena con su tono y su tipo; los ocultos, no', () => {
  const root = document.createElement('div');
  const world = createWorld(2);
  world.tick = 1000;
  const onNotice = vi.fn();
  const notices = mountNotices(root, {
    world,
    time: createTimeController(),
    prefs: { get: () => ({ grief: { show: false } }) },
    onNotice,
  });
  notices.update();
  logEvent(world, { kind: 'died', name: 'Ana', cause: 'blood' });
  logEvent(world, { kind: 'grief', survivorId: world.survivors[0]!.id }); // oculto
  notices.update();
  expect(onNotice.mock.calls).toEqual([['bad', 'died']]);
  addDecision(world, 'theft', [world.survivors[0]!.id]);
  notices.update();
  expect(onNotice).toHaveBeenLastCalledWith('bad', 'decision:theft');
});
