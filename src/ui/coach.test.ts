// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import { createTimeController } from '../game/timeController';
import { createWorld } from '../sim/world';
import { mountCoach, createGuideStore } from './coach';
import { createFlag } from './flag';
import { createSelection } from './selection';
import { createTool } from './tool';

beforeEach(() => localStorage.clear());

function setup(extra: { zombies?: number; touch?: boolean } = {}) {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const world = createWorld(5);
  world.storage.items.wood = 0;
  world.storage.items.food = 20;
  world.furniture = world.furniture.filter((f) => f.kind !== 'table');
  const time = createTimeController();
  const tool = createTool();
  const selection = createSelection();
  const workOpen = createFlag();
  let clock = 0;
  const coach = mountCoach(root, {
    world,
    time,
    tool,
    selection,
    workOpen,
    touch: () => extra.touch ?? false,
    zombiesSeen: () => extra.zombies ?? 0,
    now: () => clock,
  });
  const card = () => root.querySelector('[data-testid="coach"]') as HTMLElement;
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) coach.update();
  };
  return {
    root,
    world,
    time,
    tool,
    selection,
    workOpen,
    coach,
    card,
    q,
    tick,
    advance: (ms: number) => (clock += ms),
  };
}

test('U1 §9: al empezar, el primer paso; al hacerlo, el siguiente', () => {
  const { card, q, tick, selection, world } = setup();
  tick();
  expect(card().hidden).toBe(false);
  expect(q('coach-step-people')).not.toBeNull();
  expect(card().textContent).toContain('Paso 1 de 7');
  expect(card().textContent).toContain('Haz clic en una tarjeta');
  selection.set(world.survivors[0]!.id);
  tick(16);
  expect(q('coach-step-loot')).not.toBeNull();
  expect(card().textContent).toContain('Paso 2 de 7');
});

test('U1 §9: con el dedo, «toca» y «mantén pulsada»', () => {
  const { card, tick } = setup({ touch: true });
  tick();
  expect(card().textContent).toContain('Toca una tarjeta');
});

test('U1 §9: con una herramienta no se ve (está su letrero)', () => {
  const { card, tick, tool } = setup();
  tick();
  tool.toggle('loot');
  tick();
  expect(card().hidden).toBe(true);
  tool.set(null);
  tick();
  expect(card().hidden).toBe(false);
});

test('U1 §9: se pliega a una línea, se oculta y lo hecho se recuerda en el navegador', () => {
  const { card, q, tick, selection, world } = setup();
  selection.set(world.survivors[0]!.id);
  tick();
  q('coach-fold').click();
  expect(card().classList.contains('folded')).toBe(true);
  expect(q('coach-unfold').textContent).toBe('📋 Primeros pasos · 2/7');
  q('coach-unfold').click();
  expect(q('coach-step-loot')).not.toBeNull();
  q('coach-hide').click();
  expect(card().hidden).toBe(true);
  const saved = JSON.parse(localStorage.getItem('rimzomboid.guide')!);
  expect(saved.done).toEqual(['people']);
  expect(saved.hidden).toBe(true);
  // Otra partida: sigue oculto.
  const again = setup();
  again.tick();
  expect(again.card().hidden).toBe(true);
  // Desde la Ayuda, otra vez desde el principio.
  again.coach.restart();
  again.tick();
  expect(again.q('coach-step-people')).not.toBeNull();
});

test('U1 §9: los pasos de x2 y de Trabajos', () => {
  const { tick, time, workOpen } = setup();
  time.setSpeed(2);
  workOpen.set(true);
  tick(16);
  const done = JSON.parse(localStorage.getItem('rimzomboid.guide')!).done;
  expect(done).toEqual(expect.arrayContaining(['time', 'work']));
});

test('U1 §9: al acabar, «¡Ya sabes lo básico!», que se va solo o con Cerrar', () => {
  const store = createGuideStore();
  store.set({
    ...store.get(),
    done: ['people', 'loot', 'wood', 'windows', 'time', 'work', 'table'],
  });
  const { card, tick, advance } = setup();
  tick();
  expect(card().textContent).toContain('¡Ya sabes lo básico!');
  advance(25_000);
  tick();
  expect(card().hidden).toBe(true);
  expect(JSON.parse(localStorage.getItem('rimzomboid.guide')!).finished).toBe(true);
});

test('U1 §9: un consejo sale antes que el paso, una sola vez; Entendido lo quita', () => {
  const { card, q, tick } = setup({ zombies: 3 });
  tick();
  expect(card().dataset.tip).toBe('zombies');
  expect(card().textContent).toContain('Zombis a la vista');
  expect(card().textContent).toContain('clic derecho');
  q('coach-ok').click();
  tick(16);
  expect(card().dataset.tip).toBeUndefined();
  expect(q('coach-step-people')).not.toBeNull();
  // Otra partida: ya no sale.
  const again = setup({ zombies: 3 });
  again.tick();
  expect(again.card().dataset.tip).toBeUndefined();
});

test('U1 §9: el consejo de la pausa sale si un aviso la ha puesto (no si ya estaba en pausa)', () => {
  const { card, tick, coach, time } = setup();
  tick();
  time.setSpeed(0);
  coach.noticed(); // ya estaba en pausa: no cuenta
  tick();
  expect(card().dataset.tip).toBeUndefined();
  time.setSpeed(1);
  coach.noticed();
  time.setSpeed(0); // lo pausa el aviso
  tick();
  expect(card().dataset.tip).toBe('pause');
});

test('U1 §9: sin consejos (casilla de la Ayuda), no salen', () => {
  const { card, tick, coach } = setup({ zombies: 3 });
  coach.tips.set(false);
  tick();
  expect(card().dataset.tip).toBeUndefined();
  expect(coach.tips.get()).toBe(false);
});
