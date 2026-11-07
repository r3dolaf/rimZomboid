// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { createSoundPrefs, loadSound } from '../audio/prefs';
import { createFlag } from './flag';
import { mountGamePanel } from './gamePanel';

function memory() {
  const data: Record<string, string> = {};
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
  };
}

function setup() {
  const root = document.createElement('div');
  const store = memory();
  const sound = createSoundPrefs(store);
  const open = createFlag();
  const panel = mountGamePanel(root, {
    open,
    seed: 1,
    hasSave: () => false,
    onSave: () => true,
    onLoad: () => {},
    onExport: () => {},
    onImport: () => {},
    sound,
  });
  open.set(true);
  panel.update();
  const get = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
  return { root, store, sound, panel, get };
}

test('S1: la sección Sonido muestra los volúmenes y Silenciar', () => {
  const { get } = setup();
  expect(get('sound-master').value).toBe('80');
  expect(get('sound-music').value).toBe('50');
  expect(get('sound-sfx').value).toBe('80');
  expect(get('sound-muted').checked).toBe(false);
  expect(get('sound-music').type).toBe('range');
});

test('S1: mover un deslizador guarda el volumen', () => {
  const { get, store } = setup();
  const music = get('sound-music');
  music.value = '30';
  music.dispatchEvent(new Event('input'));
  expect(loadSound(store).music).toBe(30);
  const muted = get('sound-muted');
  muted.checked = true;
  muted.dispatchEvent(new Event('change'));
  expect(loadSound(store).muted).toBe(true);
});

test('S1: silenciar con M (fuera del panel) se ve en la casilla', () => {
  const { get, sound, panel } = setup();
  sound.toggleMute();
  panel.update();
  expect(get('sound-muted').checked).toBe(true);
});
