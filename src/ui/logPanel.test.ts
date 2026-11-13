// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { logEvent } from '../sim/log';
import { createWorld } from '../sim/world';
import { emptyWorld } from '../sim/testing/fixtures';
import { buildingThe, formatItems, formatLogEntry } from './describe';
import { LOG_CATEGORIES, LOG_CATEGORY, mountLog } from './logPanel';
import { SMALL_SCREEN } from './screen';

test('formatItems: plurales y lista legible', () => {
  expect(
    formatItems({
      food: 4,
      bandage: 1,
      knife: 0,
      bat: 2,
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
      seedsLettuce: 0,
      seedsTomato: 0,
      seedsPotato: 0,
      seedsCabbage: 0,
      lettuce: 0,
      tomato: 0,
      potato: 0,
      cabbage: 0,
      stewVeg: 0,
      stewPotato: 0,
      soupCabbage: 0,
      salad: 0,
      preserves: 0,
      radio: 0,
      battery: 0,
      pistol: 0,
      shotgun: 0,
      ammo: 0,
      shells: 0,
      generator: 0,
      gasCan: 0,
      pieces: [],
    }),
  ).toBe('4 latas, 1 venda y 2 bates');
  expect(
    formatItems({
      food: 1,
      bandage: 0,
      knife: 1,
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
      seedsLettuce: 0,
      seedsTomato: 0,
      seedsPotato: 0,
      seedsCabbage: 0,
      lettuce: 0,
      tomato: 0,
      potato: 0,
      cabbage: 0,
      stewVeg: 0,
      stewPotato: 0,
      soupCabbage: 0,
      salad: 0,
      preserves: 0,
      radio: 0,
      battery: 0,
      pistol: 0,
      shotgun: 0,
      ammo: 0,
      shells: 0,
      generator: 0,
      gasCan: 0,
      pieces: [],
    }),
  ).toBe('1 lata y 1 cuchillo');
  expect(
    formatItems({
      food: 0,
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
      seedsLettuce: 0,
      seedsTomato: 0,
      seedsPotato: 0,
      seedsCabbage: 0,
      lettuce: 0,
      tomato: 0,
      potato: 0,
      cabbage: 0,
      stewVeg: 0,
      stewPotato: 0,
      soupCabbage: 0,
      salad: 0,
      preserves: 0,
      radio: 0,
      battery: 0,
      pistol: 0,
      shotgun: 0,
      ammo: 0,
      shells: 0,
      generator: 0,
      gasCan: 0,
      pieces: [],
    }),
  ).toBe('nada');
});

test('cada suceso se convierte en una frase con día y hora', () => {
  const w = createWorld(2);
  const s = w.survivors[0]!;
  w.tick = 300 * 2 + 5 * 14; // Día 1, 10:14
  logEvent(w, {
    kind: 'found',
    survivorId: s.id,
    houseId: 3,
    items: {
      food: 4,
      bandage: 1,
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
      seedsLettuce: 0,
      seedsTomato: 0,
      seedsPotato: 0,
      seedsCabbage: 0,
      lettuce: 0,
      tomato: 0,
      potato: 0,
      cabbage: 0,
      stewVeg: 0,
      stewPotato: 0,
      soupCabbage: 0,
      salad: 0,
      preserves: 0,
      radio: 0,
      battery: 0,
      pistol: 0,
      shotgun: 0,
      ammo: 0,
      shells: 0,
      generator: 0,
      gasCan: 0,
      pieces: [],
    },
  });
  expect(formatLogEntry(w.common.log.at(-1)!, w)).toBe(
    `Día 1, 10:14 · ${s.name} ha encontrado 4 latas y 1 venda en ${buildingThe(w, 3)}`,
  );
  logEvent(w, { kind: 'houseEmptied', houseId: 3 });
  expect(formatLogEntry(w.common.log.at(-1)!, w)).toBe(
    `Día 1, 10:14 · Se ha vaciado ${buildingThe(w, 3)}`,
  );
  logEvent(w, { kind: 'refused', survivorId: s.id });
  expect(formatLogEntry(w.common.log.at(-1)!, w)).toContain(`${s.name} se niega a trabajar`);
  logEvent(w, { kind: 'outOfFood' });
  expect(formatLogEntry(w.common.log.at(-1)!, w)).toContain('El almacén se ha quedado sin comida');
});

test('sucesos de relaciones y de recién llegados', () => {
  const w = createWorld(2);
  const [a, b] = w.survivors;
  const last = () => formatLogEntry(w.common.log.at(-1)!, w);
  logEvent(w, { kind: 'couple', survivorId: a!.id, otherId: b!.id });
  expect(last()).toContain(`${a!.name} y ${b!.name} ahora son pareja`);
  logEvent(w, { kind: 'consoled', survivorId: a!.id, otherId: b!.id });
  expect(last()).toContain(`${a!.name} ha consolado a ${b!.name}`);
  logEvent(w, { kind: 'strangerArrived', names: ['Zoe'] });
  expect(last()).toContain('Alguien se acerca a la base: Zoe');
  logEvent(w, { kind: 'strangerArrived', names: ['Zoe', 'Iván'] });
  expect(last()).toContain('Se acercan a la base Zoe y Iván, que llegan en pareja');
});

test('el panel muestra los sucesos, el más reciente abajo', () => {
  const root = document.createElement('div');
  const w = createWorld(2);
  const panel = mountLog(root, { world: w });
  logEvent(w, { kind: 'houseEmptied', houseId: 1 });
  logEvent(w, { kind: 'houseEmptied', houseId: 2 });
  panel.update();
  const items = [...root.querySelectorAll('[data-testid="log"] li')].map((li) => li.textContent);
  expect(items).toHaveLength(2);
  expect(items[1]).toContain(`Se ha vaciado ${buildingThe(w, 2)}`);
});

test('textos de los sucesos sociales del narrador', () => {
  const w = createWorld(2);
  const [a, b, c] = w.survivors;
  const last = () => formatLogEntry(w.common.log.at(-1)!, w);
  logEvent(w, { kind: 'theft', suspectId: a!.id, cans: 2 });
  expect(last()).toContain(`Faltan 2 latas del almacén y todos miran a ${a!.name}`);
  logEvent(w, { kind: 'theftPunished', suspectId: a!.id, guilty: false });
  expect(last()).toContain('era inocente');
  logEvent(w, {
    kind: 'gossip',
    survivorId: a!.id,
    listenerId: b!.id,
    otherId: c!.id,
    found: true,
  });
  expect(last()).toContain(
    `${a!.name} le cuenta a ${b!.name} cosas de ${c!.name}, y ${c!.name} se entera`,
  );
  logEvent(w, { kind: 'foodFight' });
  expect(last()).toContain('Discusión por el reparto de la comida');
});

// --- H5 §10: filtros del registro ---

test('cada tipo de suceso tiene su categoría (Social, Combate, Saqueo, Trabajo, Salud, Narrador, Colonia)', () => {
  expect(LOG_CATEGORIES).toEqual([
    'social',
    'combat',
    'loot',
    'work',
    'health',
    'narrator',
    'colony',
  ]);
  expect(LOG_CATEGORY.fight).toBe('social');
  expect(LOG_CATEGORY.zombieKilled).toBe('combat');
  expect(LOG_CATEGORY.found).toBe('loot');
  expect(LOG_CATEGORY.built).toBe('work');
  expect(LOG_CATEGORY.wounded).toBe('health');
  expect(LOG_CATEGORY.died).toBe('health');
  expect(LOG_CATEGORY.storm).toBe('narrator');
  expect(LOG_CATEGORY.strangerArrived).toBe('colony');
});

test('filtros: un botón por categoría; apagarlo oculta sus sucesos y se recuerda en el navegador', () => {
  localStorage.removeItem('rimzomboid.logFilters');
  const root = document.createElement('div');
  const w = createWorld(2);
  const s = w.survivors[0]!;
  const panel = mountLog(root, { world: w });
  logEvent(w, { kind: 'houseEmptied', houseId: 1 });
  logEvent(w, { kind: 'wounded', survivorId: s.id, part: 'leftArm', wound: 'cut' });
  panel.update();
  const items = () =>
    [...root.querySelectorAll('[data-testid="log"] li')]
      .filter((li) => !(li as HTMLElement).hidden)
      .map((li) => li.textContent);
  expect(items()).toHaveLength(2);
  const loot = root.querySelector('[data-testid="log-filter-loot"]') as HTMLButtonElement;
  expect(loot.textContent).toBe('Saqueo');
  expect(loot.classList.contains('off')).toBe(false);
  loot.click();
  expect(loot.classList.contains('off')).toBe(true);
  expect(items()).toEqual([expect.stringContaining('le ha hecho un corte')]);
  expect(JSON.parse(localStorage.getItem('rimzomboid.logFilters')!)).toEqual(['loot']);
  // Al volver a abrir el juego, sigue apagado.
  const again = document.createElement('div');
  const panel2 = mountLog(again, { world: w });
  panel2.update();
  expect(
    (again.querySelector('[data-testid="log-filter-loot"]') as HTMLElement).classList.contains(
      'off',
    ),
  ).toBe(true);
  expect([...again.querySelectorAll('li')].filter((li) => !li.hidden)).toHaveLength(1);
  loot.click();
  expect(items()).toHaveLength(2);
  localStorage.removeItem('rimzomboid.logFilters');
});

test('U1: los filtros se esconden tras «Filtrar» (al principio no se ven); se recuerda', () => {
  localStorage.removeItem('rimzomboid.logShowFilters');
  localStorage.removeItem('rimzomboid.logFilters');
  localStorage.setItem('rimzomboid.logCollapsed', '0');
  const root = document.createElement('div');
  mountLog(root, { world: createWorld(2) });
  const filters = root.querySelector('.log-filters') as HTMLElement;
  const button = root.querySelector('[data-testid="log-filter-toggle"]') as HTMLButtonElement;
  expect(filters.hidden).toBe(true);
  expect(button.textContent).toBe('Filtrar');
  button.click();
  expect(filters.hidden).toBe(false);
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(localStorage.getItem('rimzomboid.logShowFilters')).toBe('1');
  // Con algo apagado, el botón lo dice.
  (root.querySelector('[data-testid="log-filter-loot"]') as HTMLButtonElement).click();
  expect(button.textContent).toBe('Filtrar (1 oculto)');
  // Otra vez: se ven al abrir.
  const again = document.createElement('div');
  mountLog(again, { world: createWorld(2) });
  expect((again.querySelector('.log-filters') as HTMLElement).hidden).toBe(false);
  expect(again.querySelector('[data-testid="log-filter-toggle"]')!.textContent).toBe(
    'Filtrar (1 oculto)',
  );
  // Plegado, ni filtros ni «Filtrar».
  (again.querySelector('[data-testid="log-toggle"]') as HTMLButtonElement).click();
  expect((again.querySelector('.log-filters') as HTMLElement).hidden).toBe(true);
  expect((again.querySelector('[data-testid="log-filter-toggle"]') as HTMLElement).hidden).toBe(
    true,
  );
  localStorage.removeItem('rimzomboid.logShowFilters');
  localStorage.removeItem('rimzomboid.logFilters');
  localStorage.removeItem('rimzomboid.logCollapsed');
});

test('los filtros van abajo del registro, después de la lista (siempre a mano)', () => {
  const root = document.createElement('div');
  mountLog(root, { world: createWorld(2) });
  const panel = root.querySelector('[data-testid="log"]')!;
  expect([...panel.children].map((c) => c.tagName.toLowerCase() + '.' + c.className)).toEqual([
    'header.',
    'ol.',
    'div.log-filters',
  ]);
});

test('el registro se ve desde el principio, vacío: «Aún no ha pasado nada» (H6c)', () => {
  const w = emptyWorld(5, 5);
  w.common.log = [];
  const root = document.createElement('div');
  const log = mountLog(root, { world: w });
  log.update();
  const panel = root.querySelector('[data-testid="log"]') as HTMLElement;
  expect(panel.hidden).toBe(false);
  expect(root.querySelector('[data-testid="log-empty"]')!.textContent).toBe(
    'Aún no ha pasado nada',
  );
});

test('M2: en pantalla pequeña empieza plegado, salvo que se haya desplegado antes', () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === SMALL_SCREEN }));
  try {
    localStorage.removeItem('rimzomboid.logCollapsed');
    const mount = () => {
      const root = document.createElement('div');
      mountLog(root, { world: createWorld(2) });
      return root.querySelector('[data-testid="log"]') as HTMLElement;
    };
    expect(mount().classList.contains('collapsed')).toBe(true);
    localStorage.setItem('rimzomboid.logCollapsed', '0');
    expect(mount().classList.contains('collapsed')).toBe(false);
  } finally {
    vi.unstubAllGlobals();
    localStorage.removeItem('rimzomboid.logCollapsed');
  }
});

test('en pantalla ancha empieza desplegado, como siempre', () => {
  localStorage.removeItem('rimzomboid.logCollapsed');
  const root = document.createElement('div');
  mountLog(root, { world: createWorld(2) });
  expect(root.querySelector('[data-testid="log"]')!.classList.contains('collapsed')).toBe(false);
});

test('V4: el registro dice qué cultivos se han helado (y lo de antes, como antes)', async () => {
  const { es } = await import('../i18n/es');
  expect(es.log.cropsFrozen(1, ['col'])).toBe('Se ha helado 1 cultivo: col');
  expect(es.log.cropsFrozen(3, ['lechuga', 'col'])).toBe('Se han helado 3 cultivos: lechuga y col');
  expect(es.log.cropsFrozen(2)).toBe('La helada ha matado 2 cultivos');
});
