// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { createTimeController } from '../game/timeController';
import { emptyInventory } from '../sim/items';
import { formatDayTime, mountHud } from './hud';
import { createTool } from './tool';

test('formatDayTime rellena con ceros', () => {
  expect(formatDayTime({ day: 3, hour: 7, minute: 5 })).toBe('Día 3, 07:05');
});

test('el HUD marca la velocidad activa (la semilla está en el panel Partida, H6c)', () => {
  const root = document.createElement('div');
  const time = createTimeController();
  mountHud(root, { seed: 42, time });
  expect(root.querySelector('[data-testid="hud-seed"]')).toBeNull();
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
      antibiotics: 0,
      denim: 0,
      leather: 0,
      bucket: 0,
      waterBucket: 0,
      waterBottle: 0,
      hatchet: 0,
      roadMap: 0,
      note: 0,
      seeds: 0,
      veg: 0,
      meal: 0,
      radio: 0,
      battery: 0,
      pistol: 0,
      shotgun: 0,
      ammo: 0,
      shells: 0,
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
      antibiotics: 0,
      denim: 0,
      leather: 0,
      bucket: 0,
      waterBucket: 0,
      waterBottle: 0,
      hatchet: 0,
      roadMap: 0,
      note: 0,
      seeds: 0,
      veg: 4,
      meal: 1,
      radio: 0,
      battery: 0,
      pistol: 0,
      shotgun: 0,
      ammo: 0,
      shells: 0,
      pieces: [],
    },
  );
  // V1: la comida suma latas, hortalizas y guisos; al pasar el ratón, el desglose.
  expect(root.querySelector('[data-testid="hud-food"]')!.textContent).toBe('🥫 17');
  expect(root.querySelector('[data-testid="hud-bandages"]')!.textContent).toBe('🩹 3');
  expect((root.querySelector('[data-testid="hud-food"]') as HTMLElement).title).toBe(
    'Comida: 12 latas, 4 hortalizas y 1 guiso',
  );
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
      antibiotics: 0,
      denim: 0,
      leather: 0,
      bucket: 0,
      waterBucket: 0,
      waterBottle: 0,
      hatchet: 0,
      roadMap: 0,
      note: 0,
      seeds: 0,
      veg: 0,
      meal: 0,
      radio: 0,
      battery: 0,
      pistol: 0,
      shotgun: 0,
      ammo: 0,
      shells: 0,
      pieces: [],
    },
  );
  expect(root.querySelector('[data-testid="hud-wood"]')!.textContent).toBe('🪵 7');
  (root.querySelector('[data-testid="hud-work"]') as HTMLButtonElement).click();
  expect(toggleWork).toHaveBeenCalledTimes(1);
});

test('muestra la tormenta mientras dura (el narrador, en el panel Partida, H6c)', () => {
  const root = document.createElement('div');
  const hud = mountHud(root, { seed: 1, time: createTimeController(), narrator: 'chaotic' });
  expect(root.querySelector('[data-testid="hud-narrator"]')).toBeNull();
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
    antibiotics: 0,
    denim: 0,
    leather: 0,
    bucket: 0,
    waterBucket: 0,
    waterBottle: 0,
    hatchet: 0,
    roadMap: 0,
    note: 0,
    seeds: 0,
    veg: 0,
    meal: 0,
    radio: 0,
    battery: 0,
    pistol: 0,
    shotgun: 0,
    ammo: 0,
    shells: 0,
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

const PANELS = ['storage', 'work', 'craft', 'expeditions', 'game'] as const;
const toggleName = {
  storage: 'toggleStorage',
  work: 'toggleWork',
  craft: 'toggleCraft',
  expeditions: 'toggleExpeditions',
  game: 'toggleGame',
} as const;

test('U1 §2: Atuendos y Avisos ya no están en la barra (son pestañas de Trabajos y Partida)', () => {
  const root = document.createElement('div');
  mountHud(root, { seed: 1, time: createTimeController(), toggleWork: vi.fn() });
  for (const id of ['hud-outfits', 'hud-notices', 'hud-menu-outfits', 'hud-menu-notices'])
    expect(root.querySelector(`[data-testid="${id}"]`)).toBeNull();
});

test('U1 §2: cada herramienta y cada panel dice su tecla en la ayuda; en el ☰, a la derecha', () => {
  const root = document.createElement('div');
  const calls = Object.fromEntries(PANELS.map((p) => [toggleName[p], vi.fn()]));
  mountHud(root, { seed: 1, time: createTimeController(), tool: createTool(), ...calls });
  const title = (id: string) => (root.querySelector(`[data-testid="${id}"]`) as HTMLElement).title;
  expect(title('hud-loot-tool')).toMatch(/\(L\)$/);
  expect(title('hud-chop-tool')).toMatch(/\(T\)$/);
  expect(title('hud-build-tool')).toMatch(/\(B\)$/);
  expect(PANELS.map((p) => title(`hud-${p}`).slice(-3))).toEqual([
    '(I)',
    '(J)',
    '(F)',
    '(E)',
    '(P)',
  ]);
  const kbd = (p: string) => root.querySelector(`[data-testid="hud-menu-${p}"] kbd`)!.textContent;
  expect(PANELS.map(kbd)).toEqual(['I', 'J', 'F', 'E', 'P']);
});

test('U1 §2: «⏸ En pausa» se ve en pausa (también la de los avisos); al seguir, se va', () => {
  const root = document.createElement('div');
  const time = createTimeController();
  const hud = mountHud(root, { seed: 1, time });
  const sign = root.querySelector('[data-testid="hud-paused"]') as HTMLElement;
  expect(sign.hidden).toBe(true);
  time.setSpeed(0); // como un aviso rojo
  hud.update({ day: 1, hour: 8, minute: 0 }, emptyInventory());
  expect(sign.hidden).toBe(false);
  expect(sign.textContent).toBe('⏸ En pausa');
  expect(sign.getAttribute('role')).toBe('status');
  time.setSpeed(2);
  hud.update({ day: 1, hour: 8, minute: 0 }, emptyInventory());
  expect(sign.hidden).toBe(true);
});

test('U1 §2: ❓ Ayuda, siempre en la barra (también en el móvil), abre la Ayuda', () => {
  const root = document.createElement('div');
  const toggleHelp = vi.fn();
  mountHud(root, { seed: 1, time: createTimeController(), toggleHelp });
  const help = root.querySelector('[data-testid="hud-help"]') as HTMLButtonElement;
  expect(help.hidden).toBe(false);
  expect(help.parentElement!.className).toBe('hud-bar');
  expect(help.getAttribute('aria-label')).toContain('Ayuda');
  expect(help.title).toMatch(/\(H\)$/);
  help.click();
  expect(toggleHelp).toHaveBeenCalledTimes(1);
  // Sin Ayuda (en algún test), no sale.
  const other = document.createElement('div');
  mountHud(other, { seed: 1, time: createTimeController() });
  expect((other.querySelector('[data-testid="hud-help"]') as HTMLElement).hidden).toBe(true);
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

test('M2: el menú ☰ con los paneles se abre y se cierra; cada línea abre lo mismo que su botón', () => {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const calls = Object.fromEntries(PANELS.map((p) => [toggleName[p], vi.fn()]));
  const hud = mountHud(root, { seed: 1, time: createTimeController(), ...calls });
  const more = root.querySelector('[data-testid="hud-more"]') as HTMLButtonElement;
  const menu = root.querySelector('[data-testid="hud-menu"]') as HTMLElement;
  expect(more.textContent).toBe('☰');
  expect(menu.hidden).toBe(true);
  expect(more.getAttribute('aria-expanded')).toBe('false');
  more.click();
  expect(menu.hidden).toBe(false);
  expect(more.getAttribute('aria-expanded')).toBe('true');
  more.click();
  expect(menu.hidden).toBe(true);
  const items = PANELS.map((p) =>
    menu.querySelector<HTMLButtonElement>(`[data-testid="hud-menu-${p}"]`)!,
  );
  expect(menu.querySelectorAll('button')[0]).toBe(items[0]); // los paneles, lo primero
  expect([...menu.querySelectorAll('button')].slice(0, PANELS.length)).toEqual(items);
  expect(items[1]!.querySelector('.icon')!.textContent).toBe('📋');
  expect(items[1]!.querySelector('.label')!.textContent).toBe('Trabajos');
  PANELS.forEach((p, i) => {
    more.click();
    items[i]!.click();
    expect(calls[toggleName[p]]).toHaveBeenCalledTimes(1);
    expect(menu.hidden).toBe(true);
  });
  // Esc (closeMenu) y tocar fuera también lo cierran; tocar el propio ☰, no (lo hace su clic).
  more.click();
  expect(hud.closeMenu()).toBe(true);
  expect(menu.hidden).toBe(true);
  expect(hud.closeMenu()).toBe(false);
  more.click();
  more.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  menu.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  expect(menu.hidden).toBe(false);
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  expect(menu.hidden).toBe(true);
});

test('M2: sin un panel, tampoco sale en el menú', () => {
  const root = document.createElement('div');
  mountHud(root, { seed: 1, time: createTimeController(), toggleWork: vi.fn() });
  const item = (p: string) => root.querySelector(`[data-testid="hud-menu-${p}"]`) as HTMLElement;
  expect(item('work').hidden).toBe(false);
  expect(item('game').hidden).toBe(true);
});

test('M2: cada botón de la barra lleva su icono, que pinta el CSS (el texto no cambia)', () => {
  const root = document.createElement('div');
  const calls = Object.fromEntries(PANELS.map((p) => [toggleName[p], vi.fn()]));
  mountHud(root, { seed: 1, time: createTimeController(), tool: createTool(), ...calls });
  const icon = (id: string) =>
    (root.querySelector(`[data-testid="${id}"]`) as HTMLElement).dataset.icon;
  expect(['hud-loot-tool', 'hud-chop-tool', 'hud-farm-tool', 'hud-build-tool'].map(icon)).toEqual([
    '🎒',
    '🪓',
    '🌱', // V1
    '🔨',
  ]);
  expect(PANELS.map((p) => icon(`hud-${p}`))).toEqual(['📦', '📋', '🧵', '🧭', '💾']);
  expect(root.querySelector('[data-testid="hud-craft"]')!.textContent).toBe('Fabricar');
  // Las herramientas y los paneles, cada grupo en su sitio (el CSS los mueve en pantalla pequeña).
  expect(root.querySelectorAll('.hud-tools .hud-tool')).toHaveLength(4);
  expect(root.querySelectorAll('.hud-panels .hud-tool')).toHaveLength(PANELS.length);
});

test('M3: «⛶ Pantalla completa» en el menú ☰, solo si se puede; cambia a «Salir…»', () => {
  const root = document.createElement('div');
  let on = false;
  const listeners: ((v: boolean) => void)[] = [];
  const fullscreen = {
    available: true,
    get active() {
      return on;
    },
    toggle: vi.fn(async () => {
      on = !on;
      listeners.forEach((f) => f(on));
    }),
    onChange: (f: (v: boolean) => void) => listeners.push(f),
  };
  mountHud(root, { seed: 1, time: createTimeController(), fullscreen });
  const item = root.querySelector('[data-testid="hud-menu-fullscreen"]') as HTMLButtonElement;
  const menu = root.querySelector('[data-testid="hud-menu"]') as HTMLElement;
  expect(item.hidden).toBe(false);
  expect(item.querySelector('.label')!.textContent).toBe('Pantalla completa');
  (root.querySelector('[data-testid="hud-more"]') as HTMLButtonElement).click();
  item.click();
  expect(fullscreen.toggle).toHaveBeenCalledTimes(1);
  expect(menu.hidden).toBe(true);
  expect(item.querySelector('.label')!.textContent).toBe('Salir de pantalla completa');

  const other = document.createElement('div');
  mountHud(other, {
    seed: 1,
    time: createTimeController(),
    fullscreen: { ...fullscreen, available: false },
  });
  expect((other.querySelector('[data-testid="hud-menu-fullscreen"]') as HTMLElement).hidden).toBe(
    true,
  );
});

test('M3: con ?debug=1, «🐞 Depuración» en el menú ☰ (en el móvil no hay F3); si no, no sale', () => {
  const root = document.createElement('div');
  const toggleDebug = vi.fn();
  mountHud(root, { seed: 1, time: createTimeController(), toggleDebug });
  const item = root.querySelector('[data-testid="hud-menu-debug"]') as HTMLButtonElement;
  expect(item.hidden).toBe(false);
  expect(item.querySelector('.label')!.textContent).toBe('Depuración');
  item.click();
  expect(toggleDebug).toHaveBeenCalledTimes(1);
  const other = document.createElement('div');
  mountHud(other, { seed: 1, time: createTimeController() });
  expect((other.querySelector('[data-testid="hud-menu-debug"]') as HTMLElement).hidden).toBe(true);
});

test('V2: el agua de la base, con «+» mientras hay agua corriente, y el desglose al pasar el ratón', () => {
  const root = document.createElement('div');
  const hud = mountHud(root, { seed: 1, time: createTimeController() });
  const water = root.querySelector('[data-testid="hud-water"]') as HTMLElement;
  hud.update({ day: 1, hour: 8, minute: 0 }, emptyInventory());
  expect(water.hidden).toBe(true); // sin datos, no se ve
  hud.update({ day: 1, hour: 8, minute: 0 }, emptyInventory(), false, 0, null, {
    liters: 12,
    bottles: 3,
    mains: true,
  });
  expect(water.hidden).toBe(false);
  expect(water.textContent).toBe('💧 15+');
  expect(water.title).toBe(
    'Agua: 12 litros en barreños y barriles y 3 botellas · hay agua corriente',
  );
  hud.update({ day: 1, hour: 8, minute: 0 }, emptyInventory(), false, 0, null, {
    liters: 1,
    bottles: 1,
    mains: false,
  });
  expect(water.textContent).toBe('💧 2');
  expect(water.title).toBe('Agua: 1 litro en barreños y barriles y 1 botella · sin agua corriente');
});
