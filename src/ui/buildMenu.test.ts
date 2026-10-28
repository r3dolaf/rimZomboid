// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { mountBuildMenu } from './buildMenu';
import { createTool } from './tool';

test('el menú Construir solo se ve con la herramienta y elige qué construir', () => {
  const root = document.createElement('div');
  const tool = createTool();
  const menu = mountBuildMenu(root, { tool });
  const el = root.querySelector('[data-testid="build-menu"]') as HTMLElement;
  menu.update();
  expect(el.hidden).toBe(true);
  tool.toggle('build');
  menu.update();
  expect(el.hidden).toBe(false);
  const options = [...el.querySelectorAll('button')];
  expect(options.map((b) => b.textContent)).toEqual([
    'Cama · 6',
    'Mesa · 4',
    'Hoguera · 3',
    'Barreño · 4', // H5b
    'Muro · 2',
    'Puerta · 4',
    'Tapiar · 3',
    'Quitar tablas · 0',
    'Reparar · 1–3',
    // H4d: sin madera, solo el nombre.
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
