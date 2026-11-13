// @vitest-environment jsdom
// H5c1 §8: Construir y Fabricar más claros: por grupos, con lo que gasta y lo que tienes, «usa →
// da · dónde · tiempo», por qué no se puede ahora y los modos de los pedidos dichos claro.
import { expect, test } from 'vitest';
import { newGarment } from '../sim/clothes';
import { createWorld } from '../sim/world';
import { mountBuildMenu } from './buildMenu';
import { mountCraftPanel } from './craftPanel';
import { createFlag } from './flag';
import { createTool } from './tool';

function craft() {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const world = createWorld(5);
  world.furniture = world.furniture.filter((f) => f.kind !== 'table' && f.kind !== 'tub');
  world.storage.items = {
    ...world.storage.items,
    cloth: 0,
    thread: 0,
    needle: 0,
    knife: 0,
    curtains: 0,
  };
  world.storage.items.pieces = [];
  for (const s of world.survivors) {
    s.carrying.knife = 0;
    s.equipped = null;
  }
  const open = createFlag();
  open.set(true);
  const panel = mountCraftPanel(root, { world, open });
  panel.update();
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  return { root, world, panel, q };
}

test('Construir por grupos: cada botón con lo que gasta y lo que tienes; abajo, qué hace', () => {
  const root = document.createElement('div');
  const world = createWorld(5);
  world.storage.items.wood = 12;
  const tool = createTool();
  const menu = mountBuildMenu(root, { tool, world });
  tool.toggle('build');
  menu.update();
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  const groups = [...root.querySelectorAll('.build-group h3')].map((h) => h.textContent);
  expect(groups.slice(0, 3)).toEqual(['Muebles', 'Muros y puertas', 'Arreglar']);
  const inGroup = (i: number) =>
    [...root.querySelectorAll('.build-group')[i]!.querySelectorAll('button')].map(
      (b) => b.dataset.testid,
    );
  expect(inGroup(0)).toEqual([
    'build-bed',
    'build-table',
    'build-campfire',
    'build-tub',
    'build-barrel', // V2
    'build-radio', // C1
    'build-generator', // E1
  ]);
  expect(inGroup(1)).toEqual(['build-woodWall', 'build-woodDoor']);
  expect(inGroup(2)).toEqual(['build-repair']);
  expect(q('build-bed').textContent).toBe('Cama · 6 🪵');
  expect(q('build-repair').textContent).toBe('Reparar · 1–3 🪵');
  expect(q('build-desc').textContent).toContain('muro'); // lo elegido al empezar: Muro
  q('build-bed').click();
  menu.update();
  expect(q('build-desc').textContent).toContain('se duerme mejor');
  world.storage.items.wood = 3;
  menu.update();
  expect(q('build-have').textContent).toBe('Tienes 3 🪵');
  expect(q('build-bed').classList.contains('short')).toBe(true);
});

test('Fabricar por grupos: cada receta dice «usa → da · dónde · tiempo»', () => {
  const { root, q } = craft();
  const groups = [...root.querySelectorAll('.craft-group h3')].map((h) => h.textContent);
  expect(groups).toEqual(['Curar', 'Cocina', 'Tela y cortinas', 'Ropa', 'Bolsas']);
  expect(q('craft-line-cook').textContent).toBe(
    '2 hortalizas cualesquiera → 1 guiso de verduras · hoguera · 30 min',
  ); // V1 y V4
  expect(q('craft-line-cookPotato').textContent).toBe(
    '2 patatas y 1 hortaliza cualquiera → 1 guiso de patatas · hoguera · 45 min',
  );
  expect(q('craft-line-soup').textContent).toBe(
    '1 col y agua (1 botella o 1 cubo) → 1 sopa de col · hoguera · 30 min',
  );
  expect(q('craft-line-salad').textContent).toBe(
    '1 lechuga y 1 tomate → 1 ensalada · mesa · 10 min',
  );
  expect(q('craft-line-preserve').textContent).toBe(
    '3 tomates → 1 conserva de tomate · hoguera · 1 h',
  );
  expect(q('craft-add-curtains').textContent).toBe('+ Coser cortinas');
  expect(q('craft-line-bandages').textContent).toBe('1 tela → 2 vendas · mesa · 15 min');
  expect(q('craft-line-curtains').textContent).toBe(
    '3 telas y 2 usos de hilo, con aguja → 1 juego de cortinas · mesa · 1 h',
  );
  expect(q('craft-line-unpick').textContent).toBe(
    '1 juego de cortinas, con cuchillo → 3 telas · mesa · 15 min',
  );
  expect(q('craft-line-mend').textContent).toBe(
    'una prenda con agujeros, 1 uso de hilo y 1 tela, retal o tira, con aguja → la prenda remendada · mesa · 30 min',
  );
  expect(q('craft-line-wash').textContent).toBe(
    'una prenda sucia o con sangre y 2 litros de agua → la prenda limpia · barreño · 15 min',
  );
  expect(q('craft-line-sewBag').textContent).toBe(
    '4 telas y 2 usos de hilo, con aguja → 1 bolsa de tela · mesa · 1 h',
  );
});

test('V1: para cocinar hace falta una hoguera, y lo dice arriba', () => {
  const { world, panel, q } = craft();
  expect(q('craft-no-fire').hidden).toBe(true); // sin pedidos de cocina, no
  world.bills = [{ id: 1, recipe: 'cook', mode: 'count', target: 1, done: 0 }];
  panel.update();
  expect(q('craft-no-fire').hidden).toBe(false);
  world.furniture.push({ id: 99, kind: 'campfire', pos: { x: 1, y: 1 } });
  panel.update();
  expect(q('craft-no-fire').hidden).toBe(true);
});

test('si ahora no se puede, dice por qué', () => {
  const { world, panel, q } = craft();
  // Sin mesa lo dice arriba (y no en cada receta); con un pedido que no la usa, en la receta.
  expect(q('craft-no-table').hidden).toBe(false);
  expect(q('craft-why-bandages').hidden).toBe(true);
  world.bills = [{ id: 1, recipe: 'wash', mode: 'always', target: 1, done: 0 }];
  panel.update();
  expect(q('craft-no-table').hidden).toBe(true);
  expect(q('craft-why-bandages').textContent).toBe('Hace falta una mesa');
  world.bills = [];
  world.furniture.push({ id: 900, kind: 'table', pos: { x: 1, y: 1 } });
  panel.update();
  expect(q('craft-why-bandages').textContent).toBe('Falta 1 tela');
  world.storage.items.cloth = 1;
  panel.update();
  expect(q('craft-why-bandages').hidden).toBe(true); // se puede
  world.storage.items.cloth = 3;
  world.storage.items.thread = 2;
  panel.update();
  expect(q('craft-why-curtains').textContent).toBe('Falta una aguja');
  expect(q('craft-why-unpick').textContent).toBe('Falta un cuchillo');
  world.survivors[0]!.equipped = 'knife'; // el cuchillo vale también en la mano
  world.storage.items.needle = 1;
  panel.update();
  expect(q('craft-why-unpick').textContent).toBe('Falta 1 juego de cortinas');
  expect(q('craft-why-mend').textContent).toBe('No hay ropa con agujeros en el almacén');
  const g = newGarment(world, 'tshirt');
  g.holes = ['torso'];
  world.storage.items.pieces.push(g);
  panel.update();
  expect(q('craft-why-mend').hidden).toBe(true);
  expect(q('craft-why-wash').textContent).toBe('Hace falta un barreño'); // arriba no lo dice
  world.furniture.push({ id: 901, kind: 'tub', pos: { x: 2, y: 1 }, water: 0 });
  panel.update();
  expect(q('craft-why-wash').textContent).toBe('Hace falta un barreño con agua');
});

test('los pedidos dicen su modo: «Hacer 5 veces», «Hasta tener 10 vendas», «Siempre que haya»', () => {
  const { world, panel, q } = craft();
  world.bills = [
    { id: 1, recipe: 'bandages', mode: 'count', target: 5, done: 2 },
    { id: 2, recipe: 'bandages', mode: 'until', target: 10, done: 0 },
    { id: 3, recipe: 'sewBag', mode: 'until', target: 2, done: 0 },
    { id: 4, recipe: 'mend', mode: 'always', target: 1, done: 0 },
  ];
  panel.update();
  const mode = (id: number) => {
    const s = q(`bill-${id}-mode`) as HTMLSelectElement;
    return s.options[s.selectedIndex]!.textContent;
  };
  expect(mode(1)).toBe('Hacer 5 veces');
  expect(mode(2)).toBe('Hasta tener 10 vendas');
  expect(mode(3)).toBe('Hasta tener 2 bolsas de tela');
  expect(mode(4)).toBe('Siempre que haya');
  expect(q('bill-1-done').textContent).toBe('hechos 2/5');
});

test('V4: en la cocina dice qué falta: hortalizas cualesquiera (sin contar las fijas) y agua', () => {
  const { world, panel, q } = craft();
  world.furniture.push({ id: 99, kind: 'campfire', pos: { x: 1, y: 1 } });
  world.storage.items.potato = 2;
  world.storage.items.cabbage = 0;
  world.storage.items.waterBottle = 0;
  world.storage.items.waterBucket = 0;
  panel.update();
  expect(q('craft-why-cookPotato').textContent).toBe('Falta 1 hortaliza');
  expect(q('craft-why-cook').hidden).toBe(true); // 2 patatas valen para el de verduras
  world.storage.items.cabbage = 1;
  panel.update();
  expect(q('craft-why-cookPotato').hidden).toBe(true);
  expect(q('craft-why-soup').textContent).toBe('Falta agua: una botella o un cubo con agua');
});
