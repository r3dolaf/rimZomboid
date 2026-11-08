// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { emptyWorld } from '../sim/testing/fixtures';
import { mountBuildMenu } from './buildMenu';
import { createTool } from './tool';

test('el menú Construir solo se ve con la herramienta y elige qué construir', () => {
  const root = document.createElement('div');
  const tool = createTool();
  const world = emptyWorld(5, 5);
  world.storage.items.wood = 7;
  const menu = mountBuildMenu(root, { tool, world });
  const el = root.querySelector('[data-testid="build-menu"]') as HTMLElement;
  menu.update();
  expect(el.hidden).toBe(true);
  tool.toggle('build');
  menu.update();
  expect(el.hidden).toBe(false);
  const options = [...el.querySelectorAll('button')];
  expect(options.map((b) => b.textContent)).toEqual([
    'Cama · 6 🪵',
    'Mesa · 4 🪵',
    'Hoguera · 3 🪵',
    'Barreño · 4 🪵', // H5b
    'Muro · 2 🪵',
    'Puerta · 4 🪵',
    'Reparar · 1–3 🪵',
  ]);
  // U1 §1: lo que hay, una vez arriba; lo que no alcanza, más apagado.
  expect(root.querySelector('[data-testid="build-have"]')!.textContent).toBe('Tienes 7 🪵');
  const short = options.filter((b) => b.classList.contains('short')).map((b) => b.dataset.testid);
  expect(short).toEqual([]);
  world.storage.items.wood = 3;
  menu.update();
  expect(options.filter((b) => b.classList.contains('short')).map((b) => b.dataset.testid)).toEqual(
    ['build-bed', 'build-table', 'build-tub', 'build-woodDoor'],
  );
  expect(root.querySelector('[data-testid="build-bed"]')!.getAttribute('title')).toContain(
    'Falta madera',
  );
  (root.querySelector('[data-testid="build-bed"]') as HTMLButtonElement).click();
  expect(tool.buildKind).toBe('bed');
  menu.update();
  expect(root.querySelector('[data-testid="build-bed"]')!.classList.contains('selected')).toBe(
    true,
  );
});
