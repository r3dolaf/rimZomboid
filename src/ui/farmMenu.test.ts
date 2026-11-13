// @vitest-environment jsdom
// V4 §2.2: el selector de la herramienta Huerto: qué cultivo se marca, con sus semillas y su pista.
import { expect, test } from 'vitest';
import { es } from '../i18n/es';
import { createWorld } from '../sim/world';
import { mountFarmMenu } from './farmMenu';
import { createTool } from './tool';

function setup() {
  const root = document.createElement('div');
  const world = createWorld(5);
  const tool = createTool();
  const menu = mountFarmMenu(root, { tool, world });
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  return { root, world, tool, menu, q };
}

test('solo se ve con la herramienta Huerto; empieza en Patata', () => {
  const { tool, menu, q } = setup();
  expect(tool.cropKind).toBe('potato');
  menu.update();
  expect(q('farm-menu').hidden).toBe(true);
  tool.set('farm');
  menu.update();
  expect(q('farm-menu').hidden).toBe(false);
  expect(q('farm-potato').classList.contains('selected')).toBe(true);
  tool.set('build');
  menu.update();
  expect(q('farm-menu').hidden).toBe(true);
});

test('cada cultivo con su dibujo, su nombre y las semillas que hay; tocarlo lo elige y da su pista', () => {
  const { world, tool, menu, q } = setup();
  world.storage.items.seedsCabbage = 2;
  world.storage.items.seedsTomato = 0;
  tool.set('farm');
  menu.update();
  for (const k of ['lettuce', 'tomato', 'potato', 'cabbage'])
    expect(q(`farm-${k}`).querySelector('svg'), k).not.toBeNull();
  expect(q('farm-cabbage').textContent).toBe('Col · 2');
  expect(q('farm-tomato').textContent).toBe('Tomate · 0');
  expect(q('farm-tomato').classList.contains('short')).toBe(true);
  q('farm-cabbage').click();
  menu.update();
  expect(tool.cropKind).toBe('cabbage');
  expect(q('farm-cabbage').classList.contains('selected')).toBe(true);
  expect(q('farm-desc').textContent).toBe(es.seedHints.cabbage);
});

test('las pistas no dicen cifras ni estaciones', () => {
  for (const hint of Object.values(es.seedHints)) {
    expect(hint).not.toMatch(/\d/);
    expect(hint).not.toMatch(/primavera|verano|otoño|invierno/i);
  }
});
