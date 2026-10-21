// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { createWorld } from '../sim/world';
import { createFlag } from './flag';
import { mountWorkPanel } from './workPanel';

function setup() {
  const root = document.createElement('div');
  document.body.replaceChildren(root); // las casillas solo avisan del cambio si están en el documento
  const world = createWorld(5);
  const open = createFlag();
  const panel = mountWorkPanel(root, { world, open });
  const el = root.querySelector('[data-testid="work-panel"]') as HTMLElement;
  const cell = (id: number, k: string) =>
    root.querySelector(`[data-testid="work-${id}-${k}"]`) as HTMLInputElement;
  return { root, world, open, panel, el, cell };
}

test('oculto hasta que se abre; una fila por colono y una columna por trabajo, en orden', () => {
  const { world, open, panel, el, cell } = setup();
  panel.update();
  expect(el.hidden).toBe(true);
  open.set(true);
  panel.update();
  expect(el.hidden).toBe(false);
  expect([...el.querySelectorAll('th')].map((t) => t.textContent)).toEqual([
    '',
    'Social',
    'Construir',
    'Transportar',
    'Talar',
    'Saquear',
    'Postura',
  ]);
  for (const s of world.survivors) expect(cell(s.id, 'loot').checked).toBe(s.work.loot);
});

test('cada casilla da su orden y se ve marcada al momento, aunque esté en pausa', () => {
  const { world, open, panel, cell } = setup();
  open.set(true);
  panel.update();
  const s = world.survivors[0]!;
  const was = s.work.haul;
  cell(s.id, 'haul').click();
  expect(world.orders).toContainEqual({
    type: 'setWork',
    survivorId: s.id,
    work: 'haul',
    enabled: !was,
  });
  panel.update();
  expect(cell(s.id, 'haul').checked).toBe(!was);
});

test('las filas siguen a quien está en la colonia; la ✕ lo cierra', () => {
  const { root, world, open, panel, el, cell } = setup();
  open.set(true);
  panel.update();
  world.survivors.push({ ...structuredClone(world.survivors[0]!), id: 60, name: 'Zoe' });
  panel.update();
  expect(cell(60, 'social')).not.toBeNull();
  expect(el.textContent).toContain('Zoe');
  (root.querySelector('[data-testid="work-close"]') as HTMLButtonElement).click();
  expect(open.value).toBe(false);
});
