// @vitest-environment jsdom
// H5c3 §4: el camino en pantalla: los textos del registro, los avisos y las decisiones, la ficha del
// grupo que espera, «❗» en el mapa y la comida propuesta en Expediciones.
import { expect, test } from 'vitest';
import { createTimeController } from '../game/timeController';
import { findRoute, routeHours } from '../sim/atlas/route';
import { TICKS_PER_HOUR } from '../sim/balance';
import { dayStart } from '../sim/clock';
import { hexToward } from '../sim/expeditions';
import type { logEvent } from '../sim/log';
import { roadEvent } from '../sim/road/events';
import { tripFood } from '../sim/road/food';
import { addSurvivor, emptyWorld, travelFor } from '../sim/testing/fixtures';
import type { LogEntry } from '../sim/log';
import type { SiteInfo } from '../sim/types';
import { logText, noticeFor } from './describe';
import { mountExpeditionsPanel } from './expeditionsPanel';
import { createFlag } from './flag';
import { createMapView, WORLD_MAP } from './mapView';
import { NOTICE_GROUPS } from './noticePrefs';
import { mountNotices } from './notices';
import { createRoutePlan } from './routePlan';
import { mountWorldCard } from './worldPanel';
import { worldGroups } from './worldView';

const e = (x: Parameters<typeof logEvent>[1]) => ({ tick: 0, ...x }) as LogEntry;

/** Ana y Bea de camino, de día, a 8 hexágonos al este. */
function road() {
  const w = emptyWorld(10, 10);
  const { atlas } = w.common;
  w.narrator.nextEventAt = 1e9;
  const ana = w.survivors[0]!;
  const bea = addSurvivor(w, { x: 1, y: 1 }, 'Bea');
  w.survivors = [];
  const to = hexToward(atlas, atlas.base, 3, 8);
  const t = travelFor(w, { kind: 'go', from: atlas.base, to, members: [ana, bea], hoursLeft: 1 });
  t.at = 2;
  t.nextEventAt = 1e9;
  w.common.expedition.travels.push(t);
  w.tick = dayStart(1) + 9 * TICKS_PER_HOUR;
  return { w, t, ana, bea };
}

test('el registro del camino', () => {
  const w = emptyWorld(5, 5);
  const z = (hurt: { name: string; wound: 'scratch' | 'bite' }[], horde?: boolean) =>
    logText(
      e({
        kind: 'roadZombies',
        names: ['Ana', 'Luis'],
        zombies: 3,
        hurt,
        ground: 'forest',
        ...(horde ? { horde } : {}),
      }),
      w,
    );
  expect(z([{ name: 'Luis', wound: 'scratch' }])).toBe(
    'Ana y Luis se cruzan con 3 zombis en el bosque: Luis se lleva un arañazo',
  );
  expect(z([])).toBe('Ana y Luis se cruzan con 3 zombis en el bosque: salen sin un rasguño');
  expect(z([], true)).toContain('atraviesan una horda de 3 zombis');
  expect(
    logText(e({ kind: 'roadLoot', names: ['Ana'], car: true, items: { food: 2 }, left: false }), w),
  ).toBe('Ana registra un coche abandonado: 2 latas');
  expect(
    logText(e({ kind: 'roadLoot', names: ['Ana'], car: false, items: {}, left: true }), w),
  ).toBe('Ana registra una casa abandonada: no les cabe nada');
  expect(logText(e({ kind: 'roadForage', names: ['Ana'], food: 1, ground: 'field' }), w)).toBe(
    'Ana encuentra comida en el campo: 1 lata',
  );
  expect(logText(e({ kind: 'roadHorde', names: ['Ana', 'Bea'], around: true }), w)).toBe(
    'Ana y Bea rodean una horda: el camino será más largo',
  );
  expect(logText(e({ kind: 'roadJoined', name: 'Teo', names: ['Ana'] }), w)).toBe(
    'Teo se une a Ana por el camino',
  );
  expect(logText(e({ kind: 'roadJoinerLeft', name: 'Teo', full: true }), w)).toBe(
    'Teo no cabe en la colonia y sigue su camino',
  );
});

test('avisos: zombis con heridos (rojo si hay mordisco); quien se une o se va; y en el menú Avisos', () => {
  const z = (wound: 'scratch' | 'bite' | null) =>
    noticeFor(
      e({
        kind: 'roadZombies',
        names: ['Ana'],
        zombies: 2,
        hurt: wound ? [{ name: 'Ana', wound }] : [],
        ground: 'field',
      }),
    );
  expect(z(null)).toBeNull();
  expect(z('scratch')).toMatchObject({ tone: 'mixed' });
  expect(z('bite')).toMatchObject({ tone: 'bad' });
  expect(noticeFor(e({ kind: 'roadJoined', name: 'Teo', names: ['Ana'] }))).toMatchObject({
    tone: 'good',
  });
  expect(noticeFor(e({ kind: 'roadJoinerLeft', name: 'Teo', full: false }))).toMatchObject({
    tone: 'mixed',
  });
  const kinds = NOTICE_GROUPS.flatMap((g) => g.kinds);
  for (const k of [
    'decision:horde',
    'decision:joiner',
    'roadZombies',
    'roadJoined',
    'roadJoinerLeft',
  ])
    expect(kinds).toContain(k);
});

test('las decisiones del camino en los avisos: la horda, con el grupo; quien pide unirse, con lo suyo', () => {
  const { w, t } = road();
  roadEvent(w, t, t.path[t.at]!, 'horde');
  const root = document.createElement('div');
  const notices = mountNotices(root, { world: w, time: createTimeController() });
  notices.update();
  const card = root.querySelector('[data-testid="decision-horde"]') as HTMLElement;
  expect(card.textContent).toContain('Ana y Bea');
  (card.querySelector('[data-testid="decision-option-1"]') as HTMLButtonElement).click();
  expect(w.orders).toContainEqual({ type: 'decide', decisionId: t.waiting, option: 1 });
  roadEvent(w, t, t.path[t.at]!, 'joiner');
  notices.update();
  const j = root.querySelector('[data-testid="decision-joiner"]') as HTMLElement;
  expect(j.textContent).toContain(`${t.joiner!.name} pide unirse al grupo`);
  expect(j.textContent).toContain('Lleva');
});

test('la ficha del grupo que espera: la horda, con sus botones; quien pide unirse; la tormenta; y «❗» en el mapa', () => {
  const { w, t } = road();
  const view = createMapView(w);
  view.set(WORLD_MAP);
  const root = document.createElement('div');
  const card = mountWorldCard(root, {
    world: w,
    view,
    plan: createRoutePlan(),
    onSend: () => {},
    onExplore: () => {},
  });
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null;
  expect(worldGroups(w)[0]!.waiting).toBe(false);
  roadEvent(w, t, t.path[t.at]!, 'horde');
  expect(worldGroups(w)[0]!.waiting).toBe(true);
  card.group(t.id);
  card.update();
  expect(q('world-card')!.textContent).toContain('Esperando: una horda delante');
  q('world-card-decide-0')!.click();
  expect(w.orders).toContainEqual({ type: 'decide', decisionId: t.waiting, option: 0 });
  w.orders = [];
  roadEvent(w, t, t.path[t.at]!, 'joiner');
  card.update();
  expect(q('world-card')!.textContent).toContain(`${t.joiner!.name} quiere unirse`);
  w.common.stormUntil = w.tick + TICKS_PER_HOUR;
  card.update();
  expect(q('world-card')!.textContent).toContain('Esperando a que pase la tormenta');
});

test('Expediciones: propone la comida del viaje; si se toca, no se recalcula; avisa si falta', () => {
  const w = emptyWorld(20, 20);
  const { atlas } = w.common;
  w.storage.items.food = 40;
  const bea = addSurvivor(w, { x: 2, y: 2 }, 'Bea');
  const ana = w.survivors[0]!;
  const far: SiteInfo = {
    id: 1,
    kind: 'farm',
    special: null,
    side: 3,
    hours: 20,
    state: 'known',
    visited: false,
    specialUntil: null,
    leftAt: null,
    extraZombies: 0,
    hex: hexToward(atlas, atlas.base, 3, 15),
  };
  w.common.expedition.sites.push(far, { ...far, id: 2, hex: hexToward(atlas, atlas.base, 0, 4) });
  const root = document.createElement('div');
  const open = createFlag();
  open.set(true);
  const panel = mountExpeditionsPanel(root, { world: w, open });
  const q = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector(`[data-testid="${id}"]`) as T;
  panel.update();
  panel.chooseSite(1);
  q(`expedition-member-${ana.id}`).click();
  q(`expedition-member-${bea.id}`).click();
  panel.update();
  const need = tripFood(routeHours(atlas, findRoute(atlas, atlas.base, far.hex)!), true);
  expect(q('expedition-list').textContent).toContain(`${need * 2} latas`);
  expect(q('expedition-food').textContent).toContain(`unas ${need} latas por persona`);
  expect(q('expedition-food').textContent).not.toContain('Os falta comida');
  (
    root.querySelector('[data-bag="group"][data-item="food"][data-delta="-1"]') as HTMLButtonElement
  ).click();
  panel.update();
  expect(q('expedition-list').textContent).toContain(`${need * 2 - 1} latas`);
  expect(q('expedition-food').textContent).toContain('Os falta comida');
  q(`expedition-member-${bea.id}`).click(); // con uno menos no se recalcula: lo ha tocado
  panel.update();
  expect(q('expedition-list').textContent).toContain(`${need * 2 - 1} latas`);
  panel.chooseSite(2); // otro destino: otra vez la propuesta
  panel.update();
  const near = tripFood(
    routeHours(atlas, findRoute(atlas, atlas.base, hexToward(atlas, atlas.base, 0, 4))!),
    true,
  );
  expect(q('expedition-list').textContent).toContain(`${near} latas`);
});
