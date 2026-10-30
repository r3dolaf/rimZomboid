// H5c1, tras la revisión final: lo que une a la gente y las cosas entre mapas (parejas, camas,
// duelo, nombres, ids) y lo que se pierde de verdad (sitios quemados, atrapados que callan).
import { expect, test } from 'vitest';
import { SITE_ZOMBIES, TICKS_PER_DAY, ZOMBIE_LEVEL_MULT } from './balance';
import { newGarment } from './clothes';
import { banish, killSurvivor } from './death';
import { addDecision } from './decisions';
import { checkInvariants } from './invariants';
import { finishBuild } from './jobs/build';
import { issue, ordersSystem } from './orders';
import { siteMap, sitesDailySystem } from './sites';
import { stepGame } from './game';
import { addSurvivor, emptyWorld, moveTo, siteForTest } from './testing/fixtures';
import { createWorld } from './world';
import { Tile, type SiteInfo, type World } from './types';

const info = (id: number, over: Partial<SiteInfo> = {}): SiteInfo => ({
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
  ...over,
});

/** Ana (cama 1 de la base) y Bea, pareja; Carla en la base. Un sitio (7) con suelo. */
function couple() {
  const base = emptyWorld(20, 20);
  base.grid.tiles.fill(Tile.Floor);
  base.seen.fill(1);
  base.narrator.nextEventAt = 1e9;
  const ana = base.survivors[0]!;
  ana.bedId = 1;
  const bea = addSurvivor(base, { x: 3, y: 3 }, 'Bea');
  const carla = addSurvivor(base, { x: 4, y: 4 }, 'Carla');
  ana.partnerId = bea.id;
  bea.partnerId = ana.id;
  base.common.expedition.sites.push(info(7));
  const site = siteForTest(base, 7, 16, 16);
  site.grid.tiles.fill(Tile.Floor);
  site.seen.fill(1);
  return { base, site, ana, bea, carla };
}

const memoryIds = (s: { memories: { id: string }[] }) => s.memories.map((m) => m.id);

test('una pareja separada por una expedición sigue siendo pareja (y las invariantes lo aceptan)', () => {
  const { base, site, ana } = couple();
  moveTo(base, site, ana);
  expect(checkInvariants(base)).toEqual([]);
});

test('si muere en un sitio, su pareja de la base queda libre y lo siente, su cama queda libre y los demás lo lloran', () => {
  const { base, site, ana, bea, carla } = couple();
  moveTo(base, site, ana);
  killSurvivor(site, ana, 'blood');
  stepGame(base);
  expect(bea.partnerId).toBeNull();
  expect(memoryIds(bea)).toContain('partnerDied');
  expect(memoryIds(carla)).toContain('died');
  expect(base.beds.find((b) => b.id === 1)!.ownerId).not.toBe(ana.id);
  expect(checkInvariants(base)).toEqual([]);
});

test('y al revés: si muere en la base, quien está en un sitio lo siente y queda libre', () => {
  const { base, site, ana, bea } = couple();
  moveTo(base, site, bea);
  killSurvivor(base, ana, 'blood');
  stepGame(base);
  expect(bea.partnerId).toBeNull();
  expect(memoryIds(bea)).toContain('partnerDied');
  expect(checkInvariants(base)).toEqual([]);
});

test('si se va (echado) desde un sitio, en la base lo notan igual', () => {
  const { base, site, ana, bea } = couple();
  moveTo(base, site, ana);
  banish(site, ana);
  stepGame(base);
  expect(bea.partnerId).toBeNull();
  expect(memoryIds(bea)).toContain('partnerBanished');
});

test('las camas nuevas de un sitio no repiten el número de una de la base', () => {
  const { base, site, ana } = couple();
  moveTo(base, site, ana);
  const extra = addSurvivor(base, { x: 5, y: 5 }, 'Dani');
  moveTo(base, site, extra);
  extra.bedId = null;
  site.blueprints.push({ id: 900, kind: 'bed', pos: { x: 8, y: 8 }, wood: 6, progress: 0 });
  base.common.woodLog.start += 6; // la madera del plano
  finishBuild(site, site.blueprints[0]!, extra);
  const ids = [...base.beds, ...site.beds].map((b) => b.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(extra.bedId).toBe(site.beds[0]!.id);
  expect(checkInvariants(base)).toEqual([]);
});

test('si los atrapados callan, su «¿Se unen?» se va; y las decisiones de un sitio caducan como en la base', () => {
  const base = emptyWorld(10, 10);
  const i = info(11, { kind: 'house', special: 'survivors', specialUntil: 100, visited: false });
  base.common.expedition.sites.push(i);
  const site = siteMap(base, i);
  addDecision(
    site,
    'stranger',
    site.stranger!.survivors.map((s) => s.id),
  );
  base.tick = TICKS_PER_DAY;
  for (let k = 0; k < 3 && i.special; k++) {
    sitesDailySystem(base);
    base.tick += TICKS_PER_DAY;
  }
  expect(site.stranger).toBeNull();
  expect(site.decisions).toEqual([]);
  expect(checkInvariants(base)).toEqual([]);
  // La fiebre de alguien en un sitio, sin contestar: se aplica lo de por defecto al caducar.
  const { base: b2, site: s2, ana } = couple();
  moveTo(b2, s2, ana);
  addDecision(s2, 'fever', [ana.id]);
  b2.tick = s2.decisions[0]!.expiresAt;
  s2.tick = b2.tick;
  stepGame(b2);
  expect(s2.decisions).toEqual([]);
});

test('al quemarse un sitio, lo de los atrapados (y de quien se iba) entra en las cuentas', () => {
  const base = emptyWorld(10, 10);
  const i = info(12, { kind: 'house', special: 'survivors', specialUntil: 1e9, visited: false });
  base.common.expedition.sites.push(i);
  const site = siteMap(base, i);
  const t = site.stranger!.survivors[0]!;
  t.carrying.pieces.push(newGarment(base.common, 'tshirt'));
  t.carrying.wood = 2;
  base.common.woodLog.start += 2;
  t.carrying.knife = 1;
  base.common.weaponLog.fromSites += 1;
  expect(checkInvariants(base)).toEqual([]);
  // Que se queme seguro: el azar de las expediciones elige; se repite hasta que pase.
  for (let day = 1; day <= 400 && i.state === 'known'; day++) {
    base.tick = day * TICKS_PER_DAY;
    sitesDailySystem(base);
  }
  expect(i.state).toBe('lost');
  expect(checkInvariants(base)).toEqual([]);
  expect(base.common.weaponLog.rotted).toBeGreaterThanOrEqual(1);
});

test('quien no puede ir (descansando por dolor o fiebre) no se queda en la lista ni deja al grupo esperando', () => {
  const { base, ana, bea } = couple();
  base.storage.tiles = [{ x: 5, y: 5 }];
  for (const s of base.survivors) {
    s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100 };
    for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = false;
  }
  bea.health = 5; // le duele tanto que descansa (sin analgésico)
  bea.action = { type: 'rest' };
  issue(base, { type: 'sendExpedition', siteId: 7, survivorIds: [ana.id, bea.id], items: {} });
  ordersSystem(base);
  expect(bea.trip).toBeNull();
  const travel = base.common.expedition.travels[0]!;
  expect(travel.pending).toEqual([ana.id]);
  // Si deja de poder después de la orden (fiebre con «Que descanse»), sale de la lista.
  const carla = base.survivors.find((s) => s.name === 'Carla')!;
  issue(base, { type: 'explore', side: 1, survivorIds: [carla.id] });
  ordersSystem(base);
  carla.fever = {
    cause: 'flu',
    since: base.tick,
    stage: 'fever',
    rest: true,
    restTicks: 0,
    badLuck: false,
    checks: 0,
  };
  stepGame(base);
  expect(base.common.expedition.travels.find((t) => t.kind === 'explore')).toBeUndefined();
  expect(carla.trip).toBeNull();
});

test('los atrapados no se llaman como ningún colono, esté donde esté', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const base = createWorld(seed);
    const names = new Set(base.survivors.map((s) => s.name));
    const i = info(20, { kind: 'house', special: 'survivors', specialUntil: 1e9, visited: false });
    base.common.expedition.sites.push(i);
    const site = siteMap(base, i);
    for (const s of site.stranger!.survivors) expect(names.has(s.name), `${seed}`).toBe(false);
  }
});

test('los zombis de los sitios siguen la opción Zombis (y no rompen el tope)', () => {
  const base: World = createWorld(3, 'calm', 'few');
  const i = info(30, { kind: 'gas', special: 'dangerous', visited: false });
  base.common.expedition.sites.push(i);
  const site = siteMap(base, i);
  expect(site.zombies).toHaveLength(Math.round(SITE_ZOMBIES.dangerous * ZOMBIE_LEVEL_MULT.few));
  expect(checkInvariants(base).filter((p) => p.includes('zombis'))).toEqual([]);
});

test('borrar un atuendo cambia también el de los que están fuera', () => {
  const { base, site, ana } = couple();
  issue(base, { type: 'addOutfit' });
  ordersSystem(base);
  const extra = base.common.outfits.at(-1)!;
  ana.outfitId = extra.id;
  moveTo(base, site, ana);
  issue(base, { type: 'deleteOutfit', outfitId: extra.id });
  ordersSystem(base);
  expect(ana.outfitId).toBe(base.common.outfits[0]!.id);
  expect(checkInvariants(base)).toEqual([]);
});
