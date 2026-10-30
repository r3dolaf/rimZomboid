// @vitest-environment jsdom
// H5c1 §7: varios mapas en pantalla: pestañas, tarjetas de todos con dónde están, paneles del
// mapa que se ve, y avisos y registro con el nombre del mapa.
import { expect, test } from 'vitest';
import { createTimeController } from '../game/timeController';
import { logEvent } from '../sim/log';
import { addSurvivor, emptyWorld, moveTo, siteForTest } from '../sim/testing/fixtures';
import type { SiteInfo, Survivor, Travel, World } from '../sim/types';
import { mountCards } from './cards';
import { formatLogEntry, mapName, personName, whereText } from './describe';
import { createFlag } from './flag';
import { createMapView, mountMapTabs, viewed } from './mapView';
import { mountNotices } from './notices';
import { createSelection } from './selection';
import { mountSheet } from './sheet';
import { mountStoragePanel } from './storagePanel';

const site = (id: number, over: Partial<SiteInfo> = {}): SiteInfo => ({
  id,
  kind: 'farm',
  special: null,
  side: 0,
  hours: 4,
  state: 'known',
  visited: true,
  specialUntil: null,
  leftAt: null,
  extraZombies: 0,
  hex: 200 + id,
  ...over,
});

/** Ana en la base, Bea en la granja del norte (sitio 7) y Carla de camino allí. */
function game(): { base: World; farm: World; ana: Survivor; bea: Survivor; carla: Survivor } {
  const base = emptyWorld(20, 20);
  const ana = base.survivors[0]!;
  const bea = addSurvivor(base, { x: 3, y: 3 }, 'Bea');
  const carla = addSurvivor(base, { x: 4, y: 4 }, 'Carla');
  base.common.expedition.sites.push(site(7));
  const farm = siteForTest(base, 7, 16, 16);
  moveTo(base, farm, bea);
  base.survivors = base.survivors.filter((s) => s !== carla);
  base.common.expedition.travels.push(travel({ members: [carla] }));
  return { base, farm, ana, bea, carla };
}

function travel(over: Partial<Travel>): Travel {
  return {
    id: 90,
    kind: 'go',
    siteId: 7,
    side: 0,
    target: 0,
    waypoints: [],
    path: [0],
    at: 0,
    members: [],
    hoursLeft: 2.5,
    pending: [],
    ...over,
  };
}

test('el nombre de cada mapa y dónde está cada uno', () => {
  const { base, ana, bea, carla } = game();
  expect(mapName(base, 0)).toBe('Base');
  expect(mapName(base, 7)).toBe('Granja del norte');
  expect(whereText(base, ana.id)).toBe('En la base');
  expect(whereText(base, bea.id)).toBe('En la granja del norte');
  expect(whereText(base, carla.id)).toBe('Viajando a la granja del norte · faltan 3 h');
  base.common.expedition.travels[0]!.kind = 'back';
  expect(whereText(base, carla.id)).toBe('Volviendo de la granja del norte · faltan 3 h');
  base.common.expedition.sites.push(site(8, { kind: 'village', side: 1 }));
  Object.assign(base.common.expedition.travels[0]!, { kind: 'go', siteId: 8 });
  expect(whereText(base, carla.id)).toBe('Viajando al pueblecito del sur · faltan 3 h');
  Object.assign(base.common.expedition.travels[0]!, {
    kind: 'explore',
    siteId: null,
    side: 3,
    hoursLeft: 5,
  });
  expect(whereText(base, carla.id)).toBe('Explorando el este · faltan 5 h');
  base.common.expedition.sites.push(site(9, { special: 'stash', side: 2 }));
  expect(mapName(base, 9)).toBe('Alijo del oeste');
});

test('los nombres se buscan en todos los mapas y de viaje', () => {
  const { base, bea, carla } = game();
  expect(personName(base, bea.id)).toBe('Bea');
  expect(personName(base, carla.id)).toBe('Carla');
});

test('pestañas: Base y una por sitio con gente; al pulsar, ese mapa; si se queda vacío, a la base', () => {
  const { base, farm, bea } = game();
  const view = createMapView(base);
  const root = document.createElement('div');
  const tabs = mountMapTabs(root, { view });
  const tab = (id: number) => root.querySelector(`[data-testid="map-tab-${id}"]`) as HTMLElement;
  const bar = () => root.querySelector('[data-testid="map-tabs"]') as HTMLElement;
  tabs.update();
  expect(bar().hidden).toBe(false);
  expect(tab(0).textContent).toBe('Base · 1');
  expect(tab(7).textContent).toBe('Granja del norte · 1');
  expect(tab(0).classList.contains('active')).toBe(true);
  tab(7).click();
  expect(view.mapId).toBe(7);
  expect(view.world).toBe(farm);
  tabs.update();
  expect(tab(7).classList.contains('active')).toBe(true);
  farm.survivors = farm.survivors.filter((s) => s !== bea);
  tabs.update();
  expect(view.mapId).toBe(0);
  expect(view.world).toBe(base);
  expect(bar().hidden).toBe(true); // con solo la base, sin pestañas
});

test('cada mapa recuerda su cámara; quien escucha se entera del cambio', () => {
  const { base } = game();
  const view = createMapView(base);
  const seen: number[] = [];
  view.onChange((id) => seen.push(id));
  view.saveCamera(0, { x: 10, y: 20, zoom: 3 });
  expect(view.camera(0)).toEqual({ x: 10, y: 20, zoom: 3 });
  expect(view.camera(7)).toBeUndefined();
  view.set(7);
  view.set(7); // el mismo: nada
  view.set(99); // no existe: nada
  expect(seen).toEqual([7]);
});

test('tarjetas de todos: los de fuera dicen dónde están; al pulsar, a su mapa (de viaje, nada)', () => {
  const { base, ana, bea, carla } = game();
  const view = createMapView(base);
  const selection = createSelection();
  const root = document.createElement('div');
  const cards = mountCards(root, { world: base, view, selection });
  cards.update();
  const card = (s: Survivor) =>
    root.querySelector(`[data-testid="card-${s.id}"]`) as HTMLButtonElement;
  const where = (s: Survivor) => card(s).querySelector('.where') as HTMLElement;
  expect(root.querySelectorAll('.card')).toHaveLength(3);
  expect(where(ana).hidden).toBe(true);
  expect(where(bea).textContent).toContain('En la granja del norte');
  expect(card(bea).classList.contains('away')).toBe(true);
  expect(where(carla).textContent).toContain('Viajando a la granja del norte');
  card(bea).click();
  expect(view.mapId).toBe(7);
  expect(selection.id).toBe(bea.id);
  cards.update();
  expect(where(ana).textContent).toContain('En la base');
  expect(where(bea).hidden).toBe(true);
  card(carla).click();
  expect(view.mapId).toBe(7);
  expect(selection.id).toBe(bea.id);
});

test('arriba y los paneles son del mapa que se ve (en un sitio, el campamento)', () => {
  const { base, farm } = game();
  const view = createMapView(base);
  base.storage.items.food = 4;
  farm.storage.items.food = 9;
  const root = document.createElement('div');
  const open = createFlag();
  open.set(true);
  const panel = mountStoragePanel(root, viewed(view, { open }));
  const food = () => root.querySelector('[data-testid="storage-food"]')?.textContent;
  panel.update();
  expect(food()).toBe('Latas4');
  view.set(7);
  panel.update();
  expect(food()).toBe('Latas9');
});

test('la ficha dice en qué sitio está y busca los nombres en todos los mapas', () => {
  const { base, farm, ana, bea } = game();
  bea.partnerId = ana.id;
  ana.partnerId = bea.id;
  const view = createMapView(base);
  view.set(7);
  const selection = createSelection();
  selection.set(bea.id);
  const root = document.createElement('div');
  const sheet = mountSheet(root, viewed(view, { base, selection }));
  sheet.update();
  const text = root.querySelector('[data-testid="sheet"]')!.textContent!;
  expect(text).toContain('En la granja del norte');
  expect(text).toContain('Ana');
  expect(farm.survivors).toContain(bea);
});

test('el registro y los avisos dicen de qué mapa es; al pulsar un aviso, su mapa', () => {
  const { base, farm, bea } = game();
  const root = document.createElement('div');
  const focused: { id?: number; at?: { x: number; y: number }; mapId?: number }[] = [];
  const notices = mountNotices(root, {
    world: base,
    time: createTimeController(),
    onFocus: (id) => focused.push({ id }),
    onFocusAt: (at, mapId) => focused.push({ at, mapId }),
  });
  logEvent(farm, { kind: 'wounded', survivorId: bea.id, part: 'leftArm', wound: 'bite' });
  const e = base.common.log.find((x) => x.kind === 'wounded')!;
  expect(formatLogEntry(e, base)).toContain('Granja del norte: ');
  expect(formatLogEntry(e, base)).toContain('Bea');
  notices.update();
  const shown = root.querySelectorAll('[data-testid="notice"]');
  expect(shown[shown.length - 1]!.textContent).toContain('Granja del norte: ');
  (shown[shown.length - 1] as HTMLElement).click();
  expect(focused[0]).toEqual({ id: bea.id });
  logEvent(farm, { kind: 'zombieSighted', x: 2, y: 3 });
  notices.update();
  (root.querySelector('[data-testid="notice"]') as HTMLElement).click(); // el más nuevo, arriba
  expect(focused[1]).toEqual({ at: { x: 2, y: 3 }, mapId: 7 });
});

test('las decisiones de un sitio se ven y se responden en su mapa', () => {
  const { base, farm, bea } = game();
  farm.decisions.push({ id: 500, kind: 'fever', survivorIds: [bea.id], expiresAt: 1e9 });
  const root = document.createElement('div');
  const notices = mountNotices(root, { world: base, time: createTimeController() });
  notices.update();
  const card = root.querySelector('[data-testid="decision-fever"]') as HTMLElement;
  expect(card.textContent).toContain('Bea');
  expect(card.textContent).toContain('Granja del norte');
  (card.querySelector('[data-testid="decision-option-0"]') as HTMLButtonElement).click();
  expect(farm.orders).toContainEqual({ type: 'decide', decisionId: 500, option: 0 });
  expect(base.orders).toEqual([]);
});
