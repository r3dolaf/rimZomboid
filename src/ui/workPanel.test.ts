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
    root.querySelector(`[data-testid="work-${id}-${k}"]`) as HTMLButtonElement;
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
    'Sanar', // H4e
    'Social',
    'Construir',
    'Fabricar',
    'Transportar',
    'Talar',
    'Saquear',
    'Pelear', // H4c: la columna de la postura es la de Pelear
    'Atuendo', // H5b
  ]);
  // Cada celda, la prioridad (H4d): "—" sin permiso o el número.
  for (const s of world.survivors)
    expect(cell(s.id, 'loot').textContent).toBe(s.work.loot ? String(s.priorities.loot) : '—');
});

test('cada celda pasa por — → 1 → 2 → 3 → 4 → — con sus órdenes, y se ve al momento aunque esté en pausa', () => {
  const { world, open, panel, cell } = setup();
  const s = world.survivors[0]!;
  s.work.haul = false;
  open.set(true);
  panel.update();
  const c = cell(s.id, 'haul');
  expect(c.textContent).toBe('—');
  expect(c.classList.contains('off')).toBe(true);
  c.click();
  expect(world.orders).toEqual([
    { type: 'setWork', survivorId: s.id, work: 'haul', enabled: true },
    { type: 'setPriority', survivorId: s.id, work: 'haul', priority: 1 },
  ]);
  panel.update();
  expect(c.textContent).toBe('1');
  expect(c.classList.contains('off')).toBe(false);
  const seen = ['1'];
  for (let i = 0; i < 5; i++) {
    c.click();
    panel.update();
    seen.push(c.textContent!);
  }
  expect(seen).toEqual(['1', '2', '3', '4', '—', '1']);
  expect(world.orders).toContainEqual({
    type: 'setWork',
    survivorId: s.id,
    work: 'haul',
    enabled: false,
  });
  expect(c.title.split('\n')).toEqual([
    `${s.name}: Transportar, prioridad 1`,
    'Clic: — (no lo hace) → 1 (lo primero) → 2 → 3 → 4 → —',
  ]);
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
