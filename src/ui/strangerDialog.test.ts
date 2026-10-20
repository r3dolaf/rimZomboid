// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { createTimeController } from '../game/timeController';
import { strangersEvent } from '../sim/events/strangers';
import { createWorld } from '../sim/world';
import { mountStrangerDialog } from './strangerDialog';

function setup() {
  const root = document.createElement('div');
  const world = createWorld(2);
  const time = createTimeController();
  const dialog = mountStrangerDialog(root, { world, time });
  const el = () => root.querySelector('[data-testid="stranger"]') as HTMLElement;
  const arrive = () => {
    world.tick = 3 * 7200;
    world.rng = { s: 1 }; // con esta semilla llega uno solo
    strangersEvent.happen(world);
    world.stranger!.survivors[0]!.traits = ['glutton'];
    world.stranger!.survivors[0]!.carrying = { food: 2, bandage: 1, knife: 0, bat: 0 };
  };
  return { root, world, time, dialog, el, arrive };
}

test('oculto sin desconocido; al llegar muestra nombre, rasgos y lo que lleva, y pausa', () => {
  const { world, time, dialog, el, arrive } = setup();
  dialog.update();
  expect(el().hidden).toBe(true);
  arrive();
  dialog.update();
  expect(el().hidden).toBe(false);
  const text = el().textContent!;
  expect(text).toContain(world.stranger!.survivors[0]!.name);
  expect(text).toContain('Glotón');
  expect(text).toContain('2 latas y 1 venda');
  expect(time.speed).toBe(0);
  // Si el jugador reanuda sin contestar, no vuelve a pausar.
  time.setSpeed(2);
  dialog.update();
  expect(time.speed).toBe(2);
});

test('Aceptar da la orden y el aviso se oculta enseguida, aunque esté en pausa', () => {
  const { root, world, dialog, el, arrive } = setup();
  arrive();
  dialog.update();
  const accept = root.querySelector('[data-testid="stranger-accept"]') as HTMLElement;
  accept.click();
  expect(world.orders).toContainEqual({
    type: 'decide',
    decisionId: world.decisions[0]!.id,
    option: 0,
  });
  dialog.update();
  expect(el().hidden).toBe(true);
});

test('Rechazar da la orden; los botones no se rehacen', () => {
  const { root, world, dialog, arrive } = setup();
  arrive();
  dialog.update();
  const reject = root.querySelector('[data-testid="stranger-reject"]');
  world.stranger!.survivors[0]!.needs.hunger = 3;
  dialog.update();
  expect(root.querySelector('[data-testid="stranger-reject"]')).toBe(reject);
  (reject as HTMLElement).click();
  expect(world.orders).toContainEqual({
    type: 'decide',
    decisionId: world.decisions[0]!.id,
    option: 1,
  });
});

test('si se marcha (por esperar demasiado), el aviso se oculta', () => {
  const { world, dialog, el, arrive } = setup();
  arrive();
  dialog.update();
  world.stranger!.leaving = true;
  dialog.update();
  expect(el().hidden).toBe(true);
});
