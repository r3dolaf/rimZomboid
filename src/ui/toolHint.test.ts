// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { createTool } from './tool';
import { mountToolHint } from './toolHint';

const q = (root: HTMLElement, id: string) =>
  root.querySelector(`[data-testid="${id}"]`) as HTMLElement;

test('U1 §4: sin herramienta no se ve; con una, su icono y qué hacer', () => {
  const root = document.createElement('div');
  const tool = createTool();
  const hint = mountToolHint(root, { tool, touch: () => false });
  expect(q(root, 'tool-hint').hidden).toBe(true);
  expect(hint.visible).toBe(false);
  tool.toggle('loot');
  expect(hint.visible).toBe(true);
  expect(q(root, 'tool-hint').querySelector('.icon')!.textContent).toBe('🎒');
  expect(q(root, 'tool-hint').textContent).toContain('Haz clic en una casa');
  tool.toggle('chop');
  expect(q(root, 'tool-hint').textContent).toContain('un árbol');
  tool.toggle('build');
  expect(q(root, 'tool-hint').textContent).toContain('Elige qué construir');
});

test('U1 §4: con el dedo dice «toca»', () => {
  const root = document.createElement('div');
  const tool = createTool();
  mountToolHint(root, { tool, touch: () => true });
  tool.toggle('chop');
  expect(q(root, 'tool-hint').textContent).toContain('Toca un árbol');
});

test('U1 §4: «Hecho» quita la herramienta', () => {
  const root = document.createElement('div');
  const tool = createTool();
  mountToolHint(root, { tool, touch: () => true });
  tool.toggle('build');
  (q(root, 'tool-hint-done') as HTMLButtonElement).click();
  expect(tool.mode).toBeNull();
  expect(q(root, 'tool-hint').hidden).toBe(true);
});
