// @vitest-environment jsdom
// H5c1 §4: el panel Expediciones: los sitios conocidos con su estado, formar un grupo (sitio,
// quién y lista de cosas), explorar y «Volver», con lo pedido en pausa.
import { expect, test, vi } from 'vitest';
import { createTimeController } from '../game/timeController';
import { ACTIVE_SITES_MAX, TICKS_PER_DAY } from '../sim/balance';
import { ordersSystem } from '../sim/orders';
import { addSurvivor, emptyWorld, moveTo, siteForTest } from '../sim/testing/fixtures';
import type { SiteInfo, World } from '../sim/types';
import { mountExpeditionsPanel } from './expeditionsPanel';
import { createFlag } from './flag';
import { mountHud } from './hud';

const site = (id: number, over: Partial<SiteInfo> = {}): SiteInfo => ({
  id,
  kind: 'farm',
  special: null,
  side: 0,
  hours: 4,
  state: 'known',
  visited: false,
  specialUntil: null,
  leftAt: null,
  extraZombies: 0,
  hex: 200 + id,
  ...over,
});

function setup(w: World = emptyWorld(20, 20)) {
  const root = document.createElement('div');
  const open = createFlag();
  open.set(true);
  const panel = mountExpeditionsPanel(root, { world: w, open });
  panel.update();
  const q = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector(`[data-testid="${id}"]`) as T;
  const pick = (id: string, value: string) => {
    const s = q<HTMLSelectElement>(id);
    s.value = value;
    s.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const check = (id: string) => {
    q<HTMLInputElement>(id).click();
  };
  return { w, root, open, panel, q, pick, check };
}

test('el botón de arriba abre el panel; sin sitios, lo dice', () => {
  const toggle = vi.fn();
  const hudRoot = document.createElement('div');
  mountHud(hudRoot, { seed: 1, time: createTimeController(), toggleExpeditions: toggle });
  (hudRoot.querySelector('[data-testid="hud-expeditions"]') as HTMLButtonElement).click();
  expect(toggle).toHaveBeenCalled();
  const { q, open, panel } = setup();
  expect(q('expeditions-panel').hidden).toBe(false);
  expect(q('expeditions-sites').textContent).toContain('Aún no conocéis ningún sitio');
  q('expeditions-close').click();
  panel.update();
  expect(open.value).toBe(false);
  expect(q('expeditions-panel').hidden).toBe(true);
});

test('cada sitio con su estado: horas, visitado, gente, lo que le queda a un especial, perdido', () => {
  const w = emptyWorld(20, 20);
  const bea = addSurvivor(w, { x: 3, y: 3 }, 'Bea');
  w.common.expedition.sites.push(
    site(1, { visited: true }),
    site(2, {
      kind: 'gas',
      side: 1,
      hours: 7,
      special: 'survivors',
      specialUntil: 2 * TICKS_PER_DAY,
    }),
    site(3, { kind: 'house', side: 2, state: 'lost' }),
  );
  moveTo(w, siteForTest(w, 1, 16, 16), bea);
  const { q } = setup(w);
  expect(q('site-1').textContent).toContain('Granja del norte');
  expect(q('site-1').textContent).toContain('a 4 h');
  expect(q('site-1').textContent).toContain('visitado');
  expect(q('site-1').textContent).toContain('1 persona allí');
  expect(q('site-2').textContent).toContain('Gasolinera del sur');
  expect(q('site-2').textContent).toContain('sin visitar');
  expect(q('site-2').textContent).toContain('piden ayuda: quedan 2 días');
  expect(q('site-3').textContent).toContain('perdido');
  expect(q('site-3').classList.contains('lost')).toBe(true);
  expect(q('site-1-return')).not.toBeNull(); // con gente, «Volver»
  expect(q('site-2-return')).toBeNull();
  expect(q('site-3-pick')).toBeNull(); // perdido: no se puede mandar a nadie
});

test('formar un grupo: sitio, quién y lista con + y −; salir lo pide (y en pausa se ve)', () => {
  const w = emptyWorld(20, 20);
  w.storage.items.food = 5;
  const ana = w.survivors[0]!;
  const bea = addSurvivor(w, { x: 3, y: 3 }, 'Bea');
  w.common.expedition.sites.push(site(1));
  const { q, pick, check, panel } = setup(w);
  expect(q<HTMLButtonElement>('expedition-send').disabled).toBe(true);
  q('site-1-pick').click(); // «Mandar aquí» elige el sitio
  panel.update();
  expect(q<HTMLSelectElement>('expedition-site').value).toBe('1');
  check(`expedition-member-${ana.id}`);
  pick('expedition-add', 'food');
  panel.update();
  q('expedition-plus-food').click();
  q('expedition-plus-food').click();
  q('expedition-minus-food').click();
  panel.update();
  expect(q('expedition-list').textContent).toContain('2 latas');
  for (let i = 0; i < 6; i++) q('expedition-plus-food').click();
  panel.update();
  expect(q('expedition-list').textContent).toContain('5 latas'); // no más de lo que hay
  q('expedition-send').click();
  expect(w.orders).toContainEqual({
    type: 'sendExpedition',
    siteId: 1,
    survivorIds: [ana.id],
    items: { food: 5 },
  });
  panel.update();
  expect(q<HTMLInputElement>(`expedition-member-${ana.id}`).disabled).toBe(true); // ya sale
  expect(q<HTMLInputElement>(`expedition-member-${bea.id}`).disabled).toBe(false);
  expect(q('expedition-list').querySelectorAll('.bag-row')).toHaveLength(0); // la lista, vacía
  expect(q('expeditions-travels').textContent).toContain('Ana');
  expect(q('expeditions-travels').textContent).toContain('la granja del norte');
  ordersSystem(w);
  panel.update();
  expect(q('expeditions-travels').textContent).toContain('Viajando a la granja del norte');
});

test('no se puede marcar a quien no puede ir; como mucho 4 sitios con gente a la vez', () => {
  const w = emptyWorld(20, 20);
  const bea = addSurvivor(w, { x: 3, y: 3 }, 'Bea');
  bea.action = { type: 'downed', until: 1e9 };
  for (let i = 1; i <= ACTIVE_SITES_MAX + 1; i++) w.common.expedition.sites.push(site(i));
  for (let i = 1; i <= ACTIVE_SITES_MAX; i++)
    w.common.expedition.travels.push({
      id: 100 + i,
      kind: 'go',
      siteId: i,
      side: 0,
      members: [],
      hoursLeft: 3,
      pending: [],
    });
  const { q, pick, check, panel } = setup(w);
  expect(q<HTMLInputElement>(`expedition-member-${bea.id}`).disabled).toBe(true);
  pick('expedition-site', String(ACTIVE_SITES_MAX + 1));
  check(`expedition-member-${w.survivors[0]!.id}`);
  panel.update();
  expect(q<HTMLButtonElement>('expedition-send').disabled).toBe(true);
  expect(q('expedition-form').textContent).toContain('Como mucho 4 sitios');
  pick('expedition-site', '1'); // a uno que ya tiene un grupo, sí
  panel.update();
  expect(q<HTMLButtonElement>('expedition-send').disabled).toBe(false);
});

test('explorar: un lado y uno o dos (no más)', () => {
  const w = emptyWorld(20, 20);
  const [ana] = w.survivors;
  const bea = addSurvivor(w, { x: 3, y: 3 }, 'Bea');
  const carla = addSurvivor(w, { x: 4, y: 4 }, 'Carla');
  const { q, pick, check, panel } = setup(w);
  pick('explore-side', '3');
  check(`explore-member-${ana!.id}`);
  check(`explore-member-${bea.id}`);
  panel.update();
  expect(q<HTMLInputElement>(`explore-member-${carla.id}`).disabled).toBe(true);
  q('explore-send').click();
  expect(w.orders).toContainEqual({ type: 'explore', side: 3, survivorIds: [ana!.id, bea.id] });
  panel.update();
  expect(q('expeditions-travels').textContent).toContain('explorar el este');
});

test('«Volver» en los sitios con gente; pedido en pausa, «Volviendo…»', () => {
  const w = emptyWorld(20, 20);
  const bea = addSurvivor(w, { x: 3, y: 3 }, 'Bea');
  w.common.expedition.sites.push(site(1, { visited: true }));
  moveTo(w, siteForTest(w, 1, 16, 16), bea);
  const { q, panel } = setup(w);
  q('site-1-return').click();
  expect(w.orders).toContainEqual({ type: 'returnHome', siteId: 1 });
  panel.update();
  expect(q<HTMLButtonElement>('site-1-return').disabled).toBe(true);
  expect(q('site-1-return').textContent).toBe('Volviendo…');
});
