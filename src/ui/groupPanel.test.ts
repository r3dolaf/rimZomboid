// @vitest-environment jsdom
// H4e §3.2: con varios elegidos, la lista de nombres y el botón Combate.
import { expect, test } from 'vitest';
import { hurtSurvivor } from '../sim/health';
import { createWorld } from '../sim/world';
import { mountGroupPanel } from './groupPanel';
import { createSelection } from './selection';

function setup() {
  const root = document.createElement('div');
  const world = createWorld(5);
  const selection = createSelection();
  const panel = mountGroupPanel(root, { world, selection });
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  return { root, world, selection, panel, q };
}

test('solo con dos o más elegidos: sus nombres, en orden', () => {
  const { world, selection, panel, q } = setup();
  const [a, b, c] = world.survivors;
  panel.update();
  expect(q('group-panel').hidden).toBe(true);
  selection.set(a!.id);
  panel.update();
  expect(q('group-panel').hidden).toBe(true);
  selection.setMany([c!.id, a!.id]);
  panel.update();
  expect(q('group-panel').hidden).toBe(false);
  const names = [...q('group-panel').querySelectorAll('[data-testid^="group-name-"]')].map(
    (e) => e.textContent,
  );
  expect(names).toEqual([c!.name, a!.name]);
  q(`group-name-${a!.id}`).click();
  expect(selection.ids).toEqual([a!.id]);
  void b;
});

test('Combate: pone o quita el modo combate a todos (orden), y se ve encendido', () => {
  const { world, selection, panel, q } = setup();
  const [a, b] = world.survivors;
  selection.setMany([a!.id, b!.id]);
  panel.update();
  q('group-draft').click();
  expect(world.orders).toEqual([{ type: 'draft', survivorIds: [a!.id, b!.id], on: true }]);
  panel.update();
  expect(q('group-draft').classList.contains('active')).toBe(true); // en pausa, al momento
  hurtSurvivor(world, b!, 200);
  world.orders = [];
  a!.drafted = true;
  panel.update();
  expect(q('group-draft').classList.contains('active')).toBe(true);
  expect(q('group-panel').textContent).toContain('🤕'); // el derribado, marcado
});

test('✕ deja sin nadie elegido', () => {
  const { world, selection, panel, q } = setup();
  selection.setMany(world.survivors.map((s) => s.id));
  panel.update();
  q('group-close').click();
  expect(selection.ids).toEqual([]);
});
