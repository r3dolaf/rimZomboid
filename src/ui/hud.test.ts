// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { createTimeController } from '../game/timeController';
import { emptyInventory } from '../sim/items';
import { formatDayTime, mountHud } from './hud';
import { createTool } from './tool';

test('formatDayTime rellena con ceros', () => {
  expect(formatDayTime({ day: 3, hour: 7, minute: 5 })).toBe('Día 3, 07:05');
});

test('el HUD muestra la semilla y marca la velocidad activa', () => {
  const root = document.createElement('div');
  const time = createTimeController();
  mountHud(root, { seed: 42, time });
  expect(root.querySelector('[data-testid="hud-seed"]')!.textContent).toBe('Semilla: 42');
  expect(root.querySelector('[data-speed="1"]')!.classList.contains('active')).toBe(true);
  (root.querySelector('[data-speed="3"]') as HTMLButtonElement).click();
  expect(time.speed).toBe(3);
  expect(root.querySelector('[data-speed="3"]')!.classList.contains('active')).toBe(true);
  expect(root.querySelector('[data-speed="1"]')!.classList.contains('active')).toBe(false);
});

test('update cambia la hora y refleja cambios de velocidad hechos con el teclado', () => {
  const root = document.createElement('div');
  const time = createTimeController();
  const hud = mountHud(root, { seed: 1, time });
  time.togglePause();
  hud.update(
    { day: 2, hour: 13, minute: 30 },
    {
      food: 35,
      bandage: 0,
      knife: 0,
      bat: 0,
      axe: 0,
      wood: 0,
      cloth: 0,
      curtains: 0,
      thread: 0,
      needle: 0,
      crowbar: 0,
      machete: 0,
      painkillers: 0,
      denim: 0,
      leather: 0,
      bucket: 0,
      waterBucket: 0,
      waterBottle: 0,
      pieces: [],
    },
  );
  expect(root.querySelector('[data-testid="hud-time"]')!.textContent).toBe('Día 2, 13:30');
  expect(root.querySelector('[data-speed="0"]')!.classList.contains('active')).toBe(true);
});

test('el botón de pausa tiene un nombre accesible', () => {
  const root = document.createElement('div');
  mountHud(root, { seed: 1, time: createTimeController() });
  expect(root.querySelector('[data-speed="0"]')!.getAttribute('aria-label')).toBe('Pausa');
});

test('al pulsar un botón de velocidad, este pierde el foco (Espacio no lo vuelve a pulsar)', () => {
  const root = document.createElement('div');
  document.body.append(root);
  mountHud(root, { seed: 1, time: createTimeController() });
  const b = root.querySelector('[data-speed="2"]') as HTMLButtonElement;
  b.focus();
  b.click();
  expect(document.activeElement).not.toBe(b);
  root.remove();
});

test('muestra la comida del almacén', () => {
  const root = document.createElement('div');
  const hud = mountHud(root, { seed: 1, time: createTimeController() });
  hud.update(
    { day: 1, hour: 8, minute: 0 },
    {
      food: 12,
      bandage: 3,
      knife: 0,
      bat: 0,
      axe: 0,
      wood: 0,
      cloth: 0,
      curtains: 0,
      thread: 0,
      needle: 0,
      crowbar: 0,
      machete: 0,
      painkillers: 0,
      denim: 0,
      leather: 0,
      bucket: 0,
      waterBucket: 0,
      waterBottle: 0,
      pieces: [],
    },
  );
  expect(root.querySelector('[data-testid="hud-food"]')!.textContent).toBe('Comida: 12');
  expect(root.querySelector('[data-testid="hud-bandages"]')!.textContent).toBe('Vendas: 3');
});

test('los botones Saquear, Talar y Construir activan su herramienta (solo una a la vez)', () => {
  const root = document.createElement('div');
  const tool = createTool();
  mountHud(root, { seed: 1, time: createTimeController(), tool });
  const b = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
  b('hud-loot-tool').click();
  expect(tool.mode).toBe('loot');
  expect(b('hud-loot-tool').classList.contains('active')).toBe(true);
  b('hud-chop-tool').click();
  expect(tool.mode).toBe('chop');
  expect(b('hud-loot-tool').classList.contains('active')).toBe(false);
  expect(b('hud-chop-tool').classList.contains('active')).toBe(true);
  b('hud-build-tool').click();
  expect(tool.mode).toBe('build');
  b('hud-build-tool').click();
  expect(tool.mode).toBeNull();
});

test('muestra la madera del almacén y el botón Trabajos abre el panel', () => {
  const root = document.createElement('div');
  const toggleWork = vi.fn();
  const hud = mountHud(root, { seed: 1, time: createTimeController(), toggleWork });
  hud.update(
    { day: 1, hour: 9, minute: 0 },
    {
      food: 1,
      bandage: 0,
      knife: 0,
      bat: 0,
      axe: 0,
      wood: 7,
      cloth: 0,
      curtains: 0,
      thread: 0,
      needle: 0,
      crowbar: 0,
      machete: 0,
      painkillers: 0,
      denim: 0,
      leather: 0,
      bucket: 0,
      waterBucket: 0,
      waterBottle: 0,
      pieces: [],
    },
  );
  expect(root.querySelector('[data-testid="hud-wood"]')!.textContent).toBe('Madera: 7');
  (root.querySelector('[data-testid="hud-work"]') as HTMLButtonElement).click();
  expect(toggleWork).toHaveBeenCalledTimes(1);
});

test('muestra el narrador y la tormenta mientras dura', () => {
  const root = document.createElement('div');
  const hud = mountHud(root, { seed: 1, time: createTimeController(), narrator: 'chaotic' });
  expect(root.querySelector('[data-testid="hud-narrator"]')!.textContent).toBe('Narrador: Caótico');
  const weather = root.querySelector('[data-testid="hud-weather"]') as HTMLElement;
  const stock = {
    food: 1,
    bandage: 0,
    knife: 0,
    bat: 0,
    axe: 0,
    wood: 0,
    cloth: 0,
    curtains: 0,
    thread: 0,
    needle: 0,
    crowbar: 0,
    machete: 0,
    painkillers: 0,
    denim: 0,
    leather: 0,
    bucket: 0,
    waterBucket: 0,
    waterBottle: 0,
    pieces: [],
  };
  hud.update({ day: 1, hour: 9, minute: 0 }, stock, false);
  expect(weather.hidden).toBe(true);
  hud.update({ day: 1, hour: 9, minute: 0 }, stock, true);
  expect(weather.hidden).toBe(false);
  expect(weather.textContent).toBe('🌧 Tormenta');
});

test('el botón Fabricar abre el panel de pedidos (H4d)', () => {
  const root = document.createElement('div');
  const toggleCraft = vi.fn();
  mountHud(root, { seed: 1, time: createTimeController(), toggleCraft });
  const b = root.querySelector('[data-testid="hud-craft"]') as HTMLButtonElement;
  expect(b.textContent).toBe('Fabricar');
  expect(b.hidden).toBe(false);
  b.click();
  expect(toggleCraft).toHaveBeenCalledTimes(1);
});

test('el botón Avisos abre su menú (H4e)', () => {
  const root = document.createElement('div');
  const toggleNotices = vi.fn();
  mountHud(root, { seed: 1, time: createTimeController(), toggleNotices });
  const b = root.querySelector('[data-testid="hud-notices"]') as HTMLButtonElement;
  expect(b.hidden).toBe(false);
  expect(b.textContent).toBe('Avisos');
  b.click();
  expect(toggleNotices).toHaveBeenCalledTimes(1);
});

test('con todos durmiendo muestra «x6 (durmiendo)» y ningún botón activo; al despertar, el elegido', () => {
  const root = document.createElement('div');
  const time = createTimeController();
  const hud = mountHud(root, { seed: 1, time });
  const badge = root.querySelector('[data-testid="hud-sleep-speed"]') as HTMLElement;
  expect(badge.hidden).toBe(true);
  time.setAllAsleep(true);
  hud.update({ day: 1, hour: 23, minute: 0 }, emptyInventory());
  expect(badge.hidden).toBe(false);
  expect(badge.textContent).toBe('x6 (durmiendo)');
  expect(root.querySelectorAll('[data-speed].active')).toHaveLength(0);
  (root.querySelector('[data-speed="1"]') as HTMLButtonElement).click(); // manda lo tuyo
  expect(badge.hidden).toBe(true);
  expect(root.querySelector('[data-speed="1"]')!.classList.contains('active')).toBe(true);
});
