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
    'Cama — 6 tablas (tienes 7)',
    'Mesa — 4 tablas (tienes 7)',
    'Hoguera — 3 tablas (tienes 7)',
    'Barreño — 4 tablas (tienes 7)', // H5b
    'Muro — 2 tablas (tienes 7)',
    'Puerta — 4 tablas (tienes 7)',
    'Reparar — 1–3 tablas (tienes 7)',
    'Tapiar — 3 tablas (tienes 7)',
    // Sin madera (H4d): solo el nombre.
    'Quitar tablas',
    'Cortinas',
    'Descolgar cortinas',
    'Romper ventana',
  ]);
  (root.querySelector('[data-testid="build-bed"]') as HTMLButtonElement).click();
  expect(tool.buildKind).toBe('bed');
  menu.update();
  expect(root.querySelector('[data-testid="build-bed"]')!.classList.contains('selected')).toBe(
    true,
  );
});
